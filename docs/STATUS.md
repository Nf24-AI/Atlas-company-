# Status — 2026-11-21

## Work orders

| ID | Title | State | Branch / PR |
|---|---|---|---|
| COS-101 | Gameplay foundation | ✅ merged (PR #2) | `main` |
| COS-102 | Modular frontend, shared geometry/collision, LOS, pinch zoom, smoke tests | ✅ merged | PR #3 · `d88658b` |
| COS-103 | ADR-001 production architecture | ✅ merged | PR #4 · `bd7af5b` |
| COS-104 | Persistent backend: auth, authorization, validation, rate limits, migrations, audit | ✅ merged | PR #5 · `502c1dd` |
| COS-105 | Independent AI employees (provider-agnostic, budgets, retries, failure states) | ✅ merged | PR #5 |
| COS-106 | Developer + QA in a sandbox repo, CEO approvals, tool allowlists | ✅ merged | PR #5 |
| COS-107 | Immersive 3D office, live status, voice, CEO workspace | ✅ merged | PR #6 · `96bde23` (into #5's branch, landed with #5) |
| COS-108 | Immersive office experience: camera, HUD, employee presence, environment | 🔍 awaiting CEO review | Issue #8 · `cos-108-immersive-office-experience` |

All four PRs were merged into `main` on 2026-11-21 with CEO approval, in order, using merge commits.
PR #6 was merged into PR #5's branch first, so `main` never held the new backend without its UI. CI passed
on the combined PR #5 and on `main` after the merge.

## COS-108 in review
Close follow camera with optional overview (V) and re-centre (R); collapsible roster (T) and map (M); employee
poses and status rings driven only by real store data; bilingual signage, wayfinding and room details. Evidence:
[cos-108/REPORT.md](cos-108/REPORT.md). Not merged; it needs CEO review.

## What works (verified by automated tests — see [TEST-RESULTS.md](TEST-RESULTS.md))

- Local CEO account (setup/login), HttpOnly session, same-origin + JSON-only mutations, rate limits.
- SQLite persistence with migrations; data survives restarts; per-company isolation.
- Meetings with any employee by text or push-to-talk voice (browser speech, consent first), transcripts stored.
- Manager plans a project → escalates decisions → Director reviews → CEO approves plan and decisions.
- Developer edits files, runs tests and commits on a branch in the sandbox repo; QA writes its own tests,
  the system re-runs them and overrides a false "pass"; bounded rework; CEO approves the merge.
- System and CEO evaluations (append-only); costs, budgets, emergency stop/resume; audit log.
- 3D office with walls, doors, collision, line-of-sight interaction, mini-map, live status beacons.
- (COS-108 branch) Follow/overview camera, collapsible HUD, room entry cues, status-driven poses and signage.
- Static demo for GitHub Pages (simulated, no backend).

## What is not verified

- **LIVE AI** was only exercised against a mock OpenAI-compatible server. No real Groq/DeepSeek keys were used.
- **Supabase/Postgres + RLS** schema (`supabase/migrations/0001_init.sql`) has not been executed.
- **GitHub sandbox PRs** (`SANDBOX_GITHUB_*`) were not exercised against a real repo.
- Voice recognition was not tested with a real microphone (automated browsers have none).

## Pending CEO approvals

1. Decide whether to enable GitHub Pages for the static demo. The demo is public and labelled as a simulation.
   Until Pages is enabled (or the workflow is disabled), the "Publish static game demo" workflow fails on every
   push to `main` at `configure-pages` ("Get Pages site failed"). Nothing is published.
2. Optional: provide Groq/DeepSeek API keys locally (`.env`) to switch employees to LIVE (paid usage).
3. Optional: create a dedicated sandbox GitHub repo and a fine-grained token for real PRs.
4. Optional: a Supabase project and staging hosting. Both need approval and hosting authorization.
5. Keep the main repo public, or make it private. Visibility is your decision; it was not changed.
