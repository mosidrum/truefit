# Google sign-in for TrueFit

TrueFit signs people in with Google only. There is no email or password form.

The Google button is already wired. It will work after you create a Google OAuth client and put the values in `.env.local`.

Right now the app is gated by a hardcoded flag in [`lib/session.ts`](../lib/session.ts):

```ts
export const userLoggedIn = true;
```

- `true` — skip the landing page and open the workspace (current setting)
- `false` — show the landing page, where **Continue with Google** and **Sign in** run the real Google flow

Set it to `false` when you are ready to test sign-in.

---

## What you will create

Four values:

| Variable | What it is |
| --- | --- |
| `AUTH_SECRET` | A random string TrueFit uses to sign session cookies |
| `AUTH_GOOGLE_ID` | Google OAuth **Client ID** |
| `AUTH_GOOGLE_SECRET` | Google OAuth **Client secret** |
| `NEXTAUTH_URL` | The exact origin of this app (`http://localhost:3000` while developing) |

---

## Step 1 — Create `.env.local`

In the project root, copy the example file:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored. Never commit it.

Leave it open. You will paste values into it as you create them.

---

## Step 2 — Generate `AUTH_SECRET`

In the project root, run:

```bash
openssl rand -base64 32
```

Copy the output. In `.env.local`, set:

```bash
AUTH_SECRET=paste-the-generated-string-here
```

No quotes. No spaces around `=`.

If `openssl` is not available:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Step 3 — Set `NEXTAUTH_URL`

For local development, `.env.example` already has the right value. Confirm `.env.local` contains:

```bash
NEXTAUTH_URL=http://localhost:3000
```

This must match the origin you use in the browser. If you open the app at `http://127.0.0.1:3000`, either use `http://localhost:3000` in the browser, or change this value to `http://127.0.0.1:3000` and use that same origin in Google (Step 8).

---

## Step 4 — Open Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with the Google account that will own the OAuth client.
3. If Google asks you to accept terms, accept them.

---

## Step 5 — Create or select a project

1. Open the project picker at the top of the console.
2. Click **New Project**.
3. Project name: `TrueFit` (or anything you will recognise).
4. Click **Create**.
5. Select that project when it appears.

If you already have a project you want to reuse, select it instead.

---

## Step 6 — Configure the OAuth consent screen

Google has been moving this UI. Look for either **APIs & Services → OAuth consent screen** or **Google Auth platform → Branding**.

1. User type: **External** (unless you are on a Google Workspace and want **Internal**).
2. Click **Create**.
3. App name: `TrueFit`.
4. User support email: your Google account email.
5. Developer contact email: the same email (or another you monitor).
6. Save.

You do not need extra branding, a logo, or custom domains for local development.

### Scopes

Keep the default OpenID scopes:

- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `openid`

TrueFit only needs name and email.

### Publishing status

While the app is in **Testing**:

1. Open **Test users** (or **Audience**).
2. Add the Google account you will use to sign in.
3. Save.

If you skip this, Google will block the sign-in with an access-denied error until the app is published or the account is a test user.

---

## Step 7 — Create the OAuth client

1. Go to **APIs & Services → Credentials** (or **Google Auth platform → Clients**).
2. Click **Create credentials** → **OAuth client ID**.
   If Google asks you to finish the consent screen first, complete Step 6 and come back.
3. Application type: **Web application**.
4. Name: `TrueFit Web`.

---

## Step 8 — Add authorised origins and the redirect URI

These values must match exactly. No trailing slash on the origin.

**Authorised JavaScript origins**

```text
http://localhost:3000
```

**Authorised redirect URIs**

```text
http://localhost:3000/api/auth/callback/google
```

That callback path is required by NextAuth. Do not change it.

Click **Create**.

---

## Step 9 — Copy the Client ID and Client secret

Google shows a dialog with:

- **Client ID** — a long string ending in `.apps.googleusercontent.com`
- **Client secret** — a shorter secret string

Paste them into `.env.local`:

```bash
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret
```

No quotes. No spaces around `=`.

If you close the dialog, you can reopen the client from **Credentials** and copy the values again. You can also reset the secret there if it is lost.

---

## Step 10 — Confirm `.env.local`

Your file should look like this (with real values):

```bash
AUTH_SECRET=the-random-string-from-step-2
AUTH_GOOGLE_ID=xxxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=xxxxx
NEXTAUTH_URL=http://localhost:3000
```

Save the file.

---

## Step 11 — Restart the app

Next.js only reads env files at startup.

1. Stop `npm run dev` if it is running.
2. Start it again:

```bash
npm run dev
```

3. In [`lib/session.ts`](../lib/session.ts), set `userLoggedIn` to `false` so the landing page is shown.
4. Open [http://localhost:3000](http://localhost:3000).
5. Click **Continue with Google** or **Sign in**.
6. Choose a test-user Google account.

After Google approves the app, the browser returns to `/`. With the hardcoded flag still `false`, you will land on the landing page again. Set `userLoggedIn` back to `true` when you want the workspace.

---

## Production (later)

When TrueFit has a real domain, repeat the Google client settings with production URLs:

**Authorised JavaScript origins**

```text
https://your-domain.com
```

**Authorised redirect URIs**

```text
https://your-domain.com/api/auth/callback/google
```

Then set:

```bash
NEXTAUTH_URL=https://your-domain.com
```

Generate a new `AUTH_SECRET` for production. Do not reuse the local secret. Put all four variables in the host’s environment settings (Vercel, Railway, and so on), not in a committed file.

---

## If sign-in fails

| What you see | Likely cause |
| --- | --- |
| `redirect_uri_mismatch` | The redirect URI in Google is not exactly `http://localhost:3000/api/auth/callback/google` |
| `access_denied` / app is in testing | Your Google account is not a test user |
| `MissingSecret` / `[next-auth]: MissingSecret` | `AUTH_SECRET` is empty, or the dev server was not restarted |
| `invalid_client` | `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET` is wrong or has extra quotes |
| Browser origin errors | You opened `127.0.0.1` while `NEXTAUTH_URL` is `localhost`, or the JS origin is missing |
| Env values seem ignored | The file is not named `.env.local`, or it is not in the project root |

After any Google Console or `.env.local` change, restart `npm run dev`.
