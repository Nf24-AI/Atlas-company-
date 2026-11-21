# Status — 2026-11-21

## Work orders

| ID | Title | State | Branch / PR |
|---|---|---|---|
| COS-101 | Gameplay foundation | ✅ merged (PR #2) | `main` |
| COS-102 | Modular frontend, shared geometry/collision, LOS, pinch zoom, smoke tests | 🔍 awaiting CEO review | PR #3 · `cos-102-frontend-modules` |
| COS-103 | ADR-001 production architecture | 🔍 awaiting CEO review | PR #4 · `cos-103-architecture-adr` (stacked on #3) |
| COS-104 | Persistent backend: auth, authorization, validation, rate limits, migrations, audit | 🔍 awaiting CEO review | PR #5 · `cos-104-106-company-os` (stacked on #4) |
| COS-105 | Independent AI employees (provider-agnostic, budgets, retries, failure states) | 🔍 awaiting CEO review | PR #5 |
| COS-106 | Developer + QA in a sandbox repo, CEO approvals, tool allowlists | 🔍 awaiting CEO review | PR #5 |
| COS-107 | Immersive 3D office, live status, voice, CEO workspace | 🔍 awaiting CEO review | PR #6 · `cos-107-immersive-office` (stacked on #5) |

The PRs are **stacked**: each branch builds on the previous one. Review and merge them in order. Nothing is
merged without CEO approval. **PR #5 and PR #6 must be merged together.** On #5 alone, the browser UI still targets
the old API, and its e2e CI job fails.

## What works (verified by automated tests — see [TEST-RESULTS.md](TEST-RESULTS.md))

- Local CEO account (setup/login), HttpOnly session, same-origin + JSON-only mutations, rate limits.
- SQLite persistence with migrations; data survives restarts; per-company isolation.
- Meetings with any employee by text or push-to-talk voice (browser speech, consent first), transcripts stored.
- Manager plans a project → escalates decisions → Director reviews → CEO approves plan and decisions.
- Developer edits files, runs tests and commits on a branch in the sandbox repo; QA writes its own tests,
  the system re-runs them and overrides a false "pass"; bounded rework; CEO approves the merge.
- System and CEO evaluations (append-only); costs, budgets, emergency stop/resume; audit log.
- 3D office with walls, doors, collision, line-of-sight interaction, mini-map, live status beacons.
- Static demo for GitHub Pages (simulated, no backend).

## What is not verified

- **LIVE AI** was only exercised against a mock OpenAI-compatible server. No real Groq/DeepSeek keys were used.
- **Supabase/Postgres + RLS** schema (`supabase/migrations/0001_init.sql`) has not been executed.
- **GitHub sandbox PRs** (`SANDBOX_GITHUB_*`) were not exercised against a real repo.
- Voice recognition was not tested with a real microphone (automated browsers have none).

## Pending CEO approvals

1. Review and merge the stacked PRs in order (102 → 103 → 104-106 → 107).
2. Decide whether to enable GitHub Pages for the static demo. The demo is public and labelled as a simulation.
3. Optional: provide Groq/DeepSeek API keys locally (`.env`) to switch employees to LIVE (paid usage).
4. Optional: create a dedicated sandbox GitHub repo and a fine-grained token for real PRs.
5. Optional: a Supabase project and staging hosting. Both need approval and hosting authorization.
6. Keep the main repo public, or make it private. Visibility is your decision; it was not changed.
