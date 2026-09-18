import { describe, expect, it } from "vitest";
import type { TailoredCv } from "@/lib/openai";
import { renderTailoredCvPdf } from "@/lib/cvPdf";

const SAMPLE_CV: TailoredCv = {
  headline: "Senior Software Engineer",
  summary:
    "Senior engineer, 9 years, shipping production software with React and TypeScript.",
  location: "Nigeria (UTC+1)",
  website: "johnoshalusi.com",
  github: "github.com/greatertomi",
  skills: [
    { category: "Languages", items: ["TypeScript", "JavaScript", "Python", "Go"] },
    { category: "Frontend", items: ["React", "Next.js"] },
  ],
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Input Output Group (IOG)",
      dates: "May 2022 to July 2026",
      context: "Core contributor to Lace, an open-source Cardano wallet",
      bullets: [
        "Owned five customer-facing flows end to end across React and TypeScript.",
        "Cut extension cold start from 10s to 2s.",
      ],
    },
  ],
  projects: [
    {
      name: "Relaystack",
      dates: "2026 to present",
      description: "an AI execution platform for multi-step workflows",
      bullets: ["Built and shipped Social Growth Manager to public beta."],
    },
  ],
  education: [
    {
      degree: "MSc. Computer Science",
      institution: "University of East London, UK",
      dates: "2021 – 2023",
    },
  ],
};

describe("renderTailoredCvPdf", () => {
  it("renders a PDF whose text follows the template section order and line formats", async () => {
    const buffer = await renderTailoredCvPdf({
      tailoredCv: SAMPLE_CV,
      candidateName: "John Oshalusi",
      candidateEmail: "oshalusijohn@gmail.com",
      jobTitle: "Senior Software Engineer",
      company: "Example",
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const text = result.text.replace(/\s+/g, " ");

    expect(text).toContain("John Oshalusi");
    expect(text).toContain("Senior Software Engineer");
    expect(text).toContain("Nigeria (UTC+1)");
    expect(text).toContain("oshalusijohn@gmail.com");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("EXPERIENCE");
    expect(text).toContain("Input Output Group (IOG), Senior Software Engineer");
    expect(text).toContain("May 2022 to July 2026 | Core contributor to Lace");
    expect(text).toContain("PROJECTS");
    expect(text).toContain("Relaystack (2026 to present)");
    expect(text).toContain("SKILLS");
    expect(text).toContain("Languages: TypeScript, JavaScript, Python, Go");
    expect(text).toContain("EDUCATION");
    expect(text).toContain("MSc. Computer Science – University of East London, UK (2021 – 2023)");

    const summaryAt = text.indexOf("SUMMARY");
    const experienceAt = text.indexOf("EXPERIENCE");
    const projectsAt = text.indexOf("PROJECTS");
    const skillsAt = text.indexOf("SKILLS");
    const educationAt = text.indexOf("EDUCATION");
    expect(summaryAt).toBeGreaterThan(-1);
    expect(experienceAt).toBeGreaterThan(summaryAt);
    expect(projectsAt).toBeGreaterThan(experienceAt);
    expect(skillsAt).toBeGreaterThan(projectsAt);
    expect(educationAt).toBeGreaterThan(skillsAt);
  }, 30_000);
});
