import { prisma } from "@/lib/prisma";
import { getCvRawTextsForUser, type CvRawText } from "@/lib/cvs";
import { getJobPostForTailoring } from "@/lib/jobs";
import { buildProfileFromCvs, type AggregatedProfile } from "@/lib/profile";
import {
  generateTailoring,
  scoreAtsSubcriteria,
  OPENAI_MODEL,
  type TailoredCv,
  type WhatChangedItem,
} from "@/lib/openai";
import {
  combineAtsScore,
  computeDeterministicCriteria,
  hybridCriteriaFromSubscores,
  buildWeakPointsPrompt,
  buildCorrectionPrompt,
  materialFromProfile,
  materialFromTailoredCv,
  type AtsJobInput,
  type AtsScoreBreakdown,
} from "@/lib/atsScore";
import { isRetryableOpenAIError, withRetry } from "@/lib/retry";

const JOB_RAW_TEXT_CAP = 8_000;
const PROFILE_SUMMARY_CAP = 4_000;
const CV_TEXT_CAP_PER_DOCUMENT = 15_000;

export type TailoringRecord = {
  id: string;
  jobPostId: string;
  model: string;
  tailoredCv: TailoredCv;
  coverLetter: string;
  whatChanged: WhatChangedItem[];
  preTailoringMatchScore: number;
  /** Null for tailoring generated before this breakdown was introduced. */
  preTailoringBreakdown: AtsScoreBreakdown | null;
  atsScore: number;
  /** Null for tailoring generated before this breakdown was introduced. */
  atsScoreBreakdown: AtsScoreBreakdown | null;
  keywordsCovered: string[];
  unmetRequirement: string | null;
  createdAt: Date;
};

function toRecord(row: {
  id: string;
  jobPostId: string;
  model: string;
  tailoredCv: unknown;
  coverLetter: string;
  whatChanged: unknown;
  preTailoringMatchScore: number;
  preTailoringBreakdown: unknown;
  atsScore: number;
  atsScoreBreakdown: unknown;
  keywordsCovered: unknown;
  unmetRequirement: string | null;
  createdAt: Date;
}): TailoringRecord {
  return {
    id: row.id,
    jobPostId: row.jobPostId,
    model: row.model,
    tailoredCv: row.tailoredCv as TailoredCv,
    coverLetter: row.coverLetter,
    whatChanged: row.whatChanged as WhatChangedItem[],
    preTailoringMatchScore: row.preTailoringMatchScore,
    preTailoringBreakdown: row.preTailoringBreakdown as AtsScoreBreakdown | null,
    atsScore: row.atsScore,
    atsScoreBreakdown: row.atsScoreBreakdown as AtsScoreBreakdown | null,
    keywordsCovered: row.keywordsCovered as string[],
    unmetRequirement: row.unmetRequirement,
    createdAt: row.createdAt,
  };
}

/** Existing tailoring for a job post, scoped to its owner — never triggers generation. */
export async function findTailoringForJobPost(
  userId: string,
  jobPostId: string
): Promise<TailoringRecord | null> {
  const row = await prisma.tailoring.findFirst({
    where: { jobPostId, userId },
  });
  return row ? toRecord(row) : null;
}

type JobForTailoring = AtsJobInput & {
  parsedCompany: string | null;
  parsedLocation: string | null;
  rawText: string;
};

function buildJobText(job: JobForTailoring): string {
  const requirements = (job.parsedRequirements as string[] | null) ?? [];
  return (
    "JOB POSTING\n" +
    `Title: ${job.parsedTitle ?? "Unknown"}\n` +
    `Company: ${job.parsedCompany ?? "Unknown"}\n` +
    `Location: ${job.parsedLocation ?? "Unknown"}\n` +
    `Summary: ${job.parsedDescription ?? "Not available"}\n` +
    "Requirements:\n" +
    (requirements.length > 0
      ? requirements.map((r) => `- ${r}`).join("\n")
      : "- Not available") +
    "\n\nRaw source text (may contain site boilerplate; use only for extra context the summary above may have missed):\n" +
    job.rawText.slice(0, JOB_RAW_TEXT_CAP)
  );
}

function buildCandidateText(
  profile: AggregatedProfile,
  cvs: CvRawText[],
  additionalContext?: string
): string {
  const profileSummary = JSON.stringify(profile).slice(0, PROFILE_SUMMARY_CAP);
  const cvBlocks = cvs
    .map(
      (cv) =>
        `--- CV: ${cv.fileName} ---\n${cv.extractedText.slice(0, CV_TEXT_CAP_PER_DOCUMENT)}`
    )
    .join("\n\n");

  let text =
    "CANDIDATE MATERIAL\n\n" +
    "Aggregated profile summary (structured signal — evidence-counted skills, deduped roles):\n" +
    profileSummary +
    "\n\nRaw CV documents (verbatim extracted text — primary source of truth; search this for evidence not captured in the summary above):\n" +
    cvBlocks;

  const trimmed = additionalContext?.trim();
  if (trimmed) {
    text +=
      "\n\nADDITIONAL INFORMATION (user-supplied evidence for a previously identified gap — use truthfully; do not invent beyond what is stated here):\n" +
      trimmed;
  }

  return text;
}

export type GenerateTailoringOptions = {
  /** When true, delete any existing tailoring and regenerate. */
  force?: boolean;
  /** Optional user-supplied evidence (e.g. gap follow-up) threaded into the prompt. */
  additionalContext?: string;
};

/** Deletes the tailoring row for a job post owned by the user, if any. */
export async function deleteTailoringForJobPost(
  userId: string,
  jobPostId: string
): Promise<void> {
  await prisma.tailoring.deleteMany({ where: { jobPostId, userId } });
}

/**
 * Generates tailoring for a job post (or returns the existing one if already
 * generated) and persists it. Race-safe via upsert on the unique jobPostId.
 *
 * Scoring runs at least twice, independently of the model's own output, per
 * scoring.md: once against the candidate's raw material (preTailoringMatchScore)
 * to compute weak points that steer the tailoring prompt, and once against the
 * tailored output (atsScore) — both via the same weighted 9-criterion formula.
 * If the tailored output still has weak points a truthful rewrite could
 * plausibly close, one bounded correction pass re-generates and re-scores,
 * keeping whichever attempt scored higher (see buildCorrectionPrompt).
 */
export async function getOrGenerateTailoring(
  userId: string,
  jobPostId: string,
  options?: GenerateTailoringOptions
): Promise<{ record: TailoringRecord; generated: boolean }> {
  if (options?.force) {
    await deleteTailoringForJobPost(userId, jobPostId);
  } else {
    const existing = await findTailoringForJobPost(userId, jobPostId);
    if (existing) {
      return { record: existing, generated: false };
    }
  }

  const job = await getJobPostForTailoring(userId, jobPostId);
  if (!job) {
    throw new Error("Job posting not found.");
  }

  const [profile, cvRawTexts] = await Promise.all([
    buildProfileFromCvs(userId),
    getCvRawTextsForUser(userId),
  ]);
  if (cvRawTexts.length === 0) {
    throw new Error("Upload a CV before tailoring can be generated.");
  }

  const jobText = buildJobText(job);
  const candidateText = buildCandidateText(
    profile,
    cvRawTexts,
    options?.additionalContext
  );

  const preMaterial = materialFromProfile(profile, cvRawTexts);
  const preDeterministic = computeDeterministicCriteria(preMaterial, job);
  const preHybridSubscores = await withRetry(() => scoreAtsSubcriteria({ candidateText, jobText }), {
    shouldRetry: isRetryableOpenAIError,
  });
  const preBreakdown = combineAtsScore(preDeterministic, hybridCriteriaFromSubscores(preHybridSubscores));
  const weakPointsPrompt = buildWeakPointsPrompt(preBreakdown);

  const result = await withRetry(
    () => generateTailoring({ jobText, candidateText, weakPointsPrompt }),
    { shouldRetry: isRetryableOpenAIError }
  );

  const postMaterial = materialFromTailoredCv(result.tailoredCv, profile.years);
  const postDeterministic = computeDeterministicCriteria(postMaterial, job);
  const postBreakdown = combineAtsScore(
    postDeterministic,
    hybridCriteriaFromSubscores(result.insights.atsSubscores)
  );

  let finalResult = result;
  let finalBreakdown = postBreakdown;

  // One bounded self-correction pass: only fires when the post-tailoring
  // breakdown still has weak points a truthful rewrite could plausibly close
  // (see FIXABLE_BY_REWRITE_CRITERIA). Keeps whichever attempt scored higher,
  // so a retry can never make the persisted result worse.
  const correctionPrompt = buildCorrectionPrompt(postBreakdown);
  if (correctionPrompt) {
    const retryResult = await withRetry(
      () =>
        generateTailoring({
          jobText,
          candidateText,
          weakPointsPrompt: weakPointsPrompt + correctionPrompt,
        }),
      { shouldRetry: isRetryableOpenAIError }
    );
    const retryMaterial = materialFromTailoredCv(retryResult.tailoredCv, profile.years);
    const retryDeterministic = computeDeterministicCriteria(retryMaterial, job);
    const retryBreakdown = combineAtsScore(
      retryDeterministic,
      hybridCriteriaFromSubscores(retryResult.insights.atsSubscores)
    );
    if (retryBreakdown.normalizedScore >= postBreakdown.normalizedScore) {
      finalResult = retryResult;
      finalBreakdown = retryBreakdown;
    }
  }

  const row = await prisma.tailoring.upsert({
    where: { jobPostId },
    create: {
      userId,
      jobPostId,
      model: OPENAI_MODEL,
      tailoredCv: finalResult.tailoredCv,
      coverLetter: finalResult.coverLetter,
      whatChanged: finalResult.whatChanged,
      preTailoringMatchScore: preBreakdown.normalizedScore,
      preTailoringBreakdown: preBreakdown,
      atsScore: finalBreakdown.normalizedScore,
      atsScoreBreakdown: finalBreakdown,
      keywordsCovered: finalResult.insights.keywordsCovered,
      unmetRequirement: finalResult.insights.unmetRequirement,
    },
    update: {
      model: OPENAI_MODEL,
      tailoredCv: finalResult.tailoredCv,
      coverLetter: finalResult.coverLetter,
      whatChanged: finalResult.whatChanged,
      preTailoringMatchScore: preBreakdown.normalizedScore,
      preTailoringBreakdown: preBreakdown,
      atsScore: finalBreakdown.normalizedScore,
      atsScoreBreakdown: finalBreakdown,
      keywordsCovered: finalResult.insights.keywordsCovered,
      unmetRequirement: finalResult.insights.unmetRequirement,
    },
  });

  return { record: toRecord(row), generated: true };
}
