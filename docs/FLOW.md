# TrueFit flow (5‑minute read)

## Core idea: CVs are a pool, not a paste

Uploaded CVs are **source pools** of real experience, skills, and achievements. Nothing from that pool is used as-is.

For every job, TrueFit **transforms** the pool so the output ranks as a fit for that posting:

- Experiences are reframed and reordered for what *this* job needs
- Achievements under each experience are rewritten to speak to *this* job’s requirements
- Two different jobs never get the same experience/achievement wording — every job is different, so every tailored CV is different

Truth is fixed (no invented jobs, metrics, or skills). Presentation is always job-specific.

---

## 1. Job link → tailor → score → PDF

1. **Paste / save URL** — Dashboard compose bar calls `submitUrl`, then `POST /api/jobs`.  
   `components/Dashboard.tsx` → `submitUrl`

2. **Fetch page + save row** — API pulls the listing HTML, strips it to text, writes `job_posts`.  
   `app/api/jobs/route.ts` → `lib/jobs.ts` `fetchJobPageText` / `htmlToText` / `createJobPost`

3. **Parse job fields** — OpenAI turns raw text into title, company, requirements, etc.  
   `lib/openai.ts` → `parseJobDescription`

4. **Auto-tailor** — Activating a session fires `POST /api/jobs/[id]/tailoring` (or GET if already done).  
   `components/Dashboard.tsx` `useEffect` → `app/api/jobs/[id]/tailoring/route.ts` → `lib/tailoring.ts` `getOrGenerateTailoring`

5. **Build prompts** — Job text + pool summary (master profile) + every CV’s extracted text (plus optional gap notes).  
   `lib/tailoring.ts` → `buildJobText` / `buildCandidateText`

6. **Score** — Full rubric in [`scoring.md`](../scoring.md). Key functions in `lib/atsScore.ts`:
   - `computeDeterministicCriteria` — rule-based criteria from text overlap
   - `combineAtsScore` — merge deterministic + OpenAI hybrid subscores into 0–100
   - `buildWeakPointsPrompt` — turn weak criteria into rewrite instructions
   - `buildCorrectionPrompt` — optional second-pass rewrite if fixable gaps remain  
   Hybrid model scores: `lib/openai.ts` → `scoreAtsSubcriteria`

7. **Generate tailored CV** — Model transforms the pool into a job-specific CV (every experience + achievement rewritten for this posting) + cover letter + insights; result upserted to `tailorings`.  
   `lib/openai.ts` → `generateTailoring` (rules in `lib/tailoringSkill.ts`)

8. **Download PDF** — Tailored CV tab links to `/api/jobs/[id]/tailoring/pdf`.  
   `lib/tailoringPdf.tsx` → `lib/cvPdf/` (`@react-pdf/renderer`)

**Gap follow-up** — If there’s an honest gap, user can add text/files; files go to `/api/documents`, then same tailoring POST with `{ force: true, additionalContext }`.

---

## 2. Many CVs → source pool (+ master profile)

1. **Upload** — Profile page posts each file to `/api/documents`.  
   `app/profile/ProfileView.tsx`

2. **Extract + store** — Read PDF/DOCX/TXT, hash, save row in `cvs`.  
   `app/api/documents/route.ts` → `lib/cvs.ts` `extractText` / `createCv`

3. **Structure** — OpenAI pulls headline, roles, skills from the extracted text.  
   `lib/openai.ts` → `parseResumeText`

4. **Combine into pool summary** — All user CVs merge into one profile (deduped roles/skills). That summary plus raw CV text is the **pool** fed into tailoring — never the final CV for a job.  
   `lib/profile.ts` → `buildProfileFromCvs`

The tailored CV for job A and job B both draw from this same pool, but every experience line and achievement is transformed again so each output matches its own job.
