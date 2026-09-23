# TrueFit flow (5‑minute read)

## Core idea: CVs are a pool, not a paste

Uploaded CVs are **source pools** of real experience, skills, and achievements. Nothing from that pool is used as-is.

For every job, TrueFit **transforms** the pool so the output ranks as a fit for that posting:

- Experiences are reframed and reordered for what *this* job needs
- Achievements under each experience are rewritten to speak to *this* job’s requirements
- Two different jobs never get the same experience/achievement wording — every job is different, so every tailored CV is different

Truth is fixed (no invented jobs, metrics, or skills). Presentation is always job-specific.

---

## Skills live in markdown

LLM system prompts are **markdown files** under [`skills/`](../skills/), not hardcoded strings in `openai.ts`.

| Skill file | Used by |
| --- | --- |
| [`skills/cv-tailoring.md`](../skills/cv-tailoring.md) | Main CV Tailoring Skill (generation) |
| [`skills/cv-style-rules.md`](../skills/cv-style-rules.md) | Pool-transform, uniqueness, summary/style rules (appended at generate time) |
| [`skills/cv-output-contract.md`](../skills/cv-output-contract.md) | Cover letter / whatChanged / insights contract (appended at generate time) |
| [`skills/resume-extraction.md`](../skills/resume-extraction.md) | `parseResumeText` |
| [`skills/job-extraction.md`](../skills/job-extraction.md) | `parseJobDescription` |
| [`skills/ats-subscores.md`](../skills/ats-subscores.md) | `scoreAtsSubcriteria` |

Load path:

1. `lib/loadSkill.ts` — `readFileSync` from `skills/<name>.md`
2. `lib/tailoringSkill.ts` — re-exports `TAILORING_SKILL_PROMPT`, `CV_STYLE_RULES_PROMPT`, `TAILORING_OUTPUT_CONTRACT`
3. `lib/openaiInstructions.ts` — re-exports resume / job / ATS prompts
4. `lib/openai.ts` — API client + JSON schemas only; builds the system message from those exports

Edit the `.md` files to change model behavior. `next.config.ts` traces `./skills/**/*` into API serverless bundles so deploys still ship them.

---

## 1. Job link → tailor → score → PDF

1. **Paste / save URL** — Dashboard compose bar calls `submitUrl`, then `POST /api/jobs`.  
   `components/Dashboard.tsx` → `submitUrl`

2. **Fetch page + save row** — API pulls the listing HTML, strips it to text, writes `job_posts`.  
   `app/api/jobs/route.ts` → `lib/jobs.ts` `fetchJobPageText` / `htmlToText` / `createJobPost`

3. **Parse job fields** — OpenAI turns raw text into a **complete job JSON** (title, company, responsibilities, required/preferred requirements, skills, domain, benefits, `other`, …). Denormalized columns are filled for UI lists.  
   `lib/openai.ts` → `parseJobDescription` (skill/contract: `skills/job-extraction.md`) → `JobPost.parsedJson`

4. **Auto-tailor** — Activating a session fires `POST /api/jobs/[id]/tailoring` (or GET if already done).  
   `components/Dashboard.tsx` `useEffect` → `app/api/jobs/[id]/tailoring/route.ts` → `lib/tailoring.ts` `getOrGenerateTailoring`

5. **Build prompts** — Job text + **candidate source pool** (master profile + every CV’s extracted text + optional gap notes). Pool framing is explicit: nothing may be copied as-is; every experience/achievement must be rewritten for this job.  
   `lib/tailoring.ts` → `buildJobText` / `buildCandidateText`

6. **Score** — Full rubric in [`scoring.md`](../scoring.md). Key functions in `lib/atsScore.ts`:
   - `computeDeterministicCriteria` — rule-based criteria from text overlap
   - `combineAtsScore` — merge deterministic + OpenAI hybrid subscores into 0–100
   - `buildWeakPointsPrompt` — turn weak criteria into rewrite instructions
   - `buildCorrectionPrompt` — optional second-pass rewrite if fixable gaps remain  
   Hybrid model scores: `lib/openai.ts` → `scoreAtsSubcriteria` (skill: `skills/ats-subscores.md`)

7. **Generate tailored CV** — Model transforms the pool into a job-specific CV (every experience + achievement rewritten for this posting) + cover letter + insights; result upserted to `tailorings`.  
   `lib/openai.ts` → `generateTailoring`  
   System prompt = `cv-tailoring.md` + weak-points fragment + `cv-style-rules.md` + `cv-output-contract.md`

8. **Download PDF** — Tailored CV tab links to `/api/jobs/[id]/tailoring/pdf`.  
   `lib/tailoringPdf.tsx` → `lib/cvPdf/` (`@react-pdf/renderer`)

**Gap follow-up** — If there’s an honest gap, user can add text/files; files go to `/api/documents`, then same tailoring POST with `{ force: true, additionalContext }`.

---

## 2. Many CVs → source pool (+ master profile)

1. **Upload** — Profile page posts each file to `/api/documents`.  
   `app/profile/ProfileView.tsx`

2. **Extract + store** — Read PDF/DOCX/TXT, hash, save row in `cvs`.  
   `app/api/documents/route.ts` → `lib/cvs.ts` `extractText` / `createCv`

3. **Structure** — OpenAI pulls a **complete resume JSON** (headline, roles, skills, education, certifications, projects, `other`) from the extracted text.  
   `lib/openai.ts` → `parseResumeText` (skill/contract: `skills/resume-extraction.md`) → `Cv.parsedJson`

4. **Combine into pool summary** — All user CVs merge into one richer profile JSON (deduped roles/skills/education/…; unknown details merge under `other`). That summary plus raw CV text is the **pool** fed into tailoring and ATS scoring — never the final CV for a job.  
   `lib/profile.ts` → `buildProfileFromCvs`

The tailored CV for job A and job B both draw from this same pool, but every experience line and achievement is transformed again so each output matches its own job.
