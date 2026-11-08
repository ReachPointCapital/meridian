# Sign-in setup (Supabase)

Meridian's accounts, watchlist sync and saved notes run on [Supabase](https://supabase.com). This guide gets sign-in
working, and it is also the checklist to follow if sign-in ever stops.

## Why sign-in stopped

The project the site was pointed at (`ydlpctyipypvplrvmusq.supabase.co`) no longer exists on the internet: its address
fails to resolve, so every sign-in, sign-up, Google login and password reset fails before it reaches an account. The
usual cause is Supabase **pausing a free project after about a week without activity**. A paused project can be
restored from its dashboard for a limited time; after that it is deleted.

The site now says so plainly ("Sign-in is temporarily unavailable") instead of failing silently, but only a person with
access to the Supabase account can bring it back.

## 1. Restore the project, or make a new one

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and look for the project.
2. If it says **Paused**, click **Restore project** and wait a few minutes. Skip to step 5.
3. If it is gone, click **New project**, pick a region near your users and a strong database password, and wait for it
   to finish provisioning.
4. Open **Project Settings -> API** and keep two values handy: the **Project URL** and the **anon / publishable key**.
   (The anon key is meant to be public: it ships in the site's JavaScript. Never use the `service_role` key here.)

## 2. Create the tables

Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](../supabase/schema.sql) and click **Run**. It creates
`watchlists` and `notes` with row-level security, so each user can only reach their own rows. Running it twice is safe.

## 3. Turn on the sign-in methods

**Authentication -> Providers**

- **Email**: enable it. Decide whether **Confirm email** is on. On is safer (people must prove they own the address);
  the site handles both.
- **Google** (optional, it powers the "Continue with Google" button):
  1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials) create an **OAuth client ID**
     (type: Web application).
  2. Add this **Authorized redirect URI**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
  3. Paste the client ID and secret into Supabase's Google provider and save.

## 4. Tell Supabase which sites may use it

**Authentication -> URL Configuration**

- **Site URL**: `https://meridian.reachpointcapital.com`
- **Redirect URLs** (all of these, so confirmation and reset links work everywhere):
  - `https://meridian.reachpointcapital.com/**`
  - `https://*-reachpointlabs-projects.vercel.app/**` (Vercel preview deployments)
  - `http://localhost:3000/**` (local development)

Without these, email links open the wrong site or are refused.

## 5. Point the site at the project

The values are baked into the site when it is built, so changing them needs a new deploy.

- **Vercel**: Project -> Settings -> Environment Variables. Set both for **Production** and **Preview**:
  - `REACT_APP_SUPABASE_URL` = the Project URL
  - `REACT_APP_SUPABASE_ANON_KEY` = the anon / publishable key

  Then redeploy (Deployments -> the latest -> Redeploy).
- **Local development**: put the same two lines in `.env.local` (it is git-ignored), then restart `npm start`.

## 6. Check that it works

1. Open the site, click **Sign In**, and confirm there is no "temporarily unavailable" banner.
2. **Create account** with a real email. Open the confirmation email and follow the link (it should return to the site).
3. **Sign in**, add a ticker to the watchlist, and reload: it should still be there. Sign in on another device: the same.
4. On the Analysis page, write a note and save it; reload and check it comes back.
5. **Forgot password**: the reset link should open the "Set a new password" page, not hang on "Verifying".
6. **Continue with Google** completes and returns signed in.

## Keeping it from pausing again

Free projects pause when idle. Either upgrade the project to a paid plan, or make sure something calls it at least every
few days (for example a weekly scheduled request to `https://<project-ref>.supabase.co/auth/v1/health`).
