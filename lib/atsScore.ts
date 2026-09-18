import type { AggregatedProfile } from "@/lib/profile";
import type { CvRawText } from "@/lib/cvs";
import type { AtsSubscores, TailoredCv } from "@/lib/openai";

/**
 * Deterministic weighted ATS scoring engine. Implements the 9-criterion
 * manual scorecard: 6 criteria are computed purely from text/structured-data
 * heuristics (auditable, no model variance), 3 (formatting cleanliness,
 * education match, certifications) are rated by an LLM against an explicit
 * 0-3 rubric elsewhere (see `scoreAtsSubcriteria` / `TailoringInsights` in
 * lib/openai.ts) and combined here with the rest. See scoring.md for the
 * full explanation.
 */

export type AtsCriterionKey =
  | "keywordMatch"
  | "jobTitleAlignment"
  | "requiredSkillsCoverage"
  | "formattingCleanliness"
  | "standardSectionHeadings"
  | "experienceDepthRecency"
  | "quantifiedAchievements"
  | "educationMatch"
  | "certifications";

export type AtsCriterionScore = {
  key: AtsCriterionKey;
  label: string;
  score: 0 | 1 | 2 | 3;
  weight: number;
  weighted: number;
  detail: string;
};

export type AtsScoreBand = "submission-ready" | "needs-tailoring" | "weak-match";

export type AtsScoreBreakdown = {
  criteria: AtsCriterionScore[];
  totalPoints: number;
  maxPoints: number;
  normalizedScore: number;
  band: AtsScoreBand;
  weakPoints: AtsCriterionScore[];
};

/** Common shape both the raw-CV path and the tailored-CV path normalize into. */
export type AtsSubjectMaterial = {
  headline: string;
  roleTitles: string[];
  skills: string[];
  roleBullets: string[];
  roleDates: string[];
  years: number | null;
  rawText: string;
};

export type AtsJobInput = {
  parsedTitle: string | null;
  parsedDescription: string | null;
  parsedRequirements: unknown;
};

const CRITERION_LABELS: Record<AtsCriterionKey, string> = {
  keywordMatch: "Keyword Match",
  jobTitleAlignment: "Job Title Alignment",
  requiredSkillsCoverage: "Required Skills Coverage",
  formattingCleanliness: "Formatting Cleanliness",
  standardSectionHeadings: "Standard Section Headings",
  experienceDepthRecency: "Experience Depth & Recency",
  quantifiedAchievements: "Quantified Achievements",
  educationMatch: "Education Match",
  certifications: "Certifications",
};

export const CRITERION_WEIGHTS: Record<AtsCriterionKey, number> = {
  keywordMatch: 3,
  jobTitleAlignment: 3,
  requiredSkillsCoverage: 3,
  formattingCleanliness: 2,
  standardSectionHeadings: 2,
  experienceDepthRecency: 2,
  quantifiedAchievements: 2,
  educationMatch: 1,
  certifications: 1,
};

const MAX_POINTS =
  Object.values(CRITERION_WEIGHTS).reduce((sum, weight) => sum + weight, 0) * 3; // 57

function makeCriterion(
  key: AtsCriterionKey,
  score: 0 | 1 | 2 | 3,
  detail: string
): AtsCriterionScore {
  const weight = CRITERION_WEIGHTS[key];
  return { key, label: CRITERION_LABELS[key], score, weight, weighted: score * weight, detail };
}

/** Ratio-to-0-3 bucketing shared by every deterministic, coverage-style criterion. */
export function scoreFromRatio(ratio: number): 0 | 1 | 2 | 3 {
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.5) return 2;
  if (ratio > 0) return 1;
  return 0;
}

function clampToRubricScore(value: number): 0 | 1 | 2 | 3 {
  const rounded = Math.round(value);
  if (rounded <= 0) return 0;
  if (rounded >= 3) return 3;
  return rounded as 1 | 2;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordIncludes(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (!trimmed) return false;
  return new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i").test(haystack);
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "will", "your", "you", "are",
  "our", "who", "can", "able", "into", "onto", "not", "but", "all", "any", "each", "more",
  "most", "other", "some", "such", "only", "own", "same", "than", "too", "very", "just", "also",
  "then", "them", "they", "their", "what", "when", "where", "which", "while", "about", "across",
  "after", "again", "against", "before", "being", "below", "between", "both", "during",
  "further", "here", "how", "itself", "once", "over", "under", "why", "would", "could", "should",
  "job", "role", "team", "work", "years", "year", "experience", "required", "preferred",
  "looking", "strong", "ability", "skills", "skill", "knowledge", "using", "use", "within",
  "including", "etc",
]);

/** Lowercase word/token tokenizer that keeps things like "c++"/"node.js" intact. */
function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9+.#-]*[a-z0-9]|[a-z0-9]/g) ?? [];
  return matches.filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

// ── Subject material adapters ───────────────────────────────────────────

/** Pre-tailoring: the candidate's real, untailored material. */
export function materialFromProfile(
  profile: AggregatedProfile,
  cvRawTexts: CvRawText[]
): AtsSubjectMaterial {
  return {
    headline: profile.identity.headline,
    roleTitles: profile.roles.map((role) => role.title),
    skills: profile.skills.map((skill) => skill.label),
    roleBullets: profile.roles.flatMap((role) => role.bullets.map((bullet) => bullet.text)),
    roleDates: profile.roles.map((role) => role.dates),
    years: profile.years,
    rawText: cvRawTexts.map((cv) => cv.extractedText).join("\n\n"),
  };
}

/**
 * Post-tailoring: the model's own structured output. `years` is threaded
 * through from the candidate's real profile rather than re-derived, since a
 * CV rewrite can't change how many years of experience someone actually has.
 */
export function materialFromTailoredCv(cv: TailoredCv, years: number | null): AtsSubjectMaterial {
  const flatSkills = cv.skills.flatMap((group) => group.items);

  const rawText = [
    "Summary",
    cv.summary,
    "Skills",
    cv.skills.map((group) => `${group.category}: ${group.items.join(", ")}`).join("\n"),
    "Experience",
    ...cv.experience.flatMap((entry) => [
      `${entry.title} ${entry.company} ${entry.dates}`,
      entry.context,
      ...entry.bullets,
    ]),
    "Projects",
    ...cv.projects.flatMap((project) => [
      [project.name, project.dates, project.description].filter(Boolean).join(" "),
      ...project.bullets,
    ]),
    "Education",
    ...cv.education.map((entry) => `${entry.degree} ${entry.institution} ${entry.dates}`),
  ].join("\n");

  return {
    headline: cv.headline,
    roleTitles: cv.experience.map((entry) => entry.title),
    skills: flatSkills,
    roleBullets: cv.experience.flatMap((entry) => entry.bullets),
    roleDates: cv.experience.map((entry) => entry.dates),
    years,
    rawText,
  };
}

// ── Deterministic criteria ──────────────────────────────────────────────

const SECTION_HEADING_PATTERNS: Record<string, RegExp> = {
  Experience: /\b(work\s+)?experience\b|employment\s+history/i,
  Education: /\beducation\b/i,
  Skills: /\b(technical\s+)?skills\b/i,
  Summary: /\b(summary|profile|objective)\b/i,
};

/** The 6 criteria computed purely from text/structured-data heuristics — same input, same score, every time. */
export function computeDeterministicCriteria(
  material: AtsSubjectMaterial,
  job: AtsJobInput
): AtsCriterionScore[] {
  const requirements = ((job.parsedRequirements as string[] | null) ?? []).filter(
    (req) => typeof req === "string" && req.trim().length > 0
  );
  const jobKeywordSource = [job.parsedTitle ?? "", job.parsedDescription ?? "", ...requirements].join(" ");
  const jobTokens = [...new Set(tokenize(jobKeywordSource))];

  const matchedTokens = jobTokens.filter((token) => wholeWordIncludes(material.rawText, token));
  const keywordMatch = makeCriterion(
    "keywordMatch",
    jobTokens.length > 0 ? scoreFromRatio(matchedTokens.length / jobTokens.length) : 3,
    jobTokens.length > 0
      ? `${matchedTokens.length}/${jobTokens.length} job keywords found in the CV text.`
      : "No job keywords available to check."
  );

  const jobTitleTokens = new Set(tokenize(job.parsedTitle ?? ""));
  let bestTitleRatio = 0;
  for (const candidateTitle of [...material.roleTitles, material.headline]) {
    const candidateTokens = new Set(tokenize(candidateTitle));
    if (jobTitleTokens.size === 0 || candidateTokens.size === 0) continue;
    const intersectionSize = [...jobTitleTokens].filter((token) => candidateTokens.has(token)).length;
    const unionSize = new Set([...jobTitleTokens, ...candidateTokens]).size;
    bestTitleRatio = Math.max(bestTitleRatio, unionSize > 0 ? intersectionSize / unionSize : 0);
  }
  const jobTitleAlignment = makeCriterion(
    "jobTitleAlignment",
    jobTitleTokens.size > 0 ? scoreFromRatio(bestTitleRatio) : 3,
    jobTitleTokens.size > 0
      ? `Best title overlap with "${job.parsedTitle}" is ${Math.round(bestTitleRatio * 100)}%.`
      : "No job title available to check."
  );

  const coveredRequirements = requirements.filter((requirement) =>
    material.skills.some(
      (skill) => wholeWordIncludes(requirement, skill) || wholeWordIncludes(skill, requirement)
    )
  );
  const requiredSkillsCoverage = makeCriterion(
    "requiredSkillsCoverage",
    requirements.length > 0 ? scoreFromRatio(coveredRequirements.length / requirements.length) : 3,
    requirements.length > 0
      ? `${coveredRequirements.length}/${requirements.length} listed requirements match a candidate skill.`
      : "No requirements listed to check."
  );

  const foundHeadings = Object.entries(SECTION_HEADING_PATTERNS).filter(([, pattern]) =>
    pattern.test(material.rawText)
  );
  const standardSectionHeadings = makeCriterion(
    "standardSectionHeadings",
    scoreFromRatio(foundHeadings.length / Object.keys(SECTION_HEADING_PATTERNS).length),
    `${foundHeadings.length}/${Object.keys(SECTION_HEADING_PATTERNS).length} standard sections detected` +
      (foundHeadings.length > 0 ? ` (${foundHeadings.map(([name]) => name).join(", ")}).` : ".")
  );

  const requiredYearsMatch = jobKeywordSource.match(/(\d{1,2})\+?\s*years?/i);
  const requiredYears = requiredYearsMatch ? Number(requiredYearsMatch[1]) : null;
  const depthOk =
    material.years != null && (requiredYears == null || material.years >= requiredYears);
  const currentYear = new Date().getFullYear();
  const recentOk = material.roleDates.some((dates) => {
    if (/present|current/i.test(dates)) return true;
    const years = [...dates.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
    return years.length > 0 && Math.max(...years) >= currentYear - 2;
  });
  const hasExperience = material.roleDates.length > 0;
  let experienceDepthRecencyScore: 0 | 1 | 2 | 3;
  if (depthOk && recentOk) experienceDepthRecencyScore = 3;
  else if (depthOk || recentOk) experienceDepthRecencyScore = 2;
  else if (hasExperience) experienceDepthRecencyScore = 1;
  else experienceDepthRecencyScore = 0;
  const experienceDepthRecency = makeCriterion(
    "experienceDepthRecency",
    experienceDepthRecencyScore,
    `Candidate years: ${material.years ?? "unknown"}` +
      (requiredYears != null ? ` (job wants ${requiredYears}+)` : "") +
      `; most recent role recent: ${recentOk ? "yes" : "no"}.`
  );

  const quantifiedBullets = material.roleBullets.filter(
    (bullet) => /\d/.test(bullet) || /%/.test(bullet) || /[$€£]/.test(bullet)
  );
  const quantifiedAchievements = makeCriterion(
    "quantifiedAchievements",
    material.roleBullets.length > 0 ? scoreFromRatio(quantifiedBullets.length / material.roleBullets.length) : 0,
    material.roleBullets.length > 0
      ? `${quantifiedBullets.length}/${material.roleBullets.length} bullets include a measurable outcome.`
      : "No experience bullets to check."
  );

  return [
    keywordMatch,
    jobTitleAlignment,
    requiredSkillsCoverage,
    standardSectionHeadings,
    experienceDepthRecency,
    quantifiedAchievements,
  ];
}

/** Maps the LLM-rated hybrid subscores (formatting, education, certifications) into criteria. */
export function hybridCriteriaFromSubscores(subscores: AtsSubscores): AtsCriterionScore[] {
  return [
    makeCriterion(
      "formattingCleanliness",
      clampToRubricScore(subscores.formattingCleanliness),
      subscores.formattingDetail
    ),
    makeCriterion("educationMatch", clampToRubricScore(subscores.educationMatch), subscores.educationDetail),
    makeCriterion(
      "certifications",
      clampToRubricScore(subscores.certifications),
      subscores.certificationsDetail
    ),
  ];
}

export function combineAtsScore(
  deterministic: AtsCriterionScore[],
  hybrid: AtsCriterionScore[]
): AtsScoreBreakdown {
  const criteria = [...deterministic, ...hybrid];
  const totalPoints = criteria.reduce((sum, criterion) => sum + criterion.weighted, 0);
  const normalizedScore = Math.round((totalPoints / MAX_POINTS) * 100);
  const band: AtsScoreBand =
    totalPoints > 45 ? "submission-ready" : totalPoints >= 34 ? "needs-tailoring" : "weak-match";
  const weakPoints = criteria.filter((criterion) => criterion.score <= 1);

  return { criteria, totalPoints, maxPoints: MAX_POINTS, normalizedScore, band, weakPoints };
}

// ── Weak-point-driven prompt ────────────────────────────────────────────

const CRITERION_GUIDANCE: Record<AtsCriterionKey, string> = {
  keywordMatch:
    "Weave in more of the job's real terminology wherever it's genuinely, truthfully supported by " +
    "the candidate's evidence (Skill §8 Keyword Coverage) — never stuff in a keyword that isn't true. " +
    "The summary is the highest-leverage place to do this; revisit it first.",
  jobTitleAlignment:
    "Position the headline and most relevant role title closer to the target job title using " +
    "accurate, truthful language (Skill §7 Stronger Positioning) — never claim a title the candidate " +
    "didn't hold. Make sure the summary's opening positioning statement names the target title " +
    "explicitly if it doesn't already.",
  requiredSkillsCoverage:
    "Search harder for adjacent or transferable evidence of the job's required skills before leaving " +
    "any of them unclaimed (Skill §10 Missing Requirements). If, after that search, a required skill " +
    "still has no real evidence, do not soften or imply coverage — name it plainly in " +
    "insights.unmetRequirement instead.",
  formattingCleanliness:
    "Keep the tailored CV clean and simple — standard fonts, no tables/columns/graphics — so it stays " +
    "parser-friendly (Skill §16 ATS).",
  standardSectionHeadings:
    "Use standard section names (Experience, Education, Skills, Summary) so ATS parsers can find them " +
    "(Skill §16 ATS).",
  experienceDepthRecency:
    "This reflects the candidate's actual years and recency of experience and cannot be changed by " +
    "rewriting — do not fabricate additional years, roles, or dates.",
  quantifiedAchievements:
    "Extract every legitimate metric available; where only qualitative evidence exists, strengthen " +
    "the wording without inventing numbers (Skill §11 Achievements).",
  educationMatch:
    "Only surface education the candidate genuinely has — never invent a degree (Skill core principle).",
  certifications:
    "Only surface certifications the candidate genuinely holds — never invent one (Skill core " +
    "principle).",
};

/**
 * Criteria a truthful rewrite can actually move: wording, framing, keyword
 * coverage, section naming, and which real evidence gets surfaced. Excludes
 * `experienceDepthRecency` (reflects the candidate's actual history, not
 * phrasing) and `educationMatch`/`certifications` (yes/no credential facts —
 * pushing a retry on these risks nudging the model toward implying a degree
 * or cert that doesn't exist, which the skill prompt must never do).
 */
export const FIXABLE_BY_REWRITE_CRITERIA: readonly AtsCriterionKey[] = [
  "keywordMatch",
  "jobTitleAlignment",
  "requiredSkillsCoverage",
  "formattingCleanliness",
  "standardSectionHeadings",
  "quantifiedAchievements",
];

/**
 * Builds a second-pass correction prompt when the *post-tailoring* breakdown
 * still has weak points that a truthful rewrite could plausibly close. Returns
 * null when there's nothing worth a retry over (either no weak points, or the
 * only weak points left are ones a rewrite can't truthfully change).
 */
export function buildCorrectionPrompt(breakdown: AtsScoreBreakdown): string | null {
  const fixableWeakPoints = breakdown.weakPoints.filter((criterion) =>
    FIXABLE_BY_REWRITE_CRITERIA.includes(criterion.key)
  );
  if (fixableWeakPoints.length === 0) return null;

  const lines = fixableWeakPoints
    .map(
      (criterion) =>
        `- ${criterion.label} (${criterion.score}/3): ${criterion.detail} ${CRITERION_GUIDANCE[criterion.key]}`
    )
    .join("\n");

  return (
    "\n\nSECOND PASS — CLOSE REMAINING GAPS\n" +
    "Your first draft still scored weak on criteria a rewrite can truthfully fix. Revise the CV and " +
    "cover letter again, using only the same truthful evidence already given to you, to close these " +
    "specific gaps:\n" +
    lines +
    "\n\nDo not invent anything new to close these gaps — only better surface, reframe, or reposition " +
    "evidence that is already true. If a gap genuinely cannot be closed without fabricating something, " +
    "leave it as-is and say so via insights.unmetRequirement rather than inventing coverage."
  );
}

/**
 * Turns the pre-tailoring breakdown into the system-prompt fragment that
 * replaces the old self-estimated "confidence calibration" block: states the
 * real, independently-computed score, keeps the same aggressive/conservative
 * framing threshold, and lists exactly which criteria are weak and how to
 * truthfully address each one.
 */
export function buildWeakPointsPrompt(breakdown: AtsScoreBreakdown): string {
  const isStrongFit = breakdown.normalizedScore >= 60;
  const calibration = isStrongFit
    ? "The candidate is already a strong fit. Lean into truthful ambition: state genuinely " +
      "transferable or adjacent skills with confidence even if the exact term never appeared in " +
      "their material, describe real ownership using more senior-sounding but still accurate " +
      "language when the underlying responsibility genuinely supports it, and don't hedge language " +
      "for things the evidence genuinely supports."
    : "The gap is real. Stay conservative — tailor only what is explicitly and directly supported by " +
      "the source material, and lean more on the skill's \"leave the requirement unclaimed\" guidance " +
      "rather than stretching adjacent evidence.";

  const weakLines =
    breakdown.weakPoints.length > 0
      ? breakdown.weakPoints
          .map((criterion) => `- ${criterion.label} (${criterion.score}/3): ${criterion.detail} ${CRITERION_GUIDANCE[criterion.key]}`)
          .join("\n")
      : "- None — every scored criterion is already at least a 2/3.";

  return (
    "\n\nPRE-TAILORING FIT (computed independently, not self-estimated)\n" +
    `Score: ${breakdown.normalizedScore}/100 (${breakdown.totalPoints}/${breakdown.maxPoints} weighted points).\n\n` +
    calibration +
    "\n\n" +
    "Specific weak points to address — using only real, truthful evidence, never invented:\n" +
    weakLines +
    "\n\n" +
    "The skill's core rule is absolute and is NEVER overridden by this calibration: never invent " +
    "employers, job titles, companies, degrees, certifications, dates, metrics, or tools the " +
    "candidate has never used. This only adjusts confidence and framing of real, truthful evidence " +
    "— never its existence."
  );
}
