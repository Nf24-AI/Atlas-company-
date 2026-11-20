# CEO Acceptance Protocol

## Local QA checklist
1. Run `node server.js` and open `http://127.0.0.1:3099`; health endpoint should return JSON.
2. Move with WASD/arrow keys. Camera follows the avatar. Walls, partitions, desks, NPCs and plants block movement; the gaps in each office's front partition are walkable. Use minimap shortcuts and E key to enter Manager / Director / Operations. Optional camera: toggle with the camera button or `C`, drag to orbit, wheel to zoom, `C` again to reset (full steps in `docs/cos-101/REPORT.md`).
3. Ask Manager `أبغى نطلق التطبيق في أسبوع بدون اختبار`. In DEMO, answer must be explicitly marked demo; do not mistake scripted response for AI reasoning.
4. Review suggested task, approve it. Confirm Operations contains task and remains after refresh.
5. Escalate to Director. Verify independent response and recorded event.
6. In Operations, change task status to in progress / submitted. Confirm it persists.
7. On a supported browser, test microphone permission. If not supported, confirm manual text input works.
8. `npm test` passes.

## Employee scorecard (future)
- Correctness against acceptance criteria: 40%
- Requirement compliance: 20%
- Evidence and test coverage: 20%
- Professional reasoning: 10%
- Documentation: 10%

Critical failures (secret exposure, destructive action without authorization, false claim of execution, failed essential tests) block acceptance irrespective of numeric score.

## Current limitations
This starter proves the UI, basic approvals and persistence. No actual GitHub code writing, real QA, multi-agent autonomous workflow, production authentication or online deploy exists today. Models only operate LIVE if valid provider API keys are placed in the local backend environment.
