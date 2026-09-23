# How TrueFit's ATS score works

Explained for a technical teen. The code that does this lives in
[`lib/atsScore.ts`](lib/atsScore.ts).

---

## The big idea (30 seconds)

A job posting is a **wishlist**. Your CV is what you actually bring.

TrueFit asks 9 fixed questions about that match. Each answer is a
number from 0 to 3:

| Score | Meaning |
|---|---|
| 0 | Totally missing |
| 1 | Weak / barely there |
| 2 | Pretty good |
| 3 | Nailed it |

Not every question is equally important. Some are worth more points
(**weight**). We multiply, add them up, and turn the total into a 0–100
score.

We do this twice:

1. **Pre-tailoring fit** — your raw CV before we rewrite anything
2. **ATS score** — the tailored CV after the rewrite

Same 9 questions both times, so before/after is a fair comparison. The
rewrite AI does not grade its own homework.

---

## The math

```
for each of the 9 criteria:
  weightedPoints = score (0–3) × weight

totalPoints = sum of all weightedPoints
maxPoints   = 57   (because weights add to 19, and 19 × 3 = 57)

normalizedScore = round(totalPoints / 57 × 100)   // 0–100, what you see in the app
```

### Weights (why some questions matter more)

| # | Criterion | Weight | Max points (score 3) |
|---|---|---|---|
| 1 | Keyword Match | ×3 | 9 |
| 2 | Job Title Alignment | ×3 | 9 |
| 3 | Required Skills Coverage | ×3 | 9 |
| 4 | Formatting Cleanliness | ×2 | 6 |
| 5 | Standard Section Headings | ×2 | 6 |
| 6 | Experience Depth & Recency | ×2 | 6 |
| 7 | Quantified Achievements | ×2 | 6 |
| 8 | Education Match | ×1 | 3 |
| 9 | Certifications | ×1 | 3 |
| | Total | 19 | 57 |

### Bands (what the number means)

| Band | Rule | Vibe |
|---|---|---|
| `submission-ready` | totalPoints > 45 | Strong enough to apply |
| `needs-tailoring` | totalPoints 34–45 | Close — rewrite will help |
| `weak-match` | totalPoints < 34 | Big gaps vs this job |

### Weak points

Any criterion with score 0 or 1 is a **weak point**. Those get handed
to the rewrite AI as a concrete fix-list: "here's what's dragging the
score down — fix these, but never invent stuff that isn't true."

### How a ratio becomes 0–3

For coverage-style checks (keywords, skills, headings, metrics), we
compute a ratio like `matched / total`, then bucket it:

| Ratio | Score |
|---|---|
| ≥ 75% | 3 |
| ≥ 50% | 2 |
| > 0% | 1 |
| 0% | 0 |

---

## Who answers which question?

6 questions are answered by code (deterministic — same input, same
score, every time):

1. Keyword Match  
2. Job Title Alignment  
3. Required Skills Coverage  
5. Standard Section Headings  
6. Experience Depth & Recency  
7. Quantified Achievements  

3 questions need judgment, so an AI rates only those against a strict
0–3 rubric (it cannot invent a free-floating score):

4. Formatting Cleanliness  
8. Education Match  
9. Certifications  

---

## The 9 rubric questions

### 1. Keyword Match (weight ×3) — code

**Question:** *Do the important words from the job posting actually appear
in the CV?*

How it works: take structured job phrases (skills, responsibilities, required/preferred
requirements, domain) from `parsedJson` when present; otherwise tokenize the legacy
title + description + requirements. Count how many of those phrases show up as whole
words in the profile/CV text. Ratio → 0–3.

### 2. Job Title Alignment (weight ×3) — code

**Question:** *Does the candidate's headline or recent job title look like
the title this company is hiring for?*

How it works: Jaccard-style overlap between tokens in the job title and
tokens in the candidate's role titles / headline. Best overlap → 0–3.

### 3. Required Skills Coverage (weight ×3) — code

**Question:** *Of the skills/requirements the job listed, how many does the
candidate's skills list actually cover?*

How it works: for each listed skill/required qualification (from `parsedJson`
when present), check whether a candidate skill matches it (whole-word either
direction). Coverage ratio → 0–3.

### 4. Formatting Cleanliness (weight ×2) — AI rubric

**Question:** *Is this CV clean and easy for an ATS parser to read (no
messy tables, columns, or graphics chaos)?*

| Score | Meaning |
|---|---|
| 0 | Major structural problems |
| 1 | Messy / inconsistent |
| 2 | Mostly clean, minor issues |
| 3 | Clean, simple, fully parser-friendly |

### 5. Standard Section Headings (weight ×2) — code

**Question:** *Does the CV have the normal sections an ATS expects?*

Looks for these 4 headings in the text:

- Experience (or "Work Experience" / "Employment History")
- Education
- Skills (or "Technical Skills")
- Summary (or "Profile" / "Objective")

Found / 4 → 0–3.

### 6. Experience Depth & Recency (weight ×2) — code

**Question:** *Do they have enough years for what the job asks, and is
their experience recent?*

- **Depth OK** = candidate years ≥ years the job asks for (if the job
  mentions something like "5+ years")
- **Recent OK** = a role says "Present"/"Current", or has a year within
  the last 2 years

| Depth | Recent | Score |
|---|---|---|
| yes | yes | 3 |
| only one of them | | 2 |
| has some experience, but neither | | 1 |
| no experience at all | | 0 |

### 7. Quantified Achievements (weight ×2) — code

**Question:** *Do the experience bullets include real numbers / metrics?*

A bullet "counts" if it has a digit, `%`, or currency symbol (`$ € £`).
Ratio of quantified bullets → 0–3. No bullets = 0.

### 8. Education Match (weight ×1) — AI rubric

**Question:** *Does the candidate's real education match what the job
asks for?*

| Score | Meaning |
|---|---|
| 0 | Job wants a degree they don't have |
| 1 | Weak / partial match |
| 2 | Good match |
| 3 | Fully satisfies / exceeds, or job states no education requirement |

### 9. Certifications (weight ×1) — AI rubric

**Question:** *Does the candidate hold the certifications the job wants?*

| Score | Meaning |
|---|---|
| 0 | Job wants a cert they don't have |
| 1 | Weak / partial |
| 2 | Good |
| 3 | They hold it, or none are required |

---

## Worked example: score a sample CV against a sample job

### Sample job post

> Title: Senior Frontend Engineer  
> Company: Northwind Labs  
>
> We're hiring a Senior Frontend Engineer with 5+ years of experience
> building production web apps.
>
> Requirements:
> - React
> - TypeScript
> - Next.js
> - GraphQL
> - Jest
>
> You'll own customer-facing UI, ship features end-to-end, and work closely
> with design and backend. Bachelor's degree preferred. AWS certification
> is a plus but not required.
>
> Nice-to-haves mentioned in the description: accessibility, CI/CD,
> performance, remote collaboration.

Parsed for scoring roughly as:

- `parsedTitle` = `Senior Frontend Engineer`
- `parsedRequirements` = `React`, `TypeScript`, `Next.js`, `GraphQL`, `Jest`
- description/title text also contributes keywords like `frontend`,
  `engineer`, `production`, `accessibility`, etc.

### Sample CV (before tailoring)

```
Alex Rivera
Frontend Developer

SUMMARY
Developer with 6 years building web apps in React.

EXPERIENCE
Acme Corp, Frontend Developer
2021 – Present
- Built React features for the dashboard.
- Worked with designers on new flows.
- Improved page load time by 40%.

SKILLS
React, JavaScript, CSS, HTML, Jest

EDUCATION
BSc Computer Science – State University (2016 – 2020)
```

No TypeScript, Next.js, or GraphQL on the skills list. No AWS cert.
Headline is "Frontend Developer", not "Senior Frontend Engineer".

---

### Asking the 9 questions against this CV

#### Q1. Keyword Match (×3)

Job tokens include things like: `senior`, `frontend`, `engineer`, `react`,
`typescript`, `next`, `graphql`, `jest`, `production`, …

CV has some of them (`frontend`, `react`, `jest`, `engineer` via role
context, etc.) but is missing big ones like `typescript`, `graphql`,
`next`.

Suppose code finds 12 / 24 job keywords → ratio 0.50 → score 2.

`weighted = 2 × 3 = 6`  
Detail: `12/24 job keywords found in the CV text.`

#### Q2. Job Title Alignment (×3)

Job title tokens: `{senior, frontend, engineer}`  
Best candidate title: `Frontend Developer` → tokens `{frontend, developer}`

Intersection = `{frontend}` (1)  
Union = `{senior, frontend, engineer, developer}` (4)  
Overlap = 1/4 = 25% → score 1 (ratio > 0 but < 0.5).

`weighted = 1 × 3 = 3`  
Detail: `Best title overlap with "Senior Frontend Engineer" is 25%.`

#### Q3. Required Skills Coverage (×3)

Job requirements: React, TypeScript, Next.js, GraphQL, Jest  
CV skills: React, JavaScript, CSS, HTML, Jest  

Matches: React, Jest → 2 / 5 = 0.40 → score 1.

`weighted = 1 × 3 = 3`  
Detail: `2/5 listed requirements match a candidate skill.`

#### Q4. Formatting Cleanliness (×2) — AI

CV is simple, single column, normal headings, no tables/graphics.

AI rubric → score 3.

`weighted = 3 × 2 = 6`  
Detail: `Clean single-column layout with clear headings; parser-friendly.`

#### Q5. Standard Section Headings (×2)

Found: Summary, Experience, Skills, Education → 4 / 4 = 1.0 → score 3.

`weighted = 3 × 2 = 6`  
Detail: `4/4 standard sections detected (Experience, Education, Skills, Summary).`

#### Q6. Experience Depth & Recency (×2)

Job wants 5+ years. Candidate has 6 → depth OK.  
Role dates say Present → recent OK.  
Both true → score 3.

`weighted = 3 × 2 = 6`  
Detail: `Candidate years: 6 (job wants 5+); most recent role recent: yes.`

#### Q7. Quantified Achievements (×2)

Bullets:

1. Built React features… → no number  
2. Worked with designers… → no number  
3. Improved page load time by 40% → counts  

1 / 3 ≈ 0.33 → score 1.

`weighted = 1 × 2 = 2`  
Detail: `1/3 bullets include a measurable outcome.`

#### Q8. Education Match (×1) — AI

Job prefers a Bachelor's. CV has BSc Computer Science.

AI rubric → score 3.

`weighted = 3 × 1 = 3`  
Detail: `BSc Computer Science satisfies the preferred Bachelor's degree.`

#### Q9. Certifications (×1) — AI

Job says AWS cert is a plus, not required. Candidate has none — that's
fine when none are required.

AI rubric → score 3.

`weighted = 3 × 1 = 3`  
Detail: `No certification required; AWS listed only as a plus.`

---

### Add it up

| # | Criterion | Score | Weight | Weighted |
|---|---|---|---|---|
| 1 | Keyword Match | 2 | ×3 | 6 |
| 2 | Job Title Alignment | 1 | ×3 | 3 |
| 3 | Required Skills Coverage | 1 | ×3 | 3 |
| 4 | Formatting Cleanliness | 3 | ×2 | 6 |
| 5 | Standard Section Headings | 3 | ×2 | 6 |
| 6 | Experience Depth & Recency | 3 | ×2 | 6 |
| 7 | Quantified Achievements | 1 | ×2 | 2 |
| 8 | Education Match | 3 | ×1 | 3 |
| 9 | Certifications | 3 | ×1 | 3 |
| | Total | | | 38 / 57 |

```
normalizedScore = round(38 / 57 × 100) = round(66.67) = 67
band            = needs-tailoring   (34 ≤ 38 ≤ 45)
```

### Weak points from this run (score ≤ 1)

These get injected into the rewrite prompt:

1. Job Title Alignment (1/3) — headline/title doesn't read like
   "Senior Frontend Engineer"
2. Required Skills Coverage (1/3) — missing TypeScript, Next.js,
   GraphQL on the skills list (only fix if the raw CV evidence supports
   them)
3. Quantified Achievements (1/3) — only 1 of 3 bullets has a metric

After the rewrite, TrueFit runs the exact same 9 questions on the
tailored CV to produce the final ATS score. If the rewrite truthfully
surfaces TypeScript from buried evidence, reframes the title, and adds
supported metrics, those weak scores go up — and so does the 0–100 number.

---

## How this plugs into tailoring

```
raw CV  →  materialFromProfile()
        →  score (9 questions)  →  preTailoringMatchScore + weakPoints
        →  weakPoints become instructions for generateTailoring()
        →  tailored CV
        →  materialFromTailoredCv()
        →  score again (same 9 questions)  →  atsScore
```

That's why the two numbers are comparable: identical rubric, different
subject material.
