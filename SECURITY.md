# Security rules

## Boundaries
- **Network exposure.** The server binds to `127.0.0.1`. `start()` refuses any non-loopback host unless
  `ATLAS_ALLOW_REMOTE=i-understand-the-risks` is set. That is only for a private, authenticated staging setup
  approved by the CEO (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). Never expose the backend publicly.
- **GitHub Pages** hosts only the static simulation. It has no backend, no keys and no company data. A CI guard
  fails the build if server code or key patterns reach the artifact.
- **Secrets** live only in `.env`, which is git-ignored, and stay server-side.
  - `npm run lint` scans tracked files for credential patterns and committed `.env` files.
  - Secrets are scrubbed from the environment of sandbox processes.
  - The GitHub token is passed to git through a per-command header, never through a remote URL.

## Controls in place
- **Authentication.** scrypt password hashes (min 10 chars). Sessions are random tokens stored as SHA-256 and
  sent as an HttpOnly, SameSite=Strict cookie (Secure when `ATLAS_SECURE_COOKIES=1`).
- **CSRF.** The Origin must match the Host, and mutations must be JSON.
- **Security headers.** CSP `default-src 'self'`; no inline scripts.
- **Authorization** is checked server-side on every route. Every query is scoped to the session's company, and
  CEO-only actions are separate routes.
- **Validation** with schemas on every body; size limits (413); generic 5xx messages.
- **Rate limits** on auth, agent, mutate and read buckets.
- **Audit log** is append-only and evaluations are immutable, both enforced by database triggers.
- **AI safety:**
  - per-role tool allowlists and a sandbox path policy, enforced in code;
  - a permission-restricted test runner and git hooks disabled;
  - untrusted-data wrapping against prompt injection;
  - CEO approval for plans, decisions and merges;
  - no agent tools for deploying, spending money, deleting, creating accounts or changing permissions.
- **Voice consent.** The UI asks before using browser speech recognition. Only text is stored. Audio is never
  sent to AI providers.

## Known gaps
See [docs/BLOCKERS.md](docs/BLOCKERS.md). Most importantly: sandbox test processes are **not network-isolated**,
and the Postgres RLS policies are **untested**.

## Privacy limitations
- **The GitHub repository `Nf24-AI/Atlas-company-` is PUBLIC.** All code, docs, plans and status notes in it
  are world-readable. Confidentiality cannot be claimed for anything committed. Changing visibility is the
  owner's decision; it was not changed.
- **The Claude account may be shared.** Work was done locally in this repository. No Claude Projects,
  shared Artifacts or external workspaces were created. Conversation history on a shared account may still be
  visible to other users of that account; that is outside this project's control.
- **LIVE mode** sends CEO requests and sandbox code to Groq and/or DeepSeek under their terms. **Browser speech
  recognition** in Chrome or Edge sends audio to the browser vendor's cloud.
- **Local data:** `data/atlas.sqlite` holds transcripts and plans in plain text on this machine. Protect backups.

## Reporting
Do not open public issues with exploit details. Contact the repository owner privately.
