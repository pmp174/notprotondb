# NotProtonDB

A community compatibility database for Windows games running on macOS through NotProton and CrossOver.

This repository contains:
- A responsive React + Vite website.
- Supabase PostgreSQL schema, row-level security policies, and aggregate compatibility view.
- GitHub Actions deployment to GitHub Pages.
- A report submission flow and email/password authentication.
- A public catalogue and game detail pages.

## Architecture

- **Frontend:** React, TypeScript, Vite
- **Hosting:** GitHub Pages (free for public repositories)
- **Backend:** Supabase (PostgreSQL + Auth; free tier to start)
- **Deployment:** GitHub Actions on pushes to `main`

GitHub Pages is static hosting. Supabase provides the database and authentication. The browser uses only the Supabase anon/publishable key, protected by row-level security (RLS).

## 1. Create the Supabase project

1. Create a free project at https://supabase.com/.
2. Open **SQL Editor → New query**.
3. Copy and run all of [`supabase/schema.sql`](supabase/schema.sql).
4. Open **Project Settings → API**.
5. Copy the Project URL and anon/publishable key.

Do not use the `service_role` key in this website. It must never be exposed in browser code.

### Configure authentication

In Supabase:
1. Open **Authentication → URL Configuration**.
2. Set the Site URL to your eventual GitHub Pages URL, for example:
   `https://YOUR-GITHUB-USERNAME.github.io/notprotondb/`
3. Add that URL to the Redirect URLs allowlist.
4. Under **Authentication → Providers**, make sure Email is enabled.

For local testing, also add `http://localhost:5173/**` to Redirect URLs.

### Approve game suggestions

New game suggestions are inserted with `review_state = 'pending'` and are not visible in the public catalogue until approved.

For the MVP, review suggestions in **Supabase → Table Editor → games**. Change `review_state` to `approved`. Reject spam by setting it to `rejected`.

## 2. Run locally

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Then:

```bash
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

To test the production build:

```bash
npm run build
npm run preview
```

## 3. Deploy through GitHub Pages

1. Create a **public** GitHub repository named `notprotondb` (or another name).
2. Upload/push the contents of this project to the repository's `main` branch. Do not upload `node_modules`, `dist`, or a real `.env` file.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. Open **Settings → Secrets and variables → Actions → Variables**.
6. Add these repository variables:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/publishable key
7. Push a commit to `main`, or manually run **Actions → Deploy NotProtonDB to GitHub Pages → Run workflow**.
8. When the workflow finishes, GitHub will show the published Pages URL.

The workflow in `.github/workflows/deploy.yml` builds the site and deploys the `dist` directory. Vite uses relative asset paths so it works at a GitHub Pages project URL.

## 4. First data

The public catalogue starts empty by design. Sign up through the website, submit a game suggestion, approve it in Supabase, then submit a compatibility report.

For initial testing, you can also insert an approved game directly in Supabase SQL Editor:

```sql
insert into public.games (title, steam_app_id, review_state)
values ('Example Game', '123456', 'approved');
```

Do not seed fictional compatibility reports or ratings. Reports should represent actual tests.

## 5. How compatibility ratings work

The initial rating logic is deliberately transparent:
- **Platinum:** at least 3 reports, at least 90% positive, and no "does not work" reports.
- **Gold:** at least 80% positive.
- **Silver:** at least 60% positive.
- **Bronze:** at least 35% positive.
- **Borked:** below 35% positive.
- **Untested:** no reports.

"Positive" currently means `works` or `minor_issues`. These are starter thresholds, not a validated benchmark. Revisit them once the database has enough real reports. Always show report count, test date, and configuration details alongside the summary.

## 6. NotProton app integration (next phase)

The app can call Supabase directly using its public anon key for read-only compatibility lookups, because RLS allows public reads of approved games and reports.

Recommended lookup:
- Query `games` by `steam_app_id` or internal game UUID.
- Query `game_compatibility` for the aggregate summary.
- Query `reports` filtered by `game_id` for report detail.

For report submission from NotProton:
- Require the user to sign in using Supabase Auth (or add a dedicated backend endpoint later).
- Submit the report with the authenticated user's access token.
- Never embed a Supabase service-role key in the macOS app.
- Do not silently submit telemetry. Ask for explicit opt-in, show the collected fields, and let the user confirm before publishing.
- A launch event alone is not evidence that a game is playable. Prompt the user after a session and let them choose the result.

Suggested future API contract:
- `GET /games?steam_app_id=...`
- `GET /game_compatibility?game_id=eq.<uuid>`
- `GET /reports?game_id=eq.<uuid>&order=tested_at.desc`
- `POST /reports` (authenticated user)

## 7. Current MVP limitations

- Game suggestions require manual approval in Supabase.
- Email/password authentication is implemented; OAuth providers are not configured.
- There is no admin dashboard yet.
- The compatibility score is a simple summary, not a hardware-weighted or time-decayed model.
- There is no automated crash detection or background telemetry.
- The website currently uses generated abstract game tiles rather than copyrighted game cover art.
- User profiles, report voting, duplicate report controls, and moderation queues are planned follow-ups.

## License

Choose a license before accepting outside code contributions. MIT is a permissive default for the application code, but confirm that it matches the NotProton project's ownership and contribution expectations.
