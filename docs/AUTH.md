# Authentication for TrueFit

TrueFit uses [Clerk](https://clerk.com/) for sign-in and sign-out, and **PostgreSQL** (via Prisma) to store users and sessions.

## Local setup

1. Clerk keys in `.env.local` (from `clerk init`, or paste from the dashboard).
2. Start Postgres and set the URL:

```bash
docker compose up -d
```

```bash
DATABASE_URL="postgresql://truefit:truefit@localhost:5435/truefit?schema=public"
```

| | |
| --- | --- |
| Host | `localhost` |
| Port | `5435` |
| User | `truefit` |
| Password | `truefit` |
| Database | `truefit` |

3. Create / update tables:

```bash
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Signed-out visitors see the landing page. After sign-in, TrueFit upserts the user and session into Postgres. **Sign out** is in the sidebar.

Inspect data:

```bash
npm run db:studio
```

## What is stored

| Table | Purpose |
| --- | --- |
| `User` | `clerkUserId`, email, name, image — keyed for app data |
| `Session` | Clerk session id, status (`active` / `ended` / …), last activity |

Clerk remains the source of truth for authentication. The database mirrors users/sessions so you can join career-record and CV data later.

Sync paths:

1. **On each signed-in page load** — `getAppUser()` upserts the user and current session.
2. **Webhooks (optional)** — `POST /api/webhooks/clerk` handles `user.*` and `session.*` events when `CLERK_WEBHOOK_SIGNING_SECRET` is set.

## Claim the Clerk app (recommended)

```bash
npx clerk@latest auth login
```

## Google sign-in

After claiming the app: Clerk Dashboard → **Social connections** → enable **Google**. Development can use Clerk’s shared credentials. Production needs your own Google OAuth client.

## Webhooks (optional but recommended)

1. Expose local `/api/webhooks/clerk` (e.g. with ngrok) or use your production URL.
2. Clerk Dashboard → **Webhooks** → add endpoint.
3. Subscribe to: `user.created`, `user.updated`, `user.deleted`, `session.created`, `session.ended`, `session.removed`, `session.revoked`.
4. Put the signing secret in `.env.local`:

```bash
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

## Production

1. Use hosted Postgres (Neon, Supabase, Railway, etc.) and set `DATABASE_URL` to that connection string.
2. Set Clerk **production** keys and optional webhook secret on the host.
3. Run migrations against production: `npx prisma migrate deploy`.

## How it is wired

| Piece | Location |
| --- | --- |
| Schema | `prisma/schema.prisma` (`postgresql`) |
| Local Postgres | `docker-compose.yml` (port **5435**) |
| Client | `lib/prisma.ts` |
| Upsert helpers | `lib/db.ts` |
| Signed-in sync | `lib/session.ts` → `getAppUser()` |
| Webhook | `app/api/webhooks/clerk/route.ts` |
| Clerk proxy | `proxy.ts` |
