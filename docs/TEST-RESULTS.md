# Test results

## COS-108 (merged in PR #9), 2026-11-21

| Command | Baseline (`main`) | After COS-108 |
|---|---|---|
| `npm ci` | ok | ok |
| `npm run lint` | 112 files OK | 128 files OK |
| `npm test` | 40 / 40 | 52 / 52 |
| `npx playwright test` (setup, Chromium, Firefox, WebKit, Pixel 7 emulation) | 28 passed, 3 skipped | 63 passed, 6 skipped, 0 failed (4.9 min) |
| `npm run build:demo` | ok | ok |
| `npm audit` | 0 vulnerabilities | 0 vulnerabilities |

Skipped tests are mobile-only tests in desktop projects. **CI on PR #9 (Ubuntu): 61 passed, 8 skipped, 0 failed.** The two extra skips
are the 3D camera-framing tests in Firefox, which has no WebGL on the runner and uses the Canvas2D fallback. Two earlier full runs each had a Firefox failure
before any test code ran (Playwright could not open a browser context: a 1.8 h hang, then "Unable to restore
IndexedDB"; the app does not use IndexedDB). Firefox passed 20 / 20 when re-run. Details and the WebKit test
fix are in [cos-108/REPORT.md](cos-108/REPORT.md#test-results-actual-runs-windows-11-node-24190-playwright-1651).

## COS-102 → COS-107 (merged)

Actual results from runs on 2026-11-21. Environment: Windows 11, Node v24.19.0, Playwright 1.65.1 with its
bundled Chromium, Firefox and WebKit. CI (`.github/workflows/ci.yml`) runs the same commands on Ubuntu; it passed on PRs #3, #4 and #6, failed on PR #5 alone (see below), passed on PR #5 once #6 was merged into it,
and passed on `main` after the merge (`502c1dd`).

| Command | Result |
|---|---|
| `npm run lint` (syntax check of all JS + secret scan + no committed `.env`) | ✅ 111 files OK |
| `npm test` (node:test: unit, API, DB, permission, workflow, sandbox, providers) | ✅ 40 / 40 pass |
| `npx playwright test` (setup + Chromium, Firefox, WebKit, mobile Pixel 7) | ✅ 28 pass, 3 skipped (mobile-only test on desktop projects) |
| `npm audit` | ✅ 0 vulnerabilities |
| Static demo build + Pages guard (no keys/server code in `dist`) | ✅ |

The 3D renderer was Three.js (WebGL) in all three engines. The Canvas2D fallback is reachable with `?canvas`.

## CI failure on PR #5 alone (resolved)
PR #5 (COS-104/105/106) replaces the backend API and adds authentication, but the browser UI and e2e tests
on that branch are still the COS-102 versions written for the old API. The 16 browser tests fail with
timeouts, because the old UI never becomes ready. The unit and API suites pass. The matching UI and e2e
tests arrive in PR #6, where CI passes.
Resolution: PR #6 was merged into PR #5's branch first. CI on the combined PR #5 passed, and it was then merged.

## Coverage by category
- **Unit / collision:** `tests/game-core.test.mjs`
  - walls, doorways, desks, sliding, tunnelling, boundaries, reachability flood fill;
  - line of sight, pinch zoom, camera clamps;
  - every collider backed by geometry; tessellation.
- **API / auth / security:** `tests/workflow.test.mjs`
  - 401 without a session;
  - CSRF origin 403, form-encoded 415, password policy, one-time setup, login;
  - rate limit 429, emergency stop 423, persistence across restart.
- **DB:** migrations at startup; append-only audit and immutable evaluations (triggers); per-company data
  isolation (`tests/agents.test.mjs`).
- **Permissions / sandbox:** `tests/agents.test.mjs`
  - path policy (traversal, absolute paths, `.git`, `.env`, symlinks, role scopes);
  - tool allowlist denial;
  - test runner confined by `node --permission`;
  - timeout.
- **Providers:** pricing and peak hours, budget refusal, retries on 429/5xx, unpriced model refusal, reasoning
  discarded. LIVE tool loop against a **mock** OpenAI-compatible server.
- **Workflow:**
  - full acceptance flow over HTTP: meeting challenge, project, plan, escalation, Director review, CEO
    approvals;
  - Developer commits; QA's real failing test (QA-2) leads to rework, then pass;
  - CEO merge and evaluations.
  - A QA false-pass is overridden, with bounded rework ending in `blocked`.
- **E2E (browser):** `tests/e2e/smoke.spec.mjs`
  - setup through the UI; walls and doorways; no interaction through walls; E/Esc;
  - text meeting persisted; **full acceptance flow through the UI**; emergency stop and resume;
  - RTL/LTR toggle; mobile touch controls; static demo with no external requests.

## Not covered (honestly)
- **RLS:** `supabase/migrations/0001_init.sql` was not executed. There was no Docker daemon and no Supabase
  project.
- **Real providers:** no Groq or DeepSeek call was made. That needs keys and costs money.
- **Real GitHub PR creation** in a sandbox repo: no token or repo was provided.
- **Voice:** a real microphone and speech recognition cannot be automated in headless browsers. The consent
  flow and the text fallback are exercised.
