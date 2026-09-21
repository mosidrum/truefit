import { loadSkill } from "@/lib/loadSkill";

/**
 * CV Tailoring Skill — loaded from markdown under `/skills`.
 * Edit the `.md` files; do not hardcode skill text here.
 */

export const TAILORING_SKILL_PROMPT = loadSkill("cv-tailoring");

/** Appended to the skill at generation time (pool-transform, style, uniqueness). */
export const CV_STYLE_RULES_PROMPT = "\n\n" + loadSkill("cv-style-rules");

/** Appended after style rules — extra JSON fields generateTailoring must return. */
export const TAILORING_OUTPUT_CONTRACT = "\n\n" + loadSkill("cv-output-contract");
