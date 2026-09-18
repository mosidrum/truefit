import { describe, expect, it } from "vitest";
import type { TailoredCv } from "@/lib/openai";
import {
  formatContactLine,
  formatEducationLine,
  formatExperienceHeader,
  formatExperienceMeta,
  formatProjectHeader,
  normalizeTailoredCvForDisplay,
} from "@/lib/tailoredCvCompat";

describe("normalizeTailoredCvForDisplay", () => {
  it("fills missing contact/project-date fields and coerces legacy flat skills", () => {
    const legacy = {
      headline: "Engineer",
      summary: "Summary.",
      skills: ["React", "TypeScript"],
      experience: [{ title: "Eng", company: "Acme", dates: "2020", bullets: ["Shipped."] }],
      projects: [{ name: "App", description: "A product.", bullets: [] }],
    } as unknown as TailoredCv;

    const normalized = normalizeTailoredCvForDisplay(legacy);

    expect(normalized.location).toBe("");
    expect(normalized.website).toBe("");
    expect(normalized.github).toBe("");
    expect(normalized.skills).toEqual([{ category: "Skills", items: ["React", "TypeScript"] }]);
    expect(normalized.experience[0].context).toBe("");
    expect(normalized.projects[0].dates).toBe("");
    expect(normalized.education).toEqual([]);
  });
});

describe("resume line formatters", () => {
  it("builds the contact line omitting empty parts", () => {
    expect(
      formatContactLine({
        location: "Nigeria (UTC+1)",
        email: "a@b.com",
        website: "example.com",
        github: "github.com/user",
      })
    ).toBe("Nigeria (UTC+1) | a@b.com | example.com | github.com/user");

    expect(formatContactLine({ email: "a@b.com", website: "", github: null })).toBe("a@b.com");
  });

  it("formats experience as Company, Title and Dates | context", () => {
    expect(formatExperienceHeader("IOG", "Senior Software Engineer")).toBe(
      "IOG, Senior Software Engineer"
    );
    expect(formatExperienceMeta("May 2022 to July 2026", "Core contributor to Lace")).toBe(
      "May 2022 to July 2026 | Core contributor to Lace"
    );
  });

  it("formats projects as Name (dates), description", () => {
    expect(
      formatProjectHeader("Relaystack", "2026 to present", "an AI execution platform")
    ).toBe("Relaystack (2026 to present), an AI execution platform");

    expect(formatProjectHeader("Lampstand", "", "a reading app")).toBe("Lampstand, a reading app");
  });

  it("formats education as Degree – Institution (dates)", () => {
    expect(
      formatEducationLine("MSc. Computer Science", "University of East London, UK", "2021 – 2023")
    ).toBe("MSc. Computer Science – University of East London, UK (2021 – 2023)");
  });
});
