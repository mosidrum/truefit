import { describe, expect, it, vi, beforeEach } from "vitest";

const findFirstMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();
const getCvRawTextsForUserMock = vi.fn();
const getJobPostForTailoringMock = vi.fn();
const buildProfileFromCvsMock = vi.fn();
const generateTailoringMock = vi.fn();
const scoreAtsSubcriteriaMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tailoring: {
      findFirst: findFirstMock,
      upsert: upsertMock,
      deleteMany: deleteManyMock,
    },
  },
}));
vi.mock("@/lib/cvs", () => ({ getCvRawTextsForUser: getCvRawTextsForUserMock }));
vi.mock("@/lib/jobs", () => ({ getJobPostForTailoring: getJobPostForTailoringMock }));
vi.mock("@/lib/profile", () => ({ buildProfileFromCvs: buildProfileFromCvsMock }));
vi.mock("@/lib/openai", () => ({
  generateTailoring: generateTailoringMock,
  scoreAtsSubcriteria: scoreAtsSubcriteriaMock,
  OPENAI_MODEL: "gpt-4o-mini",
}));

const { getOrGenerateTailoring } = await import("@/lib/tailoring");

const PROFILE = {
  identity: { headline: "Senior Engineer", tags: [] },
  roles: [
    {
      title: "Engineer",
      company: "Acme",
      dates: "2021-Present",
      flag: "complete" as const,
      bullets: [{ text: "Shipped a feature used by 10k users.", source: "resume.pdf" }],
    },
  ],
  skills: [{ label: "React", evidenceCount: 1 }],
  completion: 100,
  gapNote: "",
  years: 5,
};

const CV_RAW_TEXTS = [{ fileName: "resume.pdf", extractedText: "EXPERIENCE\nEngineer at Acme.\nSKILLS\nReact." }];

const JOB = {
  id: "job-1",
  parsedTitle: "Senior Frontend Engineer",
  parsedCompany: "Globex",
  parsedLocation: "Remote",
  parsedDescription: "Build React applications.",
  parsedRequirements: ["React"],
  rawText: "Full job posting text.",
};

const HYBRID_SUBSCORES = {
  formattingCleanliness: 3,
  formattingDetail: "Clean.",
  educationMatch: 3,
  educationDetail: "n/a",
  certifications: 3,
  certificationsDetail: "n/a",
};

const TAILORED_CV = {
  headline: "Senior Frontend Engineer",
  summary: "Summary.",
  location: "Remote",
  website: "example.com",
  github: "github.com/example",
  skills: [{ category: "Frontend", items: ["React"] }],
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
  education: [],
};

describe("getOrGenerateTailoring", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    upsertMock.mockReset();
    deleteManyMock.mockReset();
    getCvRawTextsForUserMock.mockReset();
    getJobPostForTailoringMock.mockReset();
    buildProfileFromCvsMock.mockReset();
    generateTailoringMock.mockReset();
    scoreAtsSubcriteriaMock.mockReset();
  });

  it("returns the existing record without generating anything when tailoring already exists", async () => {
    findFirstMock.mockResolvedValue({
      id: "t1",
      jobPostId: "job-1",
      model: "gpt-4o-mini",
      tailoredCv: TAILORED_CV,
      coverLetter: "Dear hiring manager...",
      whatChanged: [],
      preTailoringMatchScore: 50,
      preTailoringBreakdown: { criteria: [], totalPoints: 0, maxPoints: 57, normalizedScore: 50, band: "needs-tailoring", weakPoints: [] },
      atsScore: 80,
      atsScoreBreakdown: { criteria: [], totalPoints: 0, maxPoints: 57, normalizedScore: 80, band: "submission-ready", weakPoints: [] },
      keywordsCovered: [],
      unmetRequirement: null,
      createdAt: new Date(),
    });

    const { record, generated } = await getOrGenerateTailoring("user-1", "job-1");

    expect(generated).toBe(false);
    expect(record.atsScore).toBe(80);
    expect(getJobPostForTailoringMock).not.toHaveBeenCalled();
    expect(generateTailoringMock).not.toHaveBeenCalled();
  });

  it("passes through a null breakdown for tailoring generated before breakdowns existed, without crashing", async () => {
    findFirstMock.mockResolvedValue({
      id: "t1",
      jobPostId: "job-1",
      model: "gpt-4o-mini",
      tailoredCv: TAILORED_CV,
      coverLetter: "Dear hiring manager...",
      whatChanged: [],
      preTailoringMatchScore: 65,
      preTailoringBreakdown: null,
      atsScore: 90,
      atsScoreBreakdown: null,
      keywordsCovered: [],
      unmetRequirement: null,
      createdAt: new Date(),
    });

    const { record } = await getOrGenerateTailoring("user-1", "job-1");

    expect(record.preTailoringBreakdown).toBeNull();
    expect(record.atsScoreBreakdown).toBeNull();
  });

  it("throws when the job post doesn't belong to the user / doesn't exist", async () => {
    findFirstMock.mockResolvedValue(null);
    getJobPostForTailoringMock.mockResolvedValue(null);

    await expect(getOrGenerateTailoring("user-1", "job-1")).rejects.toThrow("Job posting not found.");
  });

  it("throws when the user has no CVs uploaded", async () => {
    findFirstMock.mockResolvedValue(null);
    getJobPostForTailoringMock.mockResolvedValue(JOB);
    buildProfileFromCvsMock.mockResolvedValue(PROFILE);
    getCvRawTextsForUserMock.mockResolvedValue([]);

    await expect(getOrGenerateTailoring("user-1", "job-1")).rejects.toThrow(
      "Upload a CV before tailoring can be generated."
    );
  });

  it("computes independent pre/post score breakdowns, derives the weak-points prompt from the real pre-score, and persists both", async () => {
    findFirstMock.mockResolvedValue(null);
    getJobPostForTailoringMock.mockResolvedValue(JOB);
    buildProfileFromCvsMock.mockResolvedValue(PROFILE);
    getCvRawTextsForUserMock.mockResolvedValue(CV_RAW_TEXTS);
    scoreAtsSubcriteriaMock.mockResolvedValue(HYBRID_SUBSCORES);
    // Summary echoes the job's real keywords and the bullet keeps its
    // quantified metric, so every criterion scores well and the correction
    // retry pass never fires — that behavior is covered by its own test below.
    generateTailoringMock.mockResolvedValue({
      tailoredCv: {
        ...TAILORED_CV,
        summary: "Senior Frontend Engineer who used React to build applications.",
        experience: [
          {
            title: "Engineer",
            company: "Acme",
            dates: "2021-Present",
            context: "Owned the core product surface.",
            bullets: ["Shipped a feature used by 10k users."],
          },
        ],
      },
      coverLetter: "Dear hiring manager...",
      whatChanged: [],
      insights: { atsSubscores: HYBRID_SUBSCORES, keywordsCovered: ["React"], unmetRequirement: null },
    });
    upsertMock.mockImplementation(({ create }) => ({
      id: "t1",
      jobPostId: "job-1",
      createdAt: new Date(),
      ...create,
    }));

    const { record, generated } = await getOrGenerateTailoring("user-1", "job-1");

    expect(generated).toBe(true);

    // scoreAtsSubcriteria ran before generateTailoring (pre-score must exist to build the weak-points prompt).
    expect(scoreAtsSubcriteriaMock).toHaveBeenCalledTimes(1);
    expect(generateTailoringMock).toHaveBeenCalledTimes(1);

    const generateArgs = generateTailoringMock.mock.calls[0][0];
    expect(generateArgs.weakPointsPrompt).toContain("PRE-TAILORING FIT");
    expect(generateArgs.weakPointsPrompt).toContain(`${record.preTailoringMatchScore}/100`);
    expect(generateArgs.candidateText).toContain("CANDIDATE SOURCE POOL");
    expect(generateArgs.candidateText).toContain("never share the same experience/achievement wording");

    // Both breakdowns landed on the record with all 9 criteria each (always
    // populated on a freshly-generated record, never null).
    expect(record.preTailoringBreakdown).not.toBeNull();
    expect(record.atsScoreBreakdown).not.toBeNull();
    expect(record.preTailoringBreakdown!.criteria).toHaveLength(9);
    expect(record.atsScoreBreakdown!.criteria).toHaveLength(9);
    expect(record.preTailoringMatchScore).toBe(record.preTailoringBreakdown!.normalizedScore);
    expect(record.atsScore).toBe(record.atsScoreBreakdown!.normalizedScore);

    // Persisted via upsert with both breakdowns.
    const upsertArgs = upsertMock.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ jobPostId: "job-1" });
    expect(upsertArgs.create.preTailoringMatchScore).toBe(record.preTailoringMatchScore);
    expect(upsertArgs.create.preTailoringBreakdown).toEqual(record.preTailoringBreakdown);
    expect(upsertArgs.create.atsScore).toBe(record.atsScore);
    expect(upsertArgs.create.atsScoreBreakdown).toEqual(record.atsScoreBreakdown);
    expect(upsertArgs.create.keywordsCovered).toEqual(["React"]);
  });

  it("re-generates once when the tailored output still has fixable weak points, and keeps the higher-scoring attempt", async () => {
    findFirstMock.mockResolvedValue(null);
    getJobPostForTailoringMock.mockResolvedValue(JOB);
    buildProfileFromCvsMock.mockResolvedValue(PROFILE);
    getCvRawTextsForUserMock.mockResolvedValue(CV_RAW_TEXTS);
    scoreAtsSubcriteriaMock.mockResolvedValue(HYBRID_SUBSCORES);

    // First attempt drops the real metric ("Shipped a feature.") -> weak,
    // fixable quantifiedAchievements score. Second attempt truthfully
    // restores it -> should be kept as the final, persisted result.
    const weakAttempt = {
      tailoredCv: TAILORED_CV,
      coverLetter: "Dear hiring manager, draft one...",
      whatChanged: [],
      insights: { atsSubscores: HYBRID_SUBSCORES, keywordsCovered: ["React"], unmetRequirement: null },
    };
    const correctedAttempt = {
      tailoredCv: {
        ...TAILORED_CV,
        experience: [
          {
            title: "Engineer",
            company: "Acme",
            dates: "2021-Present",
            context: "Owned the core product surface.",
            bullets: ["Shipped a feature used by 10k users."],
          },
        ],
      },
      coverLetter: "Dear hiring manager, draft two...",
      whatChanged: [],
      insights: { atsSubscores: HYBRID_SUBSCORES, keywordsCovered: ["React"], unmetRequirement: null },
    };
    generateTailoringMock.mockResolvedValueOnce(weakAttempt).mockResolvedValueOnce(correctedAttempt);
    upsertMock.mockImplementation(({ create }) => ({
      id: "t1",
      jobPostId: "job-1",
      createdAt: new Date(),
      ...create,
    }));

    const { record } = await getOrGenerateTailoring("user-1", "job-1");

    expect(generateTailoringMock).toHaveBeenCalledTimes(2);

    // Second call's prompt calls out the specific weak point from the first attempt.
    const secondCallArgs = generateTailoringMock.mock.calls[1][0];
    expect(secondCallArgs.weakPointsPrompt).toContain("SECOND PASS — CLOSE REMAINING GAPS");
    expect(secondCallArgs.weakPointsPrompt).toContain("Quantified Achievements");

    // The corrected (higher-scoring) attempt is what got persisted.
    expect(record.coverLetter).toBe("Dear hiring manager, draft two...");
    expect(record.tailoredCv.experience[0].bullets[0]).toContain("10k users");
  });

  it("force-deletes an existing row, regenerates, and threads additionalContext into candidateText", async () => {
    findFirstMock.mockResolvedValue(null);
    deleteManyMock.mockResolvedValue({ count: 1 });
    getJobPostForTailoringMock.mockResolvedValue(JOB);
    buildProfileFromCvsMock.mockResolvedValue(PROFILE);
    getCvRawTextsForUserMock.mockResolvedValue(CV_RAW_TEXTS);
    scoreAtsSubcriteriaMock.mockResolvedValue(HYBRID_SUBSCORES);
    generateTailoringMock.mockResolvedValue({
      tailoredCv: {
        ...TAILORED_CV,
        summary: "Senior Frontend Engineer who used React to build applications.",
        experience: [
          {
            title: "Engineer",
            company: "Acme",
            dates: "2021-Present",
            context: "Owned the core product surface.",
            bullets: ["Shipped a feature used by 10k users."],
          },
        ],
      },
      coverLetter: "Dear hiring manager...",
      whatChanged: [],
      insights: { atsSubscores: HYBRID_SUBSCORES, keywordsCovered: ["React"], unmetRequirement: null },
    });
    upsertMock.mockImplementation(({ create }) => ({
      id: "t2",
      jobPostId: "job-1",
      createdAt: new Date(),
      ...create,
    }));

    const { generated } = await getOrGenerateTailoring("user-1", "job-1", {
      force: true,
      additionalContext: "Gap: AWS experience.\nI ran production workloads on AWS for 2 years.",
    });

    expect(generated).toBe(true);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { jobPostId: "job-1", userId: "user-1" },
    });
    expect(findFirstMock).not.toHaveBeenCalled();
    const generateArgs = generateTailoringMock.mock.calls[0][0];
    expect(generateArgs.candidateText).toContain("ADDITIONAL INFORMATION");
    expect(generateArgs.candidateText).toContain("AWS for 2 years");
  });
});
