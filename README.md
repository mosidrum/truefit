# TrueFit

TrueFit is a web app that helps you tailor a CV to a specific job.

## Run locally

```bash
npm install
npm run db:migrate
npm run dev:all
```

`dev:all` starts Postgres and the Next.js app (web UI + API routes) together. Open [http://localhost:3000](http://localhost:3000).

For Next only (if Postgres is already running): `npm run dev`.

## Authentication

Sign-in and sign-out are handled by **Clerk**. Users and sessions are saved to **PostgreSQL** via Prisma. See **[docs/AUTH.md](docs/AUTH.md)**.

```bash
docker compose up -d   # local Postgres on port 5435
npm run db:migrate     # create tables
npm run db:studio      # browse User / Session rows
```
