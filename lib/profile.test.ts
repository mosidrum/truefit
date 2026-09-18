import { describe, expect, it, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { cv: { findMany: findManyMock } },
}));

const { buildProfileFromCvs } = await import("@/lib/profile");

describe("buildProfileFromCvs", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("returns the empty profile when the user has no CVs", async () => {
    findManyMock.mockResolvedValue([]);

    const profile = await buildProfileFromCvs("user-1");

    expect(profile).toEqual({
      identity: { headline: "", tags: [] },
      roles: [],
      skills: [],
      completion: 0,
      gapNote: "Upload a CV to start building your record.",
      years: null,
    });
  });

  it("scores a fully complete profile at 100", async () => {
    findManyMock.mockResolvedValue([
      {
        fileName: "resume.pdf",
        parsedHeadline: "Senior Engineer",
        parsedLocation: "Remote",
        parsedYears: 6,
        parsedSkills: ["React", "TypeScript"],
        parsedRoles: [
          {
            title: "Engineer",
            company: "Acme",
            dates: "2021-present",
            bullets: ["Shipped a feature used by 10k users."],
          },
        ],
      },
    ]);

    const profile = await buildProfileFromCvs("user-1");

    expect(profile.completion).toBe(100);
    expect(profile.identity).toEqual({ headline: "Senior Engineer", tags: ["6 yrs experience", "Remote"] });
    expect(profile.years).toBe(6);
    expect(profile.roles).toHaveLength(1);
    expect(profile.roles[0].flag).toBe("complete");
    expect(profile.gapNote).toBe("Every role has outcome numbers — nice work.");
  });

  it("flags a role with no numeric outcome as needs-numbers and lowers completion", async () => {
    findManyMock.mockResolvedValue([
      {
        fileName: "resume.pdf",
        parsedHeadline: "Engineer",
        parsedLocation: null,
        parsedYears: null,
        parsedSkills: ["React"],
        parsedRoles: [
          {
            title: "Engineer",
            company: "Acme",
            dates: "2021-present",
            bullets: ["Worked on the frontend."],
          },
        ],
      },
    ]);

    const profile = await buildProfileFromCvs("user-1");

    expect(profile.roles[0].flag).toBe("needs-numbers");
    // roleScore(0) * 70 + skills(15) + headline(15) = 30
    expect(profile.completion).toBe(30);
    expect(profile.gapNote).toBe("1 role missing outcome numbers.");
  });

  it("dedupes the same role across CVs by title+company (case-insensitive) and merges bullets", async () => {
    findManyMock.mockResolvedValue([
      {
        fileName: "resume-v1.pdf",
        parsedHeadline: "Engineer",
        parsedLocation: null,
        parsedYears: null,
        parsedSkills: [],
        parsedRoles: [
          { title: "Engineer", company: "Acme", dates: "2021-present", bullets: ["Worked on the frontend."] },
        ],
      },
      {
        fileName: "resume-v2.pdf",
        parsedHeadline: null,
        parsedLocation: null,
        parsedYears: null,
        parsedSkills: [],
        parsedRoles: [
          {
            title: "ENGINEER",
            company: "acme",
            dates: "2021-present",
            bullets: ["Worked on the frontend.", "Shipped a 20% faster page load."],
          },
        ],
      },
    ]);

    const profile = await buildProfileFromCvs("user-1");

    expect(profile.roles).toHaveLength(1);
    expect(profile.roles[0].bullets.map((b) => b.text)).toEqual([
      "Worked on the frontend.",
      "Shipped a 20% faster page load.",
    ]);
    // the second CV's bullet has a metric, so the merged role is complete.
    expect(profile.roles[0].flag).toBe("complete");
  });

  it("dedupes skills case-insensitively, keeping the first-seen label", async () => {
    findManyMock.mockResolvedValue([
      {
        fileName: "resume.pdf",
        parsedHeadline: null,
        parsedLocation: null,
        parsedYears: null,
        parsedSkills: ["React", "react", " TypeScript "],
        parsedRoles: [],
      },
    ]);

    const profile = await buildProfileFromCvs("user-1");

    expect(profile.skills.map((s) => s.label)).toEqual(["React", "TypeScript"]);
  });

  it("counts skill evidence via whole-word matches against role bullets", async () => {
    findManyMock.mockResolvedValue([
      {
        fileName: "resume.pdf",
        parsedHeadline: null,
        parsedLocation: null,
        parsedYears: null,
        parsedSkills: ["React", "Go"],
        parsedRoles: [
          {
            title: "Engineer",
            company: "Acme",
            dates: "2021-present",
            bullets: ["Built React components.", "Used React again here.", "Wrote Golang services."],
          },
        ],
      },
    ]);

    const profile = await buildProfileFromCvs("user-1");

    const react = profile.skills.find((s) => s.label === "React");
    const go = profile.skills.find((s) => s.label === "Go");
    expect(react?.evidenceCount).toBe(2);
    // "Go" must not whole-word-match inside "Golang".
    expect(go?.evidenceCount).toBe(0);
  });
});
