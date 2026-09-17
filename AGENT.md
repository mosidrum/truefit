# AGENT.md

Source of truth for AI assistants in this repository. Read this file in full before exploring, answering, or editing. Do not skip it because the task looks small.

## Priority rule

**Always read this file (`AGENT.md`) in full before starting any work in this repo** — before exploring, planning, answering, or editing anything. This takes precedence over jumping straight into a task, even a task that looks trivial or unrelated to what's documented here.

## What this is

TrueFit — a web app that tailors a CV to a specific job posting. Next.js 16 (App Router) + React 19 + TypeScript, Clerk for auth, PostgreSQL via Prisma for the app's own data, SCSS Modules for styling.

This repo is at an early, scaffold stage: **auth and the UI shell are real; the tailoring product is not.** Everything rendered on the dashboard and profile pages (`lib/dashboardData.ts`, `lib/profileData.ts`, `lib/landingData.ts`) is hardcoded fixture data ported from a design mockup, not output from any CV-parsing or matching logic. Don't treat `TAILORING_SESSIONS`, `ROLES`, `SKILLS`, etc. as real user data, and don't wire new features to them as if they were.

This project runs on a Next.js version newer than most training data. **Read `node_modules/next/dist/docs/` (resolved from `AGENTS.md`, which `next dev` regenerates) before relying on remembered Next.js APIs.** The rename that already bit this repo's own file layout: `middleware.ts` is deprecated in favor of `proxy.ts` (see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) — that's why auth runs from `proxy.ts` here, not `middleware.ts`.

## Invariants — do not break these

- **Clerk is the source of truth for identity and sessions, Postgres is a mirror.** `User`/`Session` in `prisma/schema.prisma` exist so future app data (career record, CV documents) can join against a stable local id — never treat those tables as authoritative for "is this user signed in" or build an auth check against them. That check is Clerk's job, via `proxy.ts` (`clerkMiddleware()`) and `getAppUser()`.
- **Two independent shapes of "Clerk user" must be kept in sync by hand.** `lib/db.ts` has `upsertUserFromClerk` (reads the Clerk SDK's `ClerkUser` object — camelCase: `firstName`, `primaryEmailAddress`) and `upsertUserFromWebhook` (reads a webhook payload — snake_case: `first_name`, `email_addresses`). Neither is derived from the other. If a new field needs mirroring, update both functions, or the two sync paths silently drift.
- **`getAppUser()` writes on every signed-in page render.** `lib/session.ts` calls `syncSignedInUser`, which upserts `User` and `Session` on every call — it runs on every page load that renders as signed in, not just on login. Don't add slow work to that path without accounting for the per-request cost.
- **The webhook handler must verify before it acts.** `app/api/webhooks/clerk/route.ts` calls `verifyWebhook(req)` first and 400s on failure. Do not add a code path that touches the database before that check succeeds.
- **`clerkUserId` / `clerkSessionId`, not the Prisma `id`, are the join keys back to Clerk.** Prisma's own `cuid()` ids are local only; every lookup against Clerk data goes through the Clerk-issued id columns.
- **Auth is wired through `proxy.ts`**, using Next 16's renamed middleware convention. There is no `edge` runtime option for it (forced to `nodejs`) — don't add `runtime = "edge"` config here, Next will reject it.

## Sharp edges worth knowing before you touch this code

- **Prisma vs. webhook field casing.** As above — this is the most likely place to introduce a bug that only shows up for one of the two sync paths (e.g. it works when a user loads a page, but silently no-ops on the `user.updated` webhook, or vice versa).
- **No automated tests exist yet.** `package.json` has no `test` script. Don't assume `npm test` or a test runner is configured — if you add logic worth testing, you're also introducing the first test setup.
- **No lint-enforced architecture boundaries.** `eslint.config.mjs` is just `eslint-config-next` (core-web-vitals + typescript). Nothing stops a cross-module reach-in the way `eslint-plugin-boundaries` would elsewhere — module layering here (`app/` → `components/` → `lib/`) is a convention, not a build failure.
- **This was NextAuth before it was Clerk** (`git log`: "replace NextAuth with Clerk authentication"). If you find naming, docs, or assumptions that read like a DB-backed session model, that's the reason — Clerk owns sessions now, Postgres only mirrors them for future joins.
- **Data files are deliberately separate from their components** (`lib/dashboardData.ts`, `lib/profileData.ts`, `lib/landingData.ts` — each says so in its header comment) so the `.tsx` files stay markup-and-behavior only. Keep that split when extending fixtures; don't inline new mock data into the components.

## Commands

```bash
npm install
npm run dev:all      # docker compose up postgres + next dev, in one command
npm run dev          # Next.js only (Postgres must already be running)
npm run db:migrate   # prisma migrate dev
npm run db:studio    # browse User / Session rows
npm run lint
npm run build        # prisma generate && next build
```

Local Postgres runs on **port 5435** (`docker-compose.yml`), not the Postgres default 5432 — `DATABASE_URL` in `.env.example` already reflects this.

## Conventions

- Path alias `@/*` → repo root (`tsconfig.json`).
- Pages (`app/**/page.tsx`) are server components: they call `getAppUser()` and hand the result down as a typed `AppUser` prop. Interactive components (`Dashboard.tsx`, `ProfileView.tsx`, `GoogleSignInButton.tsx`) are `"use client"` and own their own state.
- One SCSS Module per component, colocated (`Dashboard.tsx` + `Dashboard.module.scss`).
- Comments in this codebase explain *why*, not *what* (see the tween comment in `ProfileView.tsx`, the font-scoping comment in `app/layout.tsx`, the header comments in the `lib/*Data.ts` files). Match that — don't add comments describing what the next line already says.
- Conventional Commits style (`feat:`, `chore:`), per `git log`.

## Working rules

- **No needless file changes.** Edit only the files that solve the problem being solved. Do not drive-by format, rename, reorganize, or "clean up" code that isn't part of the fix, even if it looks improvable.
- **Investigate narrowly.** When planning or researching a change, read the files that are actually relevant to it, not the whole surrounding module or every file in a directory "just in case." Don't inspect fixture data, unrelated components, or unrelated docs unless the task touches them.
- **Be mindful of token usage.** Prefer targeted reads (specific files, specific line ranges) over broad ones. Don't re-read files already seen in the conversation, don't dump entire large files (e.g. `lib/dashboardData.ts`, `lib/profileData.ts`) when only a small part is relevant, and don't pull in context that doesn't change the outcome of the task.

## When touching auth / user sync

- Adding a field to mirror from Clerk → update `prisma/schema.prisma` (+ migration), `upsertUserFromClerk`, **and** `upsertUserFromWebhook` in `lib/db.ts`. Missing one of the three means the field is only ever populated from one of the two entry points.
- Subscribing to a new Clerk webhook event → add the `case` in `app/api/webhooks/clerk/route.ts` and add it to the "Subscribe to" list in `docs/AUTH.md` so the two stay matched.
- Read `docs/AUTH.md` before changing anything auth-related — it documents the two sync paths (page-load upsert vs. webhook) and how local Postgres is wired.
