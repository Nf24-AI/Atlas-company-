# COS-108 — Immersive Office Experience
**Status:** Ready for implementation (brief/spec only; no gameplay code changed by this setup commit)  
**Repository:** https://github.com/Nf24-AI/Atlas-company-  
**Issue:** https://github.com/Nf24-AI/Atlas-company-/issues/8  
**Branch:** `cos-108-immersive-office-experience`  
**Owner:** Claude Code (implementation), CEO (acceptance)

## CEO intent and observations
Reference: three screenshots provided on 2026-11-21 showing an extremely elevated/isometric camera, an oversized constant right employee panel, a left minimap occupying part of the scene, sparse floors and stationary-looking employees. The baseline is playable and must be preserved.

### Baseline facts verified in repository
- `public/js/world/world-data.js` is the canonical source for geometry, collision, room locations and interactivity.
- `public/js/world/renderer-three.js` uses Three.js; Canvas2D fallback exists.
- `public/js/ui/panels.js` is the CEO/workflow UI.
- Node 22.13+, `npm ci`, `npm run lint`, `npm test`, `npm run test:e2e`.
- `docs/STATUS.md` and `docs/HANDOVER.md` still have obsolete statements that COS-102..107 PRs await merge. All of #3, #4, #5, #6 were merged on 2026-11-21, with #6 integrated into #5 before #5 landed.

## Product direction: Stylized Reality, not photorealism
Maintain the recognizable teal/cream/wood ATLAS palette. Balance clear game controls and an aspirational office aesthetic, not GTA-scale assets. Atmosphere is secondary to reliable actionable company workflows.

## Sequence and work packages
### 108-A — Camera composition (P0)
Inspect camera controller, its defaults and actual zoom/pitch. Implement closer default follow perspective without breaking LOS, map comprehension, orbit, collision or movement direction. Add accessible toggle between follow and high-level overview (reuse existing controls if present); support re-center. Do not globally shrink the world to solve a camera problem. Measure player pixel height relative to screen at 1280×720 and compare before/after.

### 108-B — HUD and clutter (P0)
Right employee roster and left floor-map should be collapsible with visible buttons and keyboard access. Keep accessible top controls, the DEMO/LIVE badge and proximity prompt. Default roam UI should minimize persistent occlusion; make full company information available on demand. Persist collapse preference locally only where appropriate; honor RTL/mobile; do not hide essential consent/security notices.

### 108-C — Real-time employee presence (P0)
Map backend work status to appropriate procedural human animations and office visual signals: available, planning, meeting, executing, reviewing, blocked, awaiting approval and completed. Status must come from actual state/store, not a running decorative timer. In static demo explicitly label simulation. If status is unknown, show idle/unknown. Ensure state changes survive refresh where persistence already exists.

### 108-D — Environment and interactions (P1)
Add deliberate lightweight details to key rooms: Manager office, Director office, CEO office, Meeting, Developer, QA, Operations. Signage with legible Arabic and spatial wayfinding. Clear paths and colliders always derived from world-data. Add understated ambient feedback and proximity/focus cues, keep sightlines and collision integrity, no interaction through walls. Check Canvas2D fallback parity.

### 108-E — QA evidence (P0)
Before modifying code, run and record baseline tests. After implementing, run:
```
npm ci
npm run lint
npm test
npm run test:e2e
npm run build:demo
```
Add test coverage for camera resets and perspective modes, HUD toggle and keyboard/touch accessibility, employee state fidelity, collision/LOS and full CEO→PM→Director→Developer→QA workflow. Run browsers available, including mobile viewport, distinguish simulated environments from physical devices. If a test fails, document and fix. Do not skip or remove tests to manufacture green results.

### 108-F — Deliverable (P0)
- Produce consistent **before/after** screenshots from matched camera coordinates and scene state (not different angles).
- Write `docs/cos-108/REPORT.md`: problem, files, UX rationale, measurements/performance, real test output, limitations and security impact.
- Update `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/HANDOVER.md`, `docs/CHANGELOG.md` with truthful status. Fix stale COS-102..107 “awaiting review” lines.
- Open PR against `main`, link issue #8, give complete test artifacts.
- STOP. CEO reviews and explicitly approves merge; no direct push to main.

## Constraints
- Local backend stays localhost-only; no public exposure or new paid services.
- Public repository is world-readable. Do not commit secrets, confidential screenshots or user conversations.
- No unrelated refactor/rewrite, no new framework unless independently justified and approved.
- Do not modify auth, RLS, model credentials or external sandbox permissions without necessity and approval.
- Keep project as immersive 3D, **not a chat-first app**.
- Respect data-driven work states: no fake "working" animations for idle agents.
- Check existing issues/branches and coordinate with any concurrent work before editing.
- Changes must be incremental, tested and auditable.

## Acceptance
CEO can enter the browser game, find the avatar easily, move around comfortably, use the office interactions without HUD obstruction, inspect meaningful employee states, view an appealing but performant scene, and still complete original company work flows without regressions.

## Exact first instruction to Claude
> Read `CLAUDE.md`, `docs/PROJECT-HUB.md`, this file and issue #8. Checkout the existing `cos-108-immersive-office-experience` branch, verify the latest `main` baseline and test it. Implement all 108-A through 108-F, commit in reviewable increments, run all checks, open a PR, and stop without merging or deploying. Do not ask for approval for normal reversible local development tasks. Report blockers precisely rather than claiming unverified success.
