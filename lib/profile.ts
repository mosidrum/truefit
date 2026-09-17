import { prisma } from "@/lib/prisma";
import type { ParsedResumeRole } from "@/lib/openai";

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
};

export type AggregatedProfile = {
  identity: ProfileIdentity;
  roles: Role[];
  skills: Skill[];
  completion: number;
  gapNote: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMPTY_PROFILE: AggregatedProfile = {
  identity: { headline: "", tags: [] },
  roles: [],
  skills: [],
  completion: 0,
  gapNote: "Upload a CV to start building your record.",
};

/** Aggregates structured data parsed from every CV a user has uploaded into one profile. */
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
    },
  });

  if (cvs.length === 0) return EMPTY_PROFILE;

  let headline: string | null = null;
  let location: string | null = null;
  let years: number | null = null;
  const roleOrder: string[] = [];
  const roleByKey = new Map<string, Role>();
  const skillLabelByKey = new Map<string, string>();

  for (const cv of cvs) {
    if (!headline && cv.parsedHeadline) headline = cv.parsedHeadline;
    if (!location && cv.parsedLocation) location = cv.parsedLocation;
    if (years == null && cv.parsedYears != null) years = cv.parsedYears;

    const parsedSkills = (cv.parsedSkills as string[] | null) ?? [];
    for (const raw of parsedSkills) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (!skillLabelByKey.has(key)) skillLabelByKey.set(key, label);
    }

    const parsedRoles = (cv.parsedRoles as ParsedResumeRole[] | null) ?? [];
    for (const role of parsedRoles) {
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
    identity: { headline: headline ?? "", tags },
    roles,
    skills,
    completion: Math.min(completion, 100),
    gapNote,
  };
}
