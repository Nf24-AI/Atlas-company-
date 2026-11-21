# Changelog

## [0.3.0] — 2026-11-21 (merged into `main`: PRs #3–#6; not tagged or deployed)

### COS-107 — Immersive office
- Three.js r187 renderer (MIT) built from the shared world data: lighting, shadows, sliding glass doors, live
  monitors. Canvas2D fallback kept (`?canvas`).
- Full floor: CEO, Project Manager and Technical Director offices, developer and QA areas, meeting room,
  operations center, reception, lounge.
- Procedural humanoids (original code, no external assets) with walk, idle and status poses. Typing is shown
  only while the employee is really `executing`.
- Mini-map with live status dots and click-to-travel; world labels show live status.
- New UI on the company API:
  - auth gate;
  - employee offices: voice/text meetings, plus role work;
  - meeting room transcripts;
  - operations kanban;
  - CEO workspace: overview, tasks, approvals, deliverables/diffs/QA evidence, evaluations, costs and budgets,
    audit.
- Arabic-first RTL with an English toggle; loading, empty and error states; touch controls.
- Static Pages demo backend rewritten for the new API (all output labelled SIMULATED).
- `npm run lint` (syntax check + secret scan); Playwright projects for Chromium, Firefox, WebKit and mobile.

### COS-104 / 105 / 106 — Company OS backend and AI workforce
- Node HTTP server with `node:sqlite`, SQL migrations, append-only audit and evaluations.
- Auth (scrypt, hashed session tokens, HttpOnly SameSite=Strict cookie), origin check, JSON-only mutations,
  validation, rate limits, CSP and security headers. Binds to loopback only.
- Provider-agnostic employees (OpenAI-compatible): timeouts, bounded retries, max steps, pre-call budget
  checks, cost tracking, failure states. Reasoning is never stored or shown.
- Developer and QA tool loops in a per-project sandbox git repo, with path policy, a role tool allowlist and
  a permission-restricted test runner. CEO approval is required for plan, decisions and merge.
- Supabase/Postgres schema with RLS (not yet executed).

### COS-103
- ADR-001: Three.js + Node + SQLite, Supabase-ready. Next.js/R3F rejected for the MVP.

### COS-102
- Modular ES-module frontend, one world/collision source, line-of-sight interaction, pinch zoom.
- Monolith demo removed; static demo built from the same sources.

## [0.1.0] — COS-101 (merged, PR #2)
- Collisions, optional orbit camera, testable movement core.
