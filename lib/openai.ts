import OpenAI from "openai";
import {
  ATS_SUBSCORES_SYSTEM_PROMPT,
  JOB_EXTRACTION_SYSTEM_PROMPT,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/openaiInstructions";
import {
  CV_STYLE_RULES_PROMPT,
  TAILORING_OUTPUT_CONTRACT,
  TAILORING_SKILL_PROMPT,
} from "@/lib/tailoringSkill";

/** Overridable via env so models can be switched/compared without a code change. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export type ParsedResumeRole = {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
};

export type ParsedResumeEducation = {
  degree: string;
  institution: string;
  dates: string;
};

export type ParsedResumeProject = {
  name: string;
  description: string;
  bullets: string[];
};

export type ParsedOtherEntry = {
  key: string;
  value: string;
};

export type ParsedResume = {
  headline: string | null;
  location: string | null;
  yearsOfExperience: number | null;
  skills: string[];
  roles: ParsedResumeRole[];
  education: ParsedResumeEducation[];
  certifications: string[];
  projects: ParsedResumeProject[];
  other: ParsedOtherEntry[];
};

const OTHER_ENTRY_SCHEMA = {
  type: "object",
  properties: {
    key: { type: "string", description: "Short label for this extra detail." },
    value: { type: "string", description: "The detail as stated in the source text." },
  },
  required: ["key", "value"],
  additionalProperties: false,
} as const;

const RESUME_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: ["string", "null"], description: "Current or most recent job title." },
    location: { type: ["string", "null"], description: "City/region the candidate is based in." },
    yearsOfExperience: {
      type: ["number", "null"],
      description: "Total years of professional experience, estimated from the roles listed.",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Distinct skills, technologies, and tools mentioned in the document.",
    },
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          dates: { type: "string", description: "e.g. '2021 — present' or '2019 - 2021'." },
          bullets: {
            type: "array",
            items: { type: "string" },
            description: "Achievement/responsibility bullet points for this role, verbatim or lightly cleaned up.",
          },
        },
        required: ["title", "company", "dates", "bullets"],
        additionalProperties: false,
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" },
          institution: { type: "string" },
          dates: { type: "string" },
        },
        required: ["degree", "institution", "dates"],
        additionalProperties: false,
      },
      description: "Education entries from the resume.",
    },
    certifications: {
      type: "array",
      items: { type: "string" },
      description: "Certifications and licenses named in the resume.",
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "bullets"],
        additionalProperties: false,
      },
      description: "Notable projects outside formal employment roles.",
    },
    other: {
      type: "array",
      items: OTHER_ENTRY_SCHEMA,
      description: "Any resume detail that does not fit the named fields (languages, awards, etc.).",
    },
  },
  required: [
    "headline",
    "location",
    "yearsOfExperience",
    "skills",
    "roles",
    "education",
    "certifications",
    "projects",
    "other",
  ],
  additionalProperties: false,
} as const;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/** Extracts structured resume data (titles, skills, experience) from raw CV text via OpenAI. */
export async function parseResumeText(text: string): Promise<ParsedResume> {
  const response = await getClient().responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: RESUME_EXTRACTION_SYSTEM_PROMPT,
      },
      { role: "user", content: text.slice(0, 20000) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "resume_extraction",
        schema: RESUME_SCHEMA,
        strict: true,
      },
    },
  });

  return JSON.parse(response.output_text) as ParsedResume;
}

export type ParsedJobRequirements = {
  required: string[];
  preferred: string[];
};

export type ParsedJob = {
  title: string | null;
  company: string | null;
  location: string | null;
  employmentType: string | null;
  seniority: string | null;
  salary: string | null;
  summary: string | null;
  responsibilities: string[];
  requirements: ParsedJobRequirements;
  skills: string[];
  benefits: string[];
  domain: string[];
  other: ParsedOtherEntry[];
};

const JOB_SCHEMA = {
  type: "object",
  properties: {
    title: { type: ["string", "null"], description: "The job title being advertised." },
    company: { type: ["string", "null"], description: "The hiring company's name." },
    location: { type: ["string", "null"], description: "Where the role is based, e.g. city or 'Remote'." },
    employmentType: {
      type: ["string", "null"],
      description: "Full-time, part-time, contract, internship, etc.",
    },
    seniority: {
      type: ["string", "null"],
      description: "Seniority level if stated (junior, mid, senior, staff, lead, etc.).",
    },
    salary: {
      type: ["string", "null"],
      description: "Compensation / salary range if stated, as written.",
    },
    summary: {
      type: ["string", "null"],
      description: "Short overview of the role. Must not replace responsibilities/requirements lists.",
    },
    responsibilities: {
      type: "array",
      items: { type: "string" },
      description:
        "Every distinct duty / 'what you will do' item, including ones embedded in prose paragraphs.",
    },
    requirements: {
      type: "object",
      properties: {
        required: {
          type: "array",
          items: { type: "string" },
          description: "Must-have qualifications and experience bars.",
        },
        preferred: {
          type: "array",
          items: { type: "string" },
          description: "Nice-to-have / preferred qualifications.",
        },
      },
      required: ["required", "preferred"],
      additionalProperties: false,
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Technologies, tools, and hard skills named in the posting.",
    },
    benefits: {
      type: "array",
      items: { type: "string" },
      description: "Benefits and perks if stated.",
    },
    domain: {
      type: "array",
      items: { type: "string" },
      description: "Industry / product domain signals (fintech, healthcare, B2B SaaS, etc.).",
    },
    other: {
      type: "array",
      items: OTHER_ENTRY_SCHEMA,
      description: "Any job-relevant detail that does not fit the named fields.",
    },
  },
  required: [
    "title",
    "company",
    "location",
    "employmentType",
    "seniority",
    "salary",
    "summary",
    "responsibilities",
    "requirements",
    "skills",
    "benefits",
    "domain",
    "other",
  ],
  additionalProperties: false,
} as const;

/** Flattens required + preferred requirement strings for UI chips and legacy callers. */
export function flattenJobRequirementList(job: ParsedJob): string[] {
  return [...job.requirements.required, ...job.requirements.preferred].filter(
    (item) => item.trim().length > 0
  );
}

/**
 * Phrases used for deterministic job↔profile matching: skills, responsibilities,
 * requirements, and domain — not benefits/boilerplate.
 */
export function jobMatchPhrases(job: ParsedJob): string[] {
  const phrases = [
    ...job.skills,
    ...job.responsibilities,
    ...job.requirements.required,
    ...job.requirements.preferred,
    ...job.domain,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of phrases) {
    const phrase = raw.trim();
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

/** Extracts a complete structured job posting JSON from raw page text via OpenAI. */
export async function parseJobDescription(text: string): Promise<ParsedJob> {
  const response = await getClient().responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: JOB_EXTRACTION_SYSTEM_PROMPT,
      },
      { role: "user", content: text.slice(0, 20000) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "job_extraction",
        schema: JOB_SCHEMA,
        strict: true,
      },
    },
  });

  return JSON.parse(response.output_text) as ParsedJob;
}

export type TailoringSkillGroup = {
  category: string;
  items: string[];
};

export type TailoringExperienceEntry = {
  title: string;
  company: string;
  dates: string;
  context: string;
  bullets: string[];
};

export type TailoringProject = {
  name: string;
  description: string;
  dates: string;
  bullets: string[];
};

export type TailoringEducationEntry = {
  degree: string;
  institution: string;
  dates: string;
};

export type TailoredCv = {
  headline: string;
  summary: string;
  location: string;
  website: string;
  github: string;
  skills: TailoringSkillGroup[];
  experience: TailoringExperienceEntry[];
  projects: TailoringProject[];
  education: TailoringEducationEntry[];
};

export type WhatChangedItem = {
  item: string;
  justification: string;
  category: "surfaced" | "reframed" | "keyword-aligned" | "reordered";
};

/**
 * The 3 ATS-rubric criteria that need judgment rather than pure text
 * matching (no reliable structured data exists for education/certifications,
 * and formatting can't be assessed from parser-mangled text via regex).
 * Rated 0-3 against an explicit rubric — see lib/atsScore.ts, which combines
 * these with the 6 deterministically-computed criteria into the final
 * weighted ATS score. Used both standalone, pre-tailoring (scoreAtsSubcriteria),
 * and embedded here, post-tailoring (TailoringInsights.atsSubscores).
 */
export type AtsSubscores = {
  formattingCleanliness: number;
  formattingDetail: string;
  educationMatch: number;
  educationDetail: string;
  certifications: number;
  certificationsDetail: string;
};

export type TailoringInsights = {
  /** Rubric ratings for the tailored CV's formatting/education/certifications — combined with deterministic criteria into the final atsScore by lib/atsScore.ts. */
  atsSubscores: AtsSubscores;
  keywordsCovered: string[];
  unmetRequirement: string | null;
};

export type TailoringGeneration = {
  tailoredCv: TailoredCv;
  coverLetter: string;
  whatChanged: WhatChangedItem[];
  insights: TailoringInsights;
};

const ATS_SUBSCORES_SCHEMA_PROPERTIES = {
  formattingCleanliness: {
    type: "number",
    description:
      "0-3 rubric score for how clean/parser-friendly the CV's formatting and structure is for an " +
      "ATS: 0 = major structural problems, 1 = weak (messy layout, inconsistent structure), 2 = good " +
      "(mostly clean, minor issues), 3 = excellent (clean, simple, fully parser-friendly, no " +
      "tables/columns/graphics).",
  },
  formattingDetail: {
    type: "string",
    description: "One sentence justifying the formattingCleanliness score.",
  },
  educationMatch: {
    type: "number",
    description:
      "0-3 rubric score for how well the candidate's actual education matches what the job asks for: " +
      "0 = job requires a degree the candidate doesn't have and no equivalent is evident, 1 = " +
      "weak/partial match, 2 = good match, 3 = the candidate's real education fully satisfies or " +
      "exceeds what's asked (or the job states no education requirement — use 3 in that case).",
  },
  educationDetail: {
    type: "string",
    description: "One sentence justifying the educationMatch score.",
  },
  certifications: {
    type: "number",
    description:
      "0-3 rubric score for certifications: 0 = job wants a certification the candidate doesn't " +
      "genuinely hold, 1 = weak/partial, 2 = good, 3 = candidate genuinely holds the relevant " +
      "certification(s), or none are required by the job.",
  },
  certificationsDetail: {
    type: "string",
    description: "One sentence justifying the certifications score.",
  },
} as const;

const ATS_SUBSCORES_SCHEMA = {
  type: "object",
  properties: ATS_SUBSCORES_SCHEMA_PROPERTIES,
  required: [
    "formattingCleanliness",
    "formattingDetail",
    "educationMatch",
    "educationDetail",
    "certifications",
    "certificationsDetail",
  ],
  additionalProperties: false,
} as const;

/**
 * Rates the three ATS-rubric criteria that need judgment rather than pure
 * text matching (formatting cleanliness, education match, certifications)
 * against raw, pre-tailoring candidate material. Combined with the 6
 * deterministic criteria in lib/atsScore.ts to produce preTailoringMatchScore.
 */
export async function scoreAtsSubcriteria(input: {
  candidateText: string;
  jobText: string;
}): Promise<AtsSubscores> {
  const response = await getClient().responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: ATS_SUBSCORES_SYSTEM_PROMPT },
      { role: "user", content: input.jobText + "\n\n" + input.candidateText },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ats_subscores",
        schema: ATS_SUBSCORES_SCHEMA,
        strict: true,
      },
    },
  });

  return JSON.parse(response.output_text) as AtsSubscores;
}

const TAILORING_SCHEMA = {
  type: "object",
  properties: {
    tailoredCv: {
      type: "object",
      properties: {
        headline: { type: "string", description: "Role-targeted headline/title for the tailored CV." },
        summary: { type: "string", description: "3-5 sentence professional summary rewritten for this job." },
        location: {
          type: "string",
          description:
            "Candidate location exactly as supported by their material (e.g. city/region and timezone). " +
            "Empty string if unknown — never invent a location.",
        },
        website: {
          type: "string",
          description:
            "Personal website or portfolio URL/handle from the candidate's material. Empty string if none — never invent.",
        },
        github: {
          type: "string",
          description:
            "GitHub URL or handle from the candidate's material. Empty string if none — never invent.",
        },
        skills: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description:
                  "A skill-group label drawn from the candidate's real tooling/domain groupings (e.g. " +
                  "Languages, Frontend, Backend, Data, Infra, Testing) — choose labels that genuinely fit " +
                  "the candidate's actual skills, do not force an arbitrary fixed taxonomy.",
              },
              items: {
                type: "array",
                items: { type: "string" },
                description: "Most relevant skills in this category first, drawn only from the candidate's real material.",
              },
            },
            required: ["category", "items"],
            additionalProperties: false,
          },
          description: "Skills grouped into a handful of sensible categories reflecting the candidate's real tooling/domains.",
        },
        experience: {
          type: "array",
          description:
            "Job-specific reconstruction of the candidate's real roles. Every entry and every " +
            "achievement bullet must be freshly written for THIS posting from the source pool — " +
            "never copied verbatim. Different jobs must produce different experience/achievement wording.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              dates: { type: "string" },
              context: {
                type: "string",
                description:
                  "One-sentence context line for this role (dates are shown separately) — rewritten " +
                  "for this job's domain/scope; a concise blurb on the role/company, never pasted " +
                  "unchanged from the pool.",
              },
              bullets: {
                type: "array",
                items: { type: "string" },
                description:
                  "Every achievement/responsibility for this role, freshly tailored to this job's " +
                  "requirements — never a verbatim pool bullet. Truthful, achievement-oriented, " +
                  "and specific to this posting.",
              },
            },
            required: ["title", "company", "dates", "context", "bullets"],
            additionalProperties: false,
          },
        },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              dates: {
                type: "string",
                description:
                  "Project date range as supported by the candidate's material (e.g. '2026 to present'). " +
                  "Empty string if unknown — never invent.",
              },
              bullets: { type: "array", items: { type: "string" } },
            },
            required: ["name", "description", "dates", "bullets"],
            additionalProperties: false,
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              degree: {
                type: "string",
                description: "Degree/qualification name exactly as it appears in the candidate's real material.",
              },
              institution: {
                type: "string",
                description: "Institution name exactly as it appears in the candidate's real material.",
              },
              dates: {
                type: "string",
                description: "Dates attended or graduation date, exactly as supported by the candidate's real material.",
              },
            },
            required: ["degree", "institution", "dates"],
            additionalProperties: false,
          },
          description:
            "The candidate's real education, extracted verbatim from their material — never invented. " +
            "Empty array if the candidate's material shows no education.",
        },
      },
      required: [
        "headline",
        "summary",
        "location",
        "website",
        "github",
        "skills",
        "experience",
        "projects",
        "education",
      ],
      additionalProperties: false,
    },
    coverLetter: {
      type: "string",
      description: "A tailored cover letter for this job, 3-5 short paragraphs, plain text.",
    },
    whatChanged: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string", description: "What was added, surfaced, or reframed." },
          justification: {
            type: "string",
            description: "One sentence tracing this back to real evidence in the candidate's material.",
          },
          category: {
            type: "string",
            enum: ["surfaced", "reframed", "keyword-aligned", "reordered"],
          },
        },
        required: ["item", "justification", "category"],
        additionalProperties: false,
      },
    },
    insights: {
      type: "object",
      properties: {
        atsSubscores: {
          type: "object",
          properties: ATS_SUBSCORES_SCHEMA_PROPERTIES,
          required: [
            "formattingCleanliness",
            "formattingDetail",
            "educationMatch",
            "educationDetail",
            "certifications",
            "certificationsDetail",
          ],
          additionalProperties: false,
          description:
            "Rubric ratings of the TAILORED CV you just produced (not the raw pre-tailoring material) for the three criteria that need judgment rather than pure text matching.",
        },
        keywordsCovered: {
          type: "array",
          items: { type: "string" },
          description: "Job-description keywords/phrases genuinely and truthfully covered by the tailored CV.",
        },
        unmetRequirement: {
          type: ["string", "null"],
          description:
            "Exactly one job requirement the candidate's material does not support, stated plainly. Null only if there is truly no gap.",
        },
      },
      required: ["atsSubscores", "keywordsCovered", "unmetRequirement"],
      additionalProperties: false,
    },
  },
  required: ["tailoredCv", "coverLetter", "whatChanged", "insights"],
  additionalProperties: false,
} as const;

/**
 * Generates a truthfulness-bounded tailored CV, cover letter, what-changed
 * list, and match insights via OpenAI, using the CV Tailoring Skill as the
 * system prompt. jobText/candidateText are pre-assembled by the caller;
 * weakPointsPrompt is the independently-computed pre-tailoring fit breakdown
 * (see lib/atsScore.ts's buildWeakPointsPrompt), which replaces the old
 * self-estimated confidence-calibration block with the real score and
 * exactly which criteria to fix.
 */
export async function generateTailoring(input: {
  jobText: string;
  candidateText: string;
  weakPointsPrompt: string;
}): Promise<TailoringGeneration> {
  const response = await getClient().responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          TAILORING_SKILL_PROMPT +
          input.weakPointsPrompt +
          CV_STYLE_RULES_PROMPT +
          TAILORING_OUTPUT_CONTRACT,
      },
      { role: "user", content: input.jobText + "\n\n" + input.candidateText },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cv_tailoring",
        schema: TAILORING_SCHEMA,
        strict: true,
      },
    },
  });

  return JSON.parse(response.output_text) as TailoringGeneration;
}
