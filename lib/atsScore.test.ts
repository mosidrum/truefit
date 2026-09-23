import { describe, expect, it } from "vitest";
import {
  CRITERION_WEIGHTS,
  scoreFromRatio,
  computeDeterministicCriteria,
  combineAtsScore,
  hybridCriteriaFromSubscores,
  buildWeakPointsPrompt,
  materialFromProfile,
  materialFromTailoredCv,
  type AtsSubjectMaterial,
  type AtsJobInput,
} from "@/lib/atsScore";
import type { AggregatedProfile } from "@/lib/profile";
import type { CvRawText } from "@/lib/cvs";
import type { TailoredCv } from "@/lib/openai";

describe("CRITERION_WEIGHTS", () => {
  it("sums to 19, for a max possible score of 57 (19 * 3)", () => {
    const totalWeight = Object.values(CRITERION_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBe(19);
    expect(totalWeight * 3).toBe(57);
  });
});

describe("scoreFromRatio", () => {
  it("buckets ratios into 0-3 per the documented thresholds", () => {
    expect(scoreFromRatio(0)).toBe(0);
    expect(scoreFromRatio(0.1)).toBe(1);
    expect(scoreFromRatio(0.49)).toBe(1);
    expect(scoreFromRatio(0.5)).toBe(2);
    expect(scoreFromRatio(0.74)).toBe(2);
    expect(scoreFromRatio(0.75)).toBe(3);
    expect(scoreFromRatio(1)).toBe(3);
  });
});

const EMPTY_JOB: AtsJobInput = {
  parsedTitle: null,
  parsedDescription: null,
  parsedRequirements: null,
};

const EMPTY_MATERIAL: AtsSubjectMaterial = {
  headline: "",
  roleTitles: [],
  skills: [],
  roleBullets: [],
  roleDates: [],
  years: null,
  rawText: "",
};

function byKey(criteria: ReturnType<typeof computeDeterministicCriteria>, key: string) {
  const found = criteria.find((c) => c.key === key);
  if (!found) throw new Error(`missing criterion ${key}`);
  return found;
}

describe("computeDeterministicCriteria", () => {
  it("scores keyword match by whole-word presence of job keywords in the CV text", () => {
    const job: AtsJobInput = {
      parsedTitle: "Frontend Engineer",
      parsedDescription: "Build React applications with TypeScript and PostgreSQL.",
      parsedRequirements: ["React", "TypeScript", "PostgreSQL", "GraphQL"],
    };
    const material: AtsSubjectMaterial = {
      ...EMPTY_MATERIAL,
      rawText: "Built React applications using TypeScript across several projects.",
    };

    const criteria = computeDeterministicCriteria(material, job);
    const keywordMatch = byKey(criteria, "keywordMatch");
    expect(keywordMatch.weight).toBe(3);
    // Some job keywords (react, typescript) are present; postgresql/graphql are not.
    expect(keywordMatch.score).toBeGreaterThan(0);
    expect(keywordMatch.score).toBeLessThan(3);
  });

  it("gives full marks for keyword match when there are no job keywords to check", () => {
    const criteria = computeDeterministicCriteria(EMPTY_MATERIAL, EMPTY_JOB);
    expect(byKey(criteria, "keywordMatch").score).toBe(3);
  });

  it("scores keyword match from structured job JSON phrases against profile text", () => {
    const job: AtsJobInput = {
      parsedTitle: "Frontend Engineer",
      parsedDescription: null,
      parsedRequirements: null,
      parsedJson: {
        title: "Frontend Engineer",
        company: "Acme",
        location: "Remote",
        employmentType: "Full-time",
        seniority: "Mid",
        salary: null,
        summary: "Build product UI.",
        responsibilities: ["Own the checkout experience", "Mentor junior engineers"],
        requirements: { required: ["React"], preferred: ["GraphQL"] },
        skills: ["React", "TypeScript"],
        benefits: [],
        domain: ["e-commerce"],
        other: [],
      },
    };
    const material: AtsSubjectMaterial = {
      ...EMPTY_MATERIAL,
      skills: ["React", "TypeScript"],
      roleBullets: ["Owned the checkout experience end-to-end."],
      rawText: "React TypeScript checkout",
    };

    const criteria = computeDeterministicCriteria(material, job);
    const keywordMatch = byKey(criteria, "keywordMatch");
    expect(keywordMatch.score).toBeGreaterThan(0);
    expect(byKey(criteria, "requiredSkillsCoverage").score).toBeGreaterThan(0);
  });

  it("scores job title alignment via word overlap, not exact match", () => {
    const job: AtsJobInput = { ...EMPTY_JOB, parsedTitle: "Senior Frontend Engineer" };
    const material: AtsSubjectMaterial = { ...EMPTY_MATERIAL, roleTitles: ["Frontend Engineer"] };

    const criteria = computeDeterministicCriteria(material, job);
    const titleAlignment = byKey(criteria, "jobTitleAlignment");
    expect(titleAlignment.score).toBeGreaterThanOrEqual(2);
  });

  it("scores 0 job title alignment when there's no overlap at all", () => {
    const job: AtsJobInput = { ...EMPTY_JOB, parsedTitle: "Marketing Manager" };
    const material: AtsSubjectMaterial = { ...EMPTY_MATERIAL, roleTitles: ["Backend Engineer"] };

    const criteria = computeDeterministicCriteria(material, job);
    expect(byKey(criteria, "jobTitleAlignment").score).toBe(0);
  });

  it("scores required skills coverage by matching requirements against candidate skills", () => {
    const job: AtsJobInput = {
      ...EMPTY_JOB,
      parsedRequirements: ["React", "AWS", "Kubernetes", "Python"],
    };
    const material: AtsSubjectMaterial = { ...EMPTY_MATERIAL, skills: ["React", "AWS"] };

    const criteria = computeDeterministicCriteria(material, job);
    const coverage = byKey(criteria, "requiredSkillsCoverage");
    expect(coverage.score).toBe(scoreFromRatio(2 / 4));
  });

  it("detects standard section headings in raw text", () => {
    const material: AtsSubjectMaterial = {
      ...EMPTY_MATERIAL,
      rawText: "SUMMARY\nExperienced engineer.\n\nEXPERIENCE\nAcme Corp.\n\nEDUCATION\nBS CS.\n\nSKILLS\nReact.",
    };
    const criteria = computeDeterministicCriteria(material, EMPTY_JOB);
    expect(byKey(criteria, "standardSectionHeadings").score).toBe(3);
  });

  it("scores 0 standard section headings when none are present", () => {
    const material: AtsSubjectMaterial = { ...EMPTY_MATERIAL, rawText: "Just some free-form text with no structure." };
    const criteria = computeDeterministicCriteria(material, EMPTY_JOB);
    expect(byKey(criteria, "standardSectionHeadings").score).toBe(0);
  });

  it("scores experience depth & recency 3 when years meet the requirement and a role is recent", () => {
    const job: AtsJobInput = { ...EMPTY_JOB, parsedDescription: "Looking for 3+ years of experience." };
    const material: AtsSubjectMaterial = { ...EMPTY_MATERIAL, years: 5, roleDates: ["2022 - Present"] };
    const criteria = computeDeterministicCriteria(material, job);
    expect(byKey(criteria, "experienceDepthRecency").score).toBe(3);
  });

  it("scores experience depth & recency 0 when there's no experience at all", () => {
    const criteria = computeDeterministicCriteria(EMPTY_MATERIAL, EMPTY_JOB);
    expect(byKey(criteria, "experienceDepthRecency").score).toBe(0);
  });

  it("scores quantified achievements by the ratio of bullets containing a number/%/currency signal", () => {
    const material: AtsSubjectMaterial = {
      ...EMPTY_MATERIAL,
      roleBullets: [
        "Improved page load time by 30%.",
        "Led the frontend team.",
        "Grew revenue by $2M.",
        "Worked closely with design.",
      ],
    };
    const criteria = computeDeterministicCriteria(material, EMPTY_JOB);
    expect(byKey(criteria, "quantifiedAchievements").score).toBe(scoreFromRatio(2 / 4));
  });

  it("scores 0 quantified achievements when there are no bullets", () => {
    const criteria = computeDeterministicCriteria(EMPTY_MATERIAL, EMPTY_JOB);
    expect(byKey(criteria, "quantifiedAchievements").score).toBe(0);
  });
});

describe("hybridCriteriaFromSubscores", () => {
  it("maps and clamps the three LLM-rated subscores into criteria", () => {
    const criteria = hybridCriteriaFromSubscores({
      formattingCleanliness: 3,
      formattingDetail: "Clean layout.",
      educationMatch: -1,
      educationDetail: "No degree required.",
      certifications: 5,
      certificationsDetail: "Holds AWS cert.",
    });

    expect(criteria).toHaveLength(3);
    expect(criteria.find((c) => c.key === "formattingCleanliness")?.score).toBe(3);
    expect(criteria.find((c) => c.key === "educationMatch")?.score).toBe(0);
    expect(criteria.find((c) => c.key === "certifications")?.score).toBe(3);
  });
});

describe("combineAtsScore", () => {
  it("computes weighted totals, normalized score, band, and weak points", () => {
    const deterministic = computeDeterministicCriteria(EMPTY_MATERIAL, EMPTY_JOB); // all default to 3 (nothing to check) or 0 (no experience/bullets)
    const hybrid = hybridCriteriaFromSubscores({
      formattingCleanliness: 3,
      formattingDetail: "n/a",
      educationMatch: 3,
      educationDetail: "n/a",
      certifications: 3,
      certificationsDetail: "n/a",
    });

    const breakdown = combineAtsScore(deterministic, hybrid);
    expect(breakdown.criteria).toHaveLength(9);
    expect(breakdown.maxPoints).toBe(57);
    expect(breakdown.totalPoints).toBe(
      breakdown.criteria.reduce((sum, c) => sum + c.score * c.weight, 0)
    );
    expect(breakdown.normalizedScore).toBe(Math.round((breakdown.totalPoints / 57) * 100));
  });

  it("bands totalPoints correctly at the documented thresholds", () => {
    const strong = combineAtsScore(
      [{ key: "keywordMatch", label: "Keyword Match", score: 3, weight: 19, weighted: 57, detail: "" }],
      []
    );
    expect(strong.band).toBe("submission-ready");

    const middle = combineAtsScore(
      [{ key: "keywordMatch", label: "Keyword Match", score: 2, weight: 19, weighted: 38, detail: "" }],
      []
    );
    expect(middle.band).toBe("needs-tailoring");

    const weak = combineAtsScore(
      [{ key: "keywordMatch", label: "Keyword Match", score: 1, weight: 19, weighted: 19, detail: "" }],
      []
    );
    expect(weak.band).toBe("weak-match");
  });

  it("flags any criterion scoring 0 or 1 as a weak point", () => {
    const deterministic = [
      { key: "keywordMatch" as const, label: "Keyword Match", score: 1 as const, weight: 3, weighted: 3, detail: "weak" },
      { key: "jobTitleAlignment" as const, label: "Job Title Alignment", score: 3 as const, weight: 3, weighted: 9, detail: "strong" },
    ];
    const breakdown = combineAtsScore(deterministic, []);
    expect(breakdown.weakPoints.map((c) => c.key)).toEqual(["keywordMatch"]);
  });
});

describe("buildWeakPointsPrompt", () => {
  it("states the real computed score and lists each weak point with guidance", () => {
    const deterministic = [
      {
        key: "quantifiedAchievements" as const,
        label: "Quantified Achievements",
        score: 1 as const,
        weight: 2,
        weighted: 2,
        detail: "1/4 bullets include a measurable outcome.",
      },
    ];
    const breakdown = combineAtsScore(deterministic, []);

    const prompt = buildWeakPointsPrompt(breakdown);

    expect(prompt).toContain(`${breakdown.normalizedScore}/100`);
    expect(prompt).toContain("Quantified Achievements (1/3)");
    expect(prompt).toContain("1/4 bullets include a measurable outcome.");
    expect(prompt).toContain("never invent");
  });

  it("switches calibration tone based on whether the real score is >= 60", () => {
    const strongBreakdown = combineAtsScore(
      [{ key: "keywordMatch" as const, label: "Keyword Match", score: 3 as const, weight: 19, weighted: 57, detail: "" }],
      []
    );
    const weakBreakdown = combineAtsScore(
      [{ key: "keywordMatch" as const, label: "Keyword Match", score: 0 as const, weight: 19, weighted: 0, detail: "" }],
      []
    );

    expect(buildWeakPointsPrompt(strongBreakdown)).toContain("already a strong fit");
    expect(buildWeakPointsPrompt(weakBreakdown)).toContain("gap is real");
  });

  it("says there are no weak points when every criterion is at least a 2", () => {
    const breakdown = combineAtsScore(
      [{ key: "keywordMatch" as const, label: "Keyword Match", score: 2 as const, weight: 19, weighted: 38, detail: "" }],
      []
    );
    expect(buildWeakPointsPrompt(breakdown)).toContain("None — every scored criterion is already at least a 2/3.");
  });
});

describe("materialFromProfile", () => {
  it("normalizes an AggregatedProfile + raw CV texts into subject material", () => {
    const profile: AggregatedProfile = {
      identity: { headline: "Senior Engineer", tags: [], location: null },
      roles: [
        {
          title: "Engineer",
          company: "Acme",
          dates: "2021-present",
          flag: "complete",
          bullets: [{ text: "Shipped a feature used by 10k users.", source: "resume.pdf" }],
        },
      ],
      skills: [{ label: "React", evidenceCount: 1 }],
      education: [],
      certifications: [],
      projects: [],
      other: [],
      completion: 100,
      gapNote: "",
      years: 5,
    };
    const cvRawTexts: CvRawText[] = [{ fileName: "resume.pdf", extractedText: "EXPERIENCE\nEngineer at Acme." }];

    const material = materialFromProfile(profile, cvRawTexts);

    expect(material.headline).toBe("Senior Engineer");
    expect(material.roleTitles).toEqual(["Engineer"]);
    expect(material.skills).toEqual(["React"]);
    expect(material.roleBullets).toEqual(["Shipped a feature used by 10k users."]);
    expect(material.years).toBe(5);
    expect(material.rawText).toContain("EXPERIENCE");
  });
});

describe("materialFromTailoredCv", () => {
  it("normalizes a TailoredCv into subject material, threading years through from the profile", () => {
    const cv: TailoredCv = {
      headline: "Senior Frontend Engineer",
      summary: "Summary.",
      location: "Remote",
      website: "example.com",
      github: "github.com/example",
      skills: [{ category: "Frontend", items: ["React", "TypeScript"] }],
      experience: [
        {
          title: "Engineer",
          company: "Acme",
          dates: "2021-Present",
          context: "Owned the core product surface.",
          bullets: ["Shipped a feature."],
        },
      ],
      projects: [],
      education: [{ degree: "BSc Computer Science", institution: "State University", dates: "2015-2019" }],
    };

    const material = materialFromTailoredCv(cv, 5);

    expect(material.headline).toBe("Senior Frontend Engineer");
    expect(material.roleTitles).toEqual(["Engineer"]);
    expect(material.skills).toEqual(["React", "TypeScript"]);
    expect(material.roleBullets).toEqual(["Shipped a feature."]);
    expect(material.years).toBe(5);
    expect(material.rawText).toContain("Experience");
    expect(material.rawText).toContain("Skills");
    expect(material.rawText).toContain("Education");
  });
});
