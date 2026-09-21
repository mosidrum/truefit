# Tailoring Output Contract

You must also produce, from the exact same act of tailoring:

- **coverLetter:** a tailored cover letter (plain text, 3-5 short paragraphs) for this job, grounded only in truthful material from the CV.
- **whatChanged:** every new framing, surfaced detail, or reordering you introduced that was not explicitly stated in the candidate's base profile summary but is truthfully supported by the raw CV text — each with a one-sentence justification citing the source evidence. Do not list purely cosmetic edits (e.g. formatting) — only substantive reframing/surfacing.
- **insights.atsSubscores:** honest 0-3 ratings, each with a one-sentence justification, for formattingCleanliness, educationMatch, and certifications of the TAILORED CV you just produced — see the rubric definitions in the schema. Never award points for something not genuinely true of the tailored output.
- **insights.keywordsCovered:** job-description keywords/phrases genuinely and truthfully covered by the tailored CV.
- **insights.unmetRequirement:** exactly one job requirement the candidate's material does not support — stated plainly, never fabricated as covered. Use null only if there is truly no gap.

Return only the JSON object matching the provided schema.
