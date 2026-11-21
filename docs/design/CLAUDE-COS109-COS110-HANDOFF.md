# Claude execution handoff — ATLAS Design / Gameplay / Work Management
**Companion issues:** [COS-109 #11](https://github.com/Nf24-AI/Atlas-company-/issues/11), [COS-110 #12](https://github.com/Nf24-AI/Atlas-company-/issues/12). Read [Visual Blueprint](ATLAS-VISUAL-BLUEPRINT.md) and [SVG design board](ATLAS-REFERENCE-SHEET.svg).

**Five original concept images** are in the user-delivered `ATLAS-Visual-Blueprint.zip` and must be copied (only with the CEO's permission) to `docs/design/concepts/` in the *public* repository. This design branch itself contains the editable SVG design board plus textual blueprint, **not the five raster concept images**. Please don't claim they've been uploaded unless you can see their files in GitHub.

## Step 0 — baseline
- Before changing code, verify current `main`, read `CLAUDE.md`, `docs/PROJECT-HUB.md`, `docs/cos-108/REPORT.md` and check issue #11/#12.
- Note that current COS-108 provides a **follow** and **overview** camera; do not judge visual quality only in overview.
- Record browser screenshots at fixed camera/player positions and real browser FPS where possible.

## Phase 1 — Manager office art vertical slice / COS-109
- One office only, not full building. Replace simple primitives with cohesive original/licensed desk, chairs, accessories, avatar, trim, glass and room lighting within an agreed draw-call/triangle/material budget.
- Scene readability and character proportions at third-person distance are more important than tiny details.
- Include matched actual runtime before/after screenshots, measured FPS and accessibility. Compare against concept `01` and `04`; these are aspirational targets rather than exact renders.
- Do not merge before CEO approves look.

## Phase 2 — Third-person locomotion / COS-110A
- Offer immersive movement as an opt-in mode using mouse yaw/pitch + camera-relative WASD, Shift sprint, E interact, Esc to unlock, V overview. Implement camera obstruction checks, walk/run blend, reset, sensitivity slider, Arabic keys, lost focus handling.
- Don't break old follow/overview; keep UI keyboard accessible and pointer-lock voluntary. Test camera-relative vector math, collision, focus/overlay behavior, speed/frame independence.
- Open standalone PR.

## Phase 3 — ATLAS Work / COS-110B
- Implement a thin end-to-end slice using current company project/task state and backend authorization. CEO presses E at board or Tab → sees actual tasks; opens item; comments and assigns; real task states + audit persist.
- A Jira-inspired UI, not a copied Jira product. Prioritize Task/Bug/Epic, statuses, Kanban, acceptance criteria, evidence links, comments, approval gates. Sprint/dependency views can follow once MVP slice tested.
- Open standalone PR with tests. No floating permanently-on kanban in ordinary roaming mode.

## Phase 4 — Comms and employees / COS-110C,D
- Employee inbox, task-linked messages, @mentions, unread and permission-controlled agent calls, synchronous response or queued worker with honest statuses; no fake background work.
- Product Manager / BA and Product Designer first as real typed role configs and bounded tools, not fake agent portraits. Receptionist and simulated guests can be opt-in NPCs, no actual outbound email or invitations.
- Growth, support, finance, security later once company needs them. Protect privacy and minimize model spend.

## Required tests and delivery
Run `npm ci`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build:demo` with real outputs. Document skipped/unverified features. Measure browser viewport occlusion, floor discoverability, FPS, visual clarity, accessibility and supported input modes. No automatic merges, paid models, hosting, third-party sharing or user-data commits.

**The design SVG and concept renders are not implemented game art.** Claude must produce actual in-engine improvements and screenshots, not merely re-save concept pictures as game evidence.
