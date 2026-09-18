import OpenAI from "openai";
import { TAILORING_SKILL_PROMPT } from "@/lib/tailoringSkill";

/** Overridable via env so models can be switched/compared without a code change. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export type ParsedResumeRole = {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
};

export type ParsedResume = {
  headline: string | null;
  location: string | null;
  yearsOfExperience: number | null;
  skills: string[];
  roles: ParsedResumeRole[];
};

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
  },
  required: ["headline", "location", "yearsOfExperience", "skills", "roles"],
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
        content:
          "You extract structured resume data from raw CV/resume text. Only use information " +
          "present in the text — never invent roles, companies, dates, or skills. Use null or " +
          "an empty array for anything not present in the text.",
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

export type ParsedJob = {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  requirements: string[];
};

const JOB_SCHEMA = {
  type: "object",
  properties: {
    title: { type: ["string", "null"], description: "The job title being advertised." },
    company: { type: ["string", "null"], description: "The hiring company's name." },
    location: { type: ["string", "null"], description: "Where the role is based, e.g. city or 'Remote'." },
    description: {
      type: ["string", "null"],
      description: "A concise 2-4 sentence summary of what the role involves.",
    },
    requirements: {
      type: "array",
      items: { type: "string" },
      description: "Key required skills, qualifications, or experience mentioned in the posting.",
    },
  },
  required: ["title", "company", "location", "description", "requirements"],
  additionalProperties: false,
} as const;

/** Extracts structured job posting data (title, company, requirements) from raw page text via OpenAI. */
export async function parseJobDescription(text: string): Promise<ParsedJob> {
  const response = await getClient().responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You extract structured job posting data from raw web page text that may include " +
          "navigation, footer, or unrelated boilerplate alongside the actual posting. Only use " +
          "information present in the text — never invent a title, company, or requirement. Use " +
          "null or an empty array for anything not present in the text.",
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

const ATS_SUBSCORES_SYSTEM_PROMPT =
  "You rate a candidate's CV/profile material against a job posting on exactly three rubric " +
  "criteria, each scored 0-3. Be honest and conservative — never award points for something the " +
  "material doesn't genuinely show, and never invent degrees, certifications, or formatting quality " +
  "that isn't there. If a criterion doesn't apply (e.g. the job states no education/certification " +
  "requirement), score it 3 and say so in the detail.\n\n" +
  "- formattingCleanliness: judge from the material's structure (line breaks, spacing, apparent " +
  "layout, section organization) how clean and ATS-parser-friendly it appears to be.\n" +
  "- educationMatch: compare the job's stated education requirement (if any) against any education " +
  "mentioned in the candidate material.\n" +
  "- certifications: compare the job's stated certification requirement (if any) against any " +
  "certification mentioned in the candidate material.";

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
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              dates: { type: "string" },
              context: {
                type: "string",
                description:
                  "One-sentence context line for this role (dates are shown separately) — a concise " +
                  "blurb on the role/company, e.g. what the team owned or the company's product.",
              },
              bullets: {
                type: "array",
                items: { type: "string" },
                description: "Tailored, truthful, achievement-oriented bullets for this role.",
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

const CV_STYLE_RULES_PROMPT =
  "\n\nSTYLE AND UNIQUENESS RULES\n" +
  "- No buzzwords or cliché filler: never use empty phrases like \"results-driven\", " +
  "\"team player\", \"synergy\", \"go-getter\", \"detail-oriented\", \"hardworking\", " +
  "\"self-starter\", \"dynamic professional\", \"proven track record\", \"think outside the box\", " +
  "or \"wears many hats\". Replace every instance of this kind of language with a concrete, " +
  "evidence-backed statement instead.\n" +
  "- Uniqueness: every tailored CV must be written fresh from this candidate's specific evidence " +
  "and this specific job — never fall back to generic, templated, or interchangeable phrasing that " +
  "could apply to any candidate or any job.\n" +
  "- Job-specific anchoring and summary as the primary pitch: the summary is the single highest-leverage " +
  "section of the CV — assume the recruiter may read nothing else. Open with a direct positioning " +
  "statement — years of experience plus explicit alignment to this job's actual title (e.g. \"Senior " +
  "Backend Engineer with 6 years building...\") — whenever the candidate's real experience truthfully " +
  "supports that framing; if it doesn't, open with the strongest truthful claim of fit instead. The " +
  "summary must explicitly reference this job's actual title/company and must work in language from as " +
  "many of the job's genuinely-supported top requirements as the candidate's real evidence truthfully " +
  "allows — not just 2-3 token requirements, but as comprehensive a requirement/keyword echo as " +
  "truthfulness permits (see Skill §5 Professional Summary, §8 Keyword Coverage, and the Core Principle " +
  "— never claim a requirement the evidence doesn't support; omission is always safer than fabrication). " +
  "Write it as a self-contained pitch: a recruiter who reads only the summary and nothing else should " +
  "conclude, from the summary alone, that this candidate is a strong match for this specific job. If two " +
  "tailored CVs from the same candidate would read as interchangeable across two different job postings, " +
  "or if the summary could be read in isolation without concluding strong fit, the summary has failed " +
  "this rule.\n" +
  "- Conversion and readability: write for a recruiter skimming in seconds. Use strong action verbs, " +
  "quantify impact wherever the evidence supports it, keep bullets to one or two lines, and lead " +
  "each section with its strongest, most relevant point so the CV is immediately eye-catching and " +
  "easy to scan.\n" +
  "- Education: populate the education array by extracting degree, institution, and dates verbatim " +
  "from the candidate's real CV text/profile material — never invent a degree, institution, or date " +
  "that isn't genuinely there. If the candidate's material shows no education, return an empty array " +
  "rather than fabricating one.\n" +
  "- Experience context line: for each role, write a single concise sentence in `context` — a plain, " +
  "factual line about the role or company (e.g. team scope, product, or company domain) that a reader " +
  "would expect directly under the role/dates and above the bullets. Keep it factual and non-redundant " +
  "with the bullets that follow.\n" +
  "- Skill categories: group skills into a small number of labels that genuinely reflect the " +
  "candidate's real tooling and domains (for example Languages, Frontend, Backend, Data, Infra, " +
  "Testing, or others that better fit this candidate) — choose labels consistently, put the most " +
  "relevant category and items first, and never invent a skill or category not evidenced in the " +
  "candidate's material.\n" +
  "- Contact fields: populate location, website, and github only from values genuinely present in " +
  "the candidate's material. Use an empty string when a field is absent — never invent a location, " +
  "URL, or handle. Prefer the clean host/path form when a full URL is present (e.g. johnoshalusi.com, " +
  "github.com/greatertomi).\n" +
  "- Project dates: populate each project's dates from the candidate's material when available; " +
  "use an empty string when unknown — never invent a date range.";

const TAILORING_OUTPUT_CONTRACT =
  "\n\nYou must also produce, from the exact same act of tailoring:\n" +
  "- coverLetter: a tailored cover letter (plain text, 3-5 short paragraphs) for this job, grounded only in truthful material from the CV.\n" +
  "- whatChanged: every new framing, surfaced detail, or reordering you introduced that was not explicitly stated in the candidate's base profile summary but is truthfully supported by the raw CV text — each with a one-sentence justification citing the source evidence. Do not list purely cosmetic edits (e.g. formatting) — only substantive reframing/surfacing.\n" +
  "- insights.atsSubscores: honest 0-3 ratings, each with a one-sentence justification, for formattingCleanliness, educationMatch, and certifications of the TAILORED CV you just produced — see the rubric definitions in the schema. Never award points for something not genuinely true of the tailored output.\n" +
  "- insights.keywordsCovered: job-description keywords/phrases genuinely and truthfully covered by the tailored CV.\n" +
  "- insights.unmetRequirement: exactly one job requirement the candidate's material does not support — stated plainly, never fabricated as covered. Use null only if there is truly no gap.\n" +
  "Return only the JSON object matching the provided schema.";

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
