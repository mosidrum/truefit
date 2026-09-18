import { describe, expect, it, vi, beforeEach } from "vitest";

const responsesCreateMock = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: { create: responsesCreateMock },
  })),
}));

const {
  parseResumeText,
  parseJobDescription,
  generateTailoring,
  scoreAtsSubcriteria,
  OPENAI_MODEL,
} = await import("@/lib/openai");

describe("OPENAI_MODEL", () => {
  it("defaults to gpt-4o-mini when unset", () => {
    expect(OPENAI_MODEL).toBe("gpt-4o-mini");
  });
});

describe("parseResumeText", () => {
  beforeEach(() => {
    responsesCreateMock.mockReset();
  });

  it("sends the resume text and parses the structured JSON response", async () => {
    const parsed = {
      headline: "Frontend Engineer",
      location: "Remote",
      yearsOfExperience: 4,
      skills: ["React", "TypeScript"],
      roles: [{ title: "Engineer", company: "Acme", dates: "2021-present", bullets: ["Built things."] }],
    };
    responsesCreateMock.mockResolvedValue({ output_text: JSON.stringify(parsed) });

    const result = await parseResumeText("Some raw resume text.");

    expect(result).toEqual(parsed);
    const callArgs = responsesCreateMock.mock.calls[0][0];
    expect(callArgs.model).toBe(OPENAI_MODEL);
    expect(callArgs.text.format.type).toBe("json_schema");
    expect(callArgs.text.format.strict).toBe(true);
    expect(callArgs.input[1].content).toContain("Some raw resume text.");
  });

  it("truncates very long input to 20000 characters", async () => {
    responsesCreateMock.mockResolvedValue({
      output_text: JSON.stringify({
        headline: null,
        location: null,
        yearsOfExperience: null,
        skills: [],
        roles: [],
      }),
    });

    const longText = "a".repeat(30000);
    await parseResumeText(longText);

    const callArgs = responsesCreateMock.mock.calls[0][0];
    expect(callArgs.input[1].content.length).toBe(20000);
  });
});

describe("parseJobDescription", () => {
  beforeEach(() => {
    responsesCreateMock.mockReset();
  });

  it("sends the job page text and parses the structured JSON response", async () => {
    const parsed = {
      title: "Frontend Engineer",
      company: "Acme",
      location: "Remote",
      description: "Build UIs.",
      requirements: ["React", "3+ years experience"],
    };
    responsesCreateMock.mockResolvedValue({ output_text: JSON.stringify(parsed) });

    const result = await parseJobDescription("Some raw job page text.");

    expect(result).toEqual(parsed);
    const callArgs = responsesCreateMock.mock.calls[0][0];
    expect(callArgs.text.format.name).toBe("job_extraction");
    expect(callArgs.input[1].content).toContain("Some raw job page text.");
  });
});

const ATS_SUBSCORES_FIXTURE = {
  formattingCleanliness: 3,
  formattingDetail: "Clean, standard layout.",
  educationMatch: 3,
  educationDetail: "No education requirement stated.",
  certifications: 3,
  certificationsDetail: "No certification requirement stated.",
};

describe("generateTailoring", () => {
  beforeEach(() => {
    responsesCreateMock.mockReset();
  });

  it("combines jobText, candidateText, and weakPointsPrompt into the request and parses the result", async () => {
    const generation = {
      tailoredCv: {
        headline: "Frontend Engineer",
        summary: "Summary.",
        location: "Remote",
        website: "",
        github: "",
        skills: [{ category: "Frontend", items: ["React"] }],
        experience: [],
        projects: [],
        education: [],
      },
      coverLetter: "Dear hiring manager...",
      whatChanged: [{ item: "Surfaced React ownership", justification: "Bullet 3 of CV.", category: "surfaced" }],
      insights: { atsSubscores: ATS_SUBSCORES_FIXTURE, keywordsCovered: ["React"], unmetRequirement: null },
    };
    responsesCreateMock.mockResolvedValue({ output_text: JSON.stringify(generation) });

    const result = await generateTailoring({
      jobText: "JOB TEXT HERE",
      candidateText: "CANDIDATE TEXT HERE",
      weakPointsPrompt: "\n\nPRE-TAILORING FIT\nScore: 42/100.\n- Quantified Achievements (1/3): weak.",
    });

    expect(result).toEqual(generation);
    const callArgs = responsesCreateMock.mock.calls[0][0];
    expect(callArgs.model).toBe(OPENAI_MODEL);
    expect(callArgs.input[1].content).toContain("JOB TEXT HERE");
    expect(callArgs.input[1].content).toContain("CANDIDATE TEXT HERE");
    expect(callArgs.text.format.name).toBe("cv_tailoring");
    const systemContent = callArgs.input[0].content as string;
    expect(systemContent).toContain("PRE-TAILORING FIT");
    expect(systemContent).toContain("Quantified Achievements (1/3): weak.");
  });

  it("includes the truthfulness rules in the system prompt", async () => {
    responsesCreateMock.mockResolvedValue({
      output_text: JSON.stringify({
        tailoredCv: {
          headline: "",
          summary: "",
          location: "",
          website: "",
          github: "",
          skills: [],
          experience: [],
          projects: [],
          education: [],
        },
        coverLetter: "",
        whatChanged: [],
        insights: { atsSubscores: ATS_SUBSCORES_FIXTURE, keywordsCovered: [], unmetRequirement: null },
      }),
    });

    await generateTailoring({ jobText: "job", candidateText: "candidate", weakPointsPrompt: "" });

    const systemContent = responsesCreateMock.mock.calls[0][0].input[0].content as string;
    expect(systemContent).toContain("never invent");
    expect(systemContent).toContain("Contact fields");
    expect(systemContent).toContain("Project dates");
  });
});

describe("scoreAtsSubcriteria", () => {
  beforeEach(() => {
    responsesCreateMock.mockReset();
  });

  it("sends jobText/candidateText and parses the three rubric subscores", async () => {
    responsesCreateMock.mockResolvedValue({ output_text: JSON.stringify(ATS_SUBSCORES_FIXTURE) });

    const result = await scoreAtsSubcriteria({ jobText: "JOB TEXT", candidateText: "CANDIDATE TEXT" });

    expect(result).toEqual(ATS_SUBSCORES_FIXTURE);
    const callArgs = responsesCreateMock.mock.calls[0][0];
    expect(callArgs.text.format.name).toBe("ats_subscores");
    expect(callArgs.input[1].content).toContain("JOB TEXT");
    expect(callArgs.input[1].content).toContain("CANDIDATE TEXT");
    const systemContent = callArgs.input[0].content as string;
    expect(systemContent).toContain("formattingCleanliness");
    expect(systemContent).toContain("educationMatch");
    expect(systemContent).toContain("certifications");
  });
});
