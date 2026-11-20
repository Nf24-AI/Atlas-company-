# COS-101 — Gameplay foundation hardening: report

## Defect list (before)
1. **No collisions.** Movement only clamped the map to x ±15, z ±11. The player walked through both office partitions, desks, chairs, the NPCs, cabinets, plants and the Operations benches.
2. **Mini-map travel and recentre could place the player anywhere**, with no check that the spot is free.
3. **Camera was fixed.** A hard-coded follow offset (+11, 16, +17) with no orbit or zoom.
4. **Camera smoothing depended on frame rate** (`min(1, delta*3)` per frame), so it felt different at 30 and 144 fps.
5. **Walk animation read the key state, not real motion**, so the avatar kept bobbing while pushing into a wall.
6. **Mini-map player dot intercepted clicks**: when it sat on the OPS room (e.g. after recentring), clicking OPS did nothing. Found during browser testing.
7. All movement math was inside the WebGL frame loop, so none of it could be tested.

## What changed
| File | Change |
|---|---|
| `public/game-core.js` (new) | Pure module: obstacle map, `moveWithCollisions` (axis-separated, slides along walls, sub-stepped so thin walls can't be tunnelled), `resolvePosition`, `inputVector`, orbit camera maths (`cameraOffset`, `applyDrag`, `applyZoom`, clamps), frame-rate-independent `damp`, camera-relative `worldDirection`. No DOM/WebGL, so it is imported directly by Node tests and loaded in the browser as `window.AtlasCore`. |
| `public/app.js` | Frame loop uses the core module for movement and camera. Mini-map travel and recentre go through `resolvePosition`. Optional orbit camera: **off by default**, toggled by the new "كاميرا حرة" button or `C`; drag to orbit, wheel to zoom. Turning it off or pressing recentre eases back to the original isometric view. Walk animation reflects real movement. |
| `public/fallback.js` | Canvas2D (no WebGL) renderer uses the same collision function. |
| `public/index.html` | Loads `game-core.js` as a module before `app.js`; adds the camera toggle. |
| `public/styles.css` | Toggle styling, grab cursor in orbit mode, icon-only top buttons on phones, `pointer-events:none` on the mini-map dot. |
| `tests/game-core.test.mjs` (new) | 18 tests (see below). |

### Design decisions
- **Default camera is unchanged.** `DEFAULT_CAMERA` reproduces the exact original offset (tested). In default mode WASD maps to the same world directions as before (tested), so existing players notice nothing except the walls.
- **Comfort limits for the orbit camera:** pitch 25°–65°, distance 12–38, slow drag rate (0.005 rad/px), each wheel event capped at 15 % zoom, all changes eased rather than applied instantly, no roll. After orbiting, W still walks "up the screen".
- **Colliders are axis-aligned boxes** with a square player footprint (half-size 0.4). Every piece of furniture in the scene is axis-aligned, so this is exact enough and very cheap. Doors: each office has two open gaps in its front partition (x ±6.1..8 and ±0.85..3.1); both stay walkable (tested).
- No dependencies, server changes, API changes or new assets.

## Tests run
`npm test` → **19 tests, 19 pass, 0 fail** (1 existing server workflow test + 18 new).

New coverage: open-floor movement unchanged; boundary clamp; front partition blocks; all four doorways walkable; partition between offices blocks from both sides; both desks block; sliding along walls; no tunnelling on a huge step; flood-fill proves Manager, Director and Operations are reachable from spawn; travel targets are walkable and `resolvePosition` pulls the player out of a desk; input normalisation; default camera = original offset; camera-relative movement; pitch/zoom clamps; wheel-spike cap; frame-rate independent smoothing and angle wrap; the HTML loads the core before `app.js` and the old clamp-only movement is gone.

Browser check (Playwright, Chromium, local server in DEMO mode, no API keys): core module loaded, WebGL active, player stopped by the lobby plant and then by the manager front partition, mini-map travel then `E` opened the Manager office, orbit toggled on by the button and off by `C`, recentre worked, OPS opened from the mini-map, mobile top bar does not overflow, no console errors. The same walk was repeated with WebGL disabled (Canvas2D fallback): blocked at the same point, office still opens.

Screenshots: `02-blocked-by-partition.jpg`, `03-orbit-camera.jpg`, `05-mobile.jpg`, `06-fallback.jpg` in this folder.

## Manual browser test steps
1. `npm start`, open http://127.0.0.1:3099.
2. Walk with WASD/arrows into each wall of both offices, into both desks, the NPCs and the lobby plants: the avatar must stop and slide, never pass through.
3. Walk through both doorways of each office (the gaps in the low front partition).
4. Use the mini-map M / D / OPS shortcuts, then press `E`: each panel opens. Close with Esc.
5. Press "كاميرا حرة" (or `C`): drag on the 3D view to orbit, use the wheel to zoom. Walk with W: the avatar walks up the screen. Press `C` again: the camera eases back to the default view.
6. Press "إعادة تمركز الكاميرا": player returns to the lobby, camera returns to default.
7. On a phone-width screen: the on-screen arrows move the avatar and collide the same way; top bar fits on one line.
8. Approve a Manager draft in Operations and confirm it persists after reload (existing flow, unchanged).

## Known limitations
- **`ATLAS-PLAYABLE-DEMO.html` is not updated.** It is a separate inline copy of the game; collisions there need a follow-up (ideally after COS-102 so both share one module).
- **The dark waist-height rail at z = -0.9 inside each office has no collider.** It floats across the office at 0.82 m; making it solid would cut each office in half and block access to the desks. It reads like a visual bug either way — decision needed: remove it, raise it, or make it a real wall with a gap.
- The low partitions, plants and NPCs use box colliders, so corners are square, not round.
- Interaction distance is still a straight-line radius (4.0), so it can trigger through a partition from very close outside it.
- Orbit zoom has no pinch gesture on touch screens; touch drag orbits, zoom is wheel only.
- The obstacle list in `game-core.js` mirrors the geometry in `emitScene()` by hand. Moving furniture means updating both; a comment at both sites says so. COS-102 could generate the scene and the colliders from one list.
- Browser checks ran in headless Chromium with software WebGL; not yet tried on Safari/Firefox or a real phone.

## Security impact
None. No server, API, persistence, credential or network changes. Paid APIs were not enabled and nothing was published or deployed.
