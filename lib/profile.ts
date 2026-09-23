import { prisma } from "@/lib/prisma";
import type {
  ParsedOtherEntry,
  ParsedResume,
  ParsedResumeEducation,
  ParsedResumeProject,
  ParsedResumeRole,
} from "@/lib/openai";

export type RoleFlag = "complete" | "needs-numbers";

export type RoleBullet = {
  text: string;
  source: string;
};

export type Role = {
  title: string;
  company: string;
  dates: string;
  flag: RoleFlag;
  bullets: RoleBullet[];
};

export type Skill = {
  label: string;
  evidenceCount: number;
};

export type ProfileIdentity = {
  headline: string;
  tags: string[];
  location: string | null;
};

export type ProfileEducation = {
  degree: string;
  institution: string;
  dates: string;
};

export type ProfileProject = {
  name: string;
  description: string;
  bullets: string[];
};

/**
 * Richer profile JSON rebuilt from every uploaded CV.
 * Known keys are merged into typed fields; anything else lands in `other`.
 */
export type AggregatedProfile = {
  identity: ProfileIdentity;
  roles: Role[];
  skills: Skill[];
  education: ProfileEducation[];
  certifications: string[];
  projects: ProfileProject[];
  other: ParsedOtherEntry[];
  completion: number;
  gapNote: string;
  years: number | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMPTY_PROFILE: AggregatedProfile = {
  identity: { headline: "", tags: [], location: null },
  roles: [],
  skills: [],
  education: [],
  certifications: [],
  projects: [],
  other: [],
  completion: 0,
  gapNote: "Upload a CV to start building your record.",
  years: null,
};

function resumeFromCvRow(cv: {
  fileName: string;
  parsedHeadline: string | null;
  parsedLocation: string | null;
  parsedYears: number | null;
  parsedSkills: unknown;
  parsedRoles: unknown;
  parsedJson: unknown;
}): ParsedResume {
  const full = cv.parsedJson as ParsedResume | null;
  if (full && typeof full === "object" && Array.isArray(full.roles)) {
    return {
      headline: full.headline ?? cv.parsedHeadline,
      location: full.location ?? cv.parsedLocation,
      yearsOfExperience: full.yearsOfExperience ?? cv.parsedYears,
      skills: full.skills ?? ((cv.parsedSkills as string[] | null) ?? []),
      roles: full.roles,
      education: full.education ?? [],
      certifications: full.certifications ?? [],
      projects: full.projects ?? [],
      other: full.other ?? [],
    };
  }

  return {
    headline: cv.parsedHeadline,
    location: cv.parsedLocation,
    yearsOfExperience: cv.parsedYears,
    skills: (cv.parsedSkills as string[] | null) ?? [],
    roles: (cv.parsedRoles as ParsedResumeRole[] | null) ?? [],
    education: [],
    certifications: [],
    projects: [],
    other: [],
  };
}

function mergeOtherEntries(
  into: Map<string, { key: string; values: Set<string> }>,
  entries: ParsedOtherEntry[]
) {
  for (const entry of entries) {
    const keyLabel = entry.key.trim();
    const value = entry.value.trim();
    if (!keyLabel || !value) continue;
    const mapKey = keyLabel.toLowerCase();
    const existing = into.get(mapKey);
    if (existing) {
      existing.values.add(value);
    } else {
      into.set(mapKey, { key: keyLabel, values: new Set([value]) });
    }
  }
}

/** Aggregates structured data parsed from every CV a user has uploaded into one profile JSON. */
export async function buildProfileFromCvs(
  userId: string
): Promise<AggregatedProfile> {
  const cvs = await prisma.cv.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      fileName: true,
      parsedHeadline: true,
      parsedLocation: true,
      parsedYears: true,
      parsedSkills: true,
      parsedRoles: true,
      parsedJson: true,
    },
  });

  if (cvs.length === 0) return EMPTY_PROFILE;

  let headline: string | null = null;
  let location: string | null = null;
  let years: number | null = null;
  const roleOrder: string[] = [];
  const roleByKey = new Map<string, Role>();
  const skillLabelByKey = new Map<string, string>();
  const educationOrder: string[] = [];
  const educationByKey = new Map<string, ProfileEducation>();
  const certificationByKey = new Map<string, string>();
  const projectOrder: string[] = [];
  const projectByKey = new Map<string, ProfileProject>();
  const otherByKey = new Map<string, { key: string; values: Set<string> }>();

  for (const cv of cvs) {
    const resume = resumeFromCvRow(cv);

    if (!headline && resume.headline) headline = resume.headline;
    if (!location && resume.location) location = resume.location;
    if (years == null && resume.yearsOfExperience != null) {
      years = resume.yearsOfExperience;
    }

    for (const raw of resume.skills) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (!skillLabelByKey.has(key)) skillLabelByKey.set(key, label);
    }

    for (const role of resume.roles) {
      const key = `${role.title.trim().toLowerCase()}__${role.company
        .trim()
        .toLowerCase()}`;
      const hasMetric = role.bullets.some((b) => /\d/.test(b));
      const existing = roleByKey.get(key);

      if (!existing) {
        roleOrder.push(key);
        roleByKey.set(key, {
          title: role.title,
          company: role.company,
          dates: role.dates,
          flag: hasMetric ? "complete" : "needs-numbers",
          bullets: role.bullets.map((text) => ({ text, source: cv.fileName })),
        });
      } else {
        const existingTexts = new Set(existing.bullets.map((b) => b.text));
        for (const text of role.bullets) {
          if (!existingTexts.has(text)) {
            existing.bullets.push({ text, source: cv.fileName });
          }
        }
        if (hasMetric) existing.flag = "complete";
      }
    }

    for (const edu of resume.education as ParsedResumeEducation[]) {
      const key = `${edu.degree.trim().toLowerCase()}__${edu.institution
        .trim()
        .toLowerCase()}`;
      if (!educationByKey.has(key)) {
        educationOrder.push(key);
        educationByKey.set(key, {
          degree: edu.degree,
          institution: edu.institution,
          dates: edu.dates,
        });
      }
    }

    for (const cert of resume.certifications) {
      const label = cert.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (!certificationByKey.has(key)) certificationByKey.set(key, label);
    }

    for (const project of resume.projects as ParsedResumeProject[]) {
      const key = project.name.trim().toLowerCase();
      if (!key) continue;
      const existing = projectByKey.get(key);
      if (!existing) {
        projectOrder.push(key);
        projectByKey.set(key, {
          name: project.name,
          description: project.description,
          bullets: [...project.bullets],
        });
      } else {
        const existingBullets = new Set(existing.bullets);
        for (const bullet of project.bullets) {
          if (!existingBullets.has(bullet)) existing.bullets.push(bullet);
        }
        if (!existing.description && project.description) {
          existing.description = project.description;
        }
      }
    }

    mergeOtherEntries(otherByKey, resume.other);
  }

  const roles = roleOrder.map((key) => roleByKey.get(key)!);
  const allBulletText = roles.flatMap((r) => r.bullets.map((b) => b.text));

  const skills: Skill[] = [...skillLabelByKey.entries()]
    .map(([key, label]) => {
      const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, "i");
      const evidenceCount = allBulletText.filter((text) =>
        pattern.test(text)
      ).length;
      return { label, evidenceCount };
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount);

  const education = educationOrder.map((key) => educationByKey.get(key)!);
  const certifications = [...certificationByKey.values()];
  const projects = projectOrder.map((key) => projectByKey.get(key)!);
  const other: ParsedOtherEntry[] = [...otherByKey.values()].map(({ key, values }) => ({
    key,
    value: [...values].join("; "),
  }));

  const completeRoles = roles.filter((r) => r.flag === "complete").length;
  const roleScore = roles.length > 0 ? completeRoles / roles.length : 0;
  const completion = Math.round(
    roleScore * 70 + (skills.length > 0 ? 15 : 0) + (headline ? 15 : 0)
  );

  const missingCount = roles.length - completeRoles;
  const gapNote =
    roles.length === 0
      ? EMPTY_PROFILE.gapNote
      : missingCount === 0
        ? "Every role has outcome numbers — nice work."
        : `${missingCount} role${missingCount === 1 ? "" : "s"} missing outcome numbers.`;

  const tags = [
    years != null ? `${years} yrs experience` : null,
    location,
  ].filter((tag): tag is string => Boolean(tag));

  return {
    identity: { headline: headline ?? "", tags, location },
    roles,
    skills,
    education,
    certifications,
    projects,
    other,
    completion: Math.min(completion, 100),
    gapNote,
    years,
  };
}
