# Deployment

## 1. Local (supported)
```bash
npm ci
cp .env.example .env     # optional: keys for LIVE mode; leave empty for DEMO
npm start                # http://127.0.0.1:3099
```
- First visit: create the CEO account. It is stored locally in `data/atlas.sqlite`.
- `PORT`, `ATLAS_DATA_DIR` and the budgets are configurable in `.env`.
- Verify with `curl http://127.0.0.1:3099/api/health` → `{"ok":true,...}`.
- Backups: see [DATABASE.md](DATABASE.md#backup-and-recovery).

## 2. DEMO mode (no paid APIs)
This is the default. Leave the keys empty, or remove one provider's key to keep only those employees in DEMO.
Every DEMO output is labelled in the UI and stored with `mode = demo`.

## 3. LIVE mode (local, paid usage)
1. Put `GROQ_API_KEY` and/or `DEEPSEEK_API_KEY` in `.env`. Never commit them.
2. Set conservative caps: `ATLAS_MONTHLY_BUDGET_USD=1`, and per-employee daily caps in the CEO workspace.
3. Restart. The employees whose provider has a key show **LIVE**.
4. Optional real PRs: set `SANDBOX_GITHUB_REPO=owner/repo` and `SANDBOX_GITHUB_TOKEN`. Use a fine-grained
   token restricted to that one dedicated repo, with Contents and Pull requests read/write only.

## 4. Static GitHub Pages demo
- Build locally with `npm run build:demo` (output in `dist/`). Preview with `npm run demo`.
- The `.github/workflows/pages.yml` workflow builds from the same sources, runs the tests and a secret/server-code
  guard, and publishes `dist/` only.
- **Enabling Pages requires the CEO.** Go to Settings → Pages → Source: GitHub Actions. The repo is public, so
  the demo will be public. It contains no backend or company data.
- After enabling it, verify the page loads, shows `STATIC DEMO`, and makes no requests outside the site.

## 5. Staging (requires approval)
Not deployed. A private, authenticated staging environment needs **CEO approval** and hosting authorization.
Minimum requirements:
- A private network or VPN, or an authenticating reverse proxy in front of the app, with HTTPS.
- `HOST=0.0.0.0`, `ATLAS_ALLOW_REMOTE=i-understand-the-risks`, `ATLAS_SECURE_COOKIES=1`, and
  `ATLAS_PUBLIC_ORIGIN=https://…`.
- A persistent disk for `data/`, plus backups.
- The sandbox runner in a container without network access. The Developer and QA execute code, so the host
  must not hold other secrets.
- Prefer the Supabase adapter (roadmap) for multi-user staging.
