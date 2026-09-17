import OpenAI from "openai";

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
    model: "gpt-4o-mini",
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
    model: "gpt-4o-mini",
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
