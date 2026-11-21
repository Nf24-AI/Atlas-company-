# Work orders for Claude — do them in order

> Status (2026-11-21): COS-101 → COS-107 merged into `main`. See [STATUS.md](STATUS.md).

## COS-101 — Gameplay foundation hardening (START HERE)
**Owner:** Claude. **Type:** Game engineering. **Scope:** improve existing local prototype, not a rewrite.

Tasks:
1. Inspect the current movement/camera/interaction code and write a brief defect list.
2. Implement simple collisions against the two room partitions, desk obstacles, and map boundaries. Existing build only clamps the map boundaries; no furniture collisions. Allow walkable doors.
3. Make camera orbit/zoom (mouse drag + wheel) OPTIONAL without breaking default easy-to-use isometric follow camera; avoid motion sickness.
4. Preserve E-to-interact, WASD, mobile buttons, responsive Arabic UI and both offices.
5. Add automated tests for pure movement/collision functions (extract to small module rather than tightly coupled WebGL state); document browser manual test steps.
6. Run `npm test` and report results with file paths and screenshots when practical.

**Definition of done:** CEO can walk around the office without passing through walls/desks; interaction and approvals still function; tests pass; no sensitive API changes; first deliverable is a small PR/diff.

## COS-102 — Modularize front end
Extract small modules from `public/app.js` (world, controller, interaction, API client, voice, UI). Preserve exact core experience and add browser smoke tests. Do not introduce a framework merely for its own sake.

## COS-103 — Production architecture proposal
Compare Next.js/React Three Fiber migration vs maintaining WebGL renderer. Produce ADR with cost, performance, test, and deployment tradeoffs. Implement migration only in a separate, reviewable work order after CEO acceptance. Prefer stable R3F v9 with React 19, not alpha v10.

## COS-104 — Safe multi-user/cloud foundation
After user supplies a Supabase project, add Auth + authorization + RLS and persisted project/task/decision/audit entities; use a database migration and test RLS. Never deploy unsafe demo endpoints publicly.

## COS-105 — AI orchestration and evaluation
Server-side providers with robust schema validation, timeouts, audit, retry/limits and usage tracking. Keep Manager and Director distinct; approved drafts only. Add evidence-based performance evaluation.

## COS-106 — Developer + QA toolchain
CEO-approved GitHub sandbox. Developer creates a branch+PR, QA runs automated test evidence and independently reviews it. No auto-merge, public deploy, or billing changes.

## COS-107 — Browser game polish + voice
Improve avatar visual quality, animation, lighting, office assets (license verified), spatial feedback, Arabic voice fallback and performance. Preserve core flows.

## Every work order must include
- Scope boundaries and design rationale
- Modified files
- Tests actually run and results
- Screenshots or other reproduction evidence where relevant
- Known limitations, security impact and next decision required
