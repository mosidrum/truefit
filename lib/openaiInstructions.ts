import { loadSkill } from "@/lib/loadSkill";

/**
 * System prompts for OpenAI calls that are not the CV Tailoring Skill.
 * Sources live under `/skills` as markdown — keep openai.ts as the API/schema layer.
 */

export const RESUME_EXTRACTION_SYSTEM_PROMPT = loadSkill("resume-extraction");

export const JOB_EXTRACTION_SYSTEM_PROMPT = loadSkill("job-extraction");

export const ATS_SUBSCORES_SYSTEM_PROMPT = loadSkill("ats-subscores");
