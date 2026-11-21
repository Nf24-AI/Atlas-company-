# COS-102 — Frontend modularization: report

## What changed
`public/app.js` (one 130-line minified file) and `public/fallback.js` were split into ES modules loaded natively by the browser (no bundler):

| Module | Responsibility |
|---|---|
| `public/js/world/world-data.js` | **Single source of truth** for geometry *and* colliders. Each helper (`wall`, `desk`, `plant`) emits render primitives and its collider in the same call. |
| `public/js/core/game-core.js` | Pure movement, collision, **line-of-sight**, camera and **pinch** maths. Colliders now come from world-data. |
| `public/js/core/math3d.js` | Matrix helpers. |
| `public/js/world/renderer-webgl.js` | WebGL renderer; static world uploaded **once** (prototype re-tessellated and re-uploaded every vertex every frame). |
| `public/js/world/renderer-canvas.js` | Canvas2D fallback drawing the same primitives (the old fallback was a hand-drawn second copy of the scene). |
| `public/js/world/characters.js` | Player/NPC primitives; walk bob follows real distance walked. |
| `public/js/game/player-controller.js`, `camera-controller.js`, `input.js` | Movement, orbit/zoom/pinch camera, keyboard + touch buttons. |
| `public/js/net/api-client.js`, `demo-backend.js` | API client; in-browser DEMO backend for the static build. |
| `public/js/shared/demo-scripts.js` | Scripted DEMO replies shared by server and static demo (was duplicated). |
| `public/js/voice/voice.js` | Web Speech API wrapper. |
| `public/js/ui/company-ui.js` | Office panel, Operations board, voice consent. |
| `public/js/main.js` | Bootstrap and frame loop. |

### Defects fixed
- **Interaction through walls**: `nearestInteractable` requires range *and* a clear line of sight (2D slab test against sight-blocking colliders).
- **Floating waist rail** at z = -0.9 (COS-101 open decision): removed — it had no collider and cut the offices visually.
- **Geometry/collider drift**: impossible now; a unit test asserts every collider is backed by visible geometry.
- **Duplicated demo**: `ATLAS-PLAYABLE-DEMO.html` (a stale inline copy without COS-101 collisions) is deleted. The Pages demo is now *built* from `public/` by `scripts/build-demo.mjs`, so it always ships current gameplay.
- **Pinch-to-zoom** on touch screens in orbit mode.
- **Voice privacy**: a consent notice before the first recording explains that Chrome/Edge send audio to the browser vendor's cloud recogniser.

## Tests
- `npm test`: 24 pass, 0 fail (19 baseline + LOS, slab test, pinch, collider/geometry consistency, tessellation).
- `npx playwright test`: 19 passed, 3 skipped (mobile-only test skipped on desktop projects) across **Chromium, Firefox, WebKit and Pixel 7 emulation**: boot without console errors, wall blocks/doorway passes, no interaction through partition, E opens office, DEMO draft → approval → persists after reload, orbit toggle, static demo build, mobile buttons + no horizontal overflow.

## Limitations
- The static demo can no longer be opened as a single downloaded HTML file (ES modules need HTTP). Use Pages or `npm run demo`.
- `three` is added as a pinned dependency for COS-107 (see ADR-001); not yet used by this PR.
