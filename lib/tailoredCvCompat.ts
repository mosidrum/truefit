import type { TailoredCv, TailoringSkillGroup } from "@/lib/openai";

/**
 * Rows persisted before education/categorized-skills/experience-context/
 * contact/project-dates existed have the old JSON shape even though
 * TailoredCv now types the new fields as required. This coerces old rows
 * into the current shape so display code never has to special-case legacy data.
 */
export function normalizeTailoredCvForDisplay(cv: TailoredCv): TailoredCv {
  return {
    ...cv,
    location: cv.location ?? "",
    website: cv.website ?? "",
    github: cv.github ?? "",
    skills: normalizeSkills(cv.skills),
    experience: (cv.experience ?? []).map((entry) => ({ ...entry, context: entry.context ?? "" })),
    projects: (cv.projects ?? []).map((project) => ({ ...project, dates: project.dates ?? "" })),
    education: cv.education ?? [],
  };
}

/** Builds the resume contact line: Location | email | website | github (omit empties). */
export function formatContactLine(parts: {
  location?: string | null;
  email?: string | null;
  website?: string | null;
  github?: string | null;
}): string {
  return [parts.location, parts.email, parts.website, parts.github]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" | ");
}

/** Experience header line: `Company, Title`. */
export function formatExperienceHeader(company: string, title: string): string {
  return [company.trim(), title.trim()].filter(Boolean).join(", ");
}

/** Experience meta line: `Dates | context` (omit empty halves). */
export function formatExperienceMeta(dates: string, context: string): string {
  return [dates.trim(), context.trim()].filter(Boolean).join(" | ");
}

/** Project header line: `Name (dates), description` (omit missing pieces gracefully). */
export function formatProjectHeader(name: string, dates: string, description: string): string {
  const trimmedName = name.trim();
  const trimmedDates = dates.trim();
  const trimmedDescription = description.trim();
  const nameWithDates = trimmedDates ? `${trimmedName} (${trimmedDates})` : trimmedName;
  if (!trimmedDescription) return nameWithDates;
  if (!nameWithDates) return trimmedDescription;
  return `${nameWithDates}, ${trimmedDescription}`;
}

/** Education line: `Degree – Institution (dates)`. */
export function formatEducationLine(degree: string, institution: string, dates: string): string {
  const head = [degree.trim(), institution.trim()].filter(Boolean).join(" – ");
  const trimmedDates = dates.trim();
  if (!trimmedDates) return head;
  if (!head) return trimmedDates;
  return `${head} (${trimmedDates})`;
}

function normalizeSkills(skills: TailoredCv["skills"] | string[] | undefined): TailoringSkillGroup[] {
  if (!skills) return [];
  if (skills.length > 0 && typeof skills[0] === "string") {
    return [{ category: "Skills", items: skills as unknown as string[] }];
  }
  return skills as TailoringSkillGroup[];
}
