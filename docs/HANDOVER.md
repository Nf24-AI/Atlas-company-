# Handover

For whoever (human or AI) continues ATLAS. Read [PROJECT-HUB.md](PROJECT-HUB.md) first.

## State on 2026-11-21
- `main` contains COS-101 → COS-107. PRs #3, #4, #5 and #6 were merged on 2026-11-21 (`main` at `502c1dd`).
- CI passes on `main`. The Pages workflow fails because GitHub Pages is not enabled (a pending CEO decision).
- COS-108 (issue #8) is on `cos-108-immersive-office-experience` with a PR awaiting CEO review. See
  [cos-108/REPORT.md](cos-108/REPORT.md).
- The old feature branches (`cos-102-…` to `cos-107-…`) still exist on the remote and can be deleted when no longer needed.
- No production, staging or Pages deployment exists. There are no API keys in the environment.

## How the code fits together
- **World**
  - `public/js/world/world-data.js` is the single source for geometry, colliders, doors, screens, rooms, NPCs
    and interactables. Rendering and collision both come from it.
  - Change the layout there, then run `npm test`. The flood-fill and line-of-sight tests catch unreachable
    spots.
- **Camera / HUD / presence (COS-108)**
  - Camera presets and limits: `CAMERA_PRESETS` in `public/js/core/game-core.js`. Keep both presets on the same
    yaw, or WASD stops being screen-relative.
  - `public/js/world/presence.js` is the only status → pose mapping. Add a backend status there first; the unit
    test compares it with `EMPLOYEE_STATUSES`.
  - `public/js/ui/hud.js` owns the collapsible roster and map (`localStorage` key `atlas-hud-v1`).
  - Signs are data (`sign()` / `pylon()` in world-data.js) and are drawn by both renderers.
  - `node scripts/capture-cos108.mjs <label>` reproduces the matched screenshots and measurements.
- **Renderers**
  - `renderer-three.js` is the default; `humanoid.js` draws the characters.
  - `renderer-canvas.js` is the fallback (`?canvas`).
  - Both consume the same primitives.
- **UI**
  - `public/js/ui/store.js` polls `GET /api/state`; `panels.js` renders offices and the CEO workspace.
  - All model output is passed through `esc()`. Keep it that way.
- **Server**
  - `server/routes.js` holds the HTTP surface and `server/repo.js` the SQL, always scoped by `companyId`.
  - `server/agents/orchestrator.js` drives the workflows; `jobs.js` is the per-company queue and stop.
  - `providers.js` handles the models, pricing and budgets; `employees.js` holds the prompts and schemas.
- **Sandbox:** `server/tools/*` contains the path policy, git, the test runner, GitHub and the tool registry. The
  template repo for new projects is `server/sandbox-template/`.
- **Static demo:** `public/js/net/demo-backend.js` mirrors the API in the browser and is labelled SIMULATED. If
  you add routes, add them here too, or the Pages demo shows "Not available".

## Rules that must not regress
- Movement collision and no interaction through walls.
- DEMO vs LIVE labelling.
- CEO approval for plans, decisions and merges.
- Tool allowlists and path policy.
- Append-only audit.
- Loopback binding.
- No secrets in git.
- No fake work animation: poses follow real status (presence.js).
- Office labels in the static demo say "simulated".

## Next steps
See [ROADMAP.md](ROADMAP.md). The pending CEO decisions are listed in [STATUS.md](STATUS.md#pending-ceo-approvals).
