# Test results

Actual results from runs on 2026-11-21. Environment: Windows 11, Node v24.19.0, Playwright 1.65.1 with its
bundled Chromium, Firefox and WebKit. CI (`.github/workflows/ci.yml`) runs the same commands on Ubuntu.

| Command | Result |
|---|---|
| `npm run lint` (syntax check of all JS + secret scan + no committed `.env`) | ✅ 111 files OK |
| `npm test` (node:test: unit, API, DB, permission, workflow, sandbox, providers) | ✅ 40 / 40 pass |
| `npx playwright test` (setup + Chromium, Firefox, WebKit, mobile Pixel 7) | ✅ 28 pass, 3 skipped (mobile-only test on desktop projects) |
| `npm audit` | ✅ 0 vulnerabilities |
| Static demo build + Pages guard (no keys/server code in `dist`) | ✅ |

The 3D renderer was Three.js (WebGL) in all three engines. The Canvas2D fallback is reachable with `?canvas`.

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
