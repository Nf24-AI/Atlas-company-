# ATLAS Company OS — Claude Code project instructions

## Mission
Repository: `https://github.com/Nf24-AI/atlas-company-os` (after the owner creates and publishes it). Work on a separate branch and provide a PR. A public repo does not grant you write access unless GitHub authentication is configured.

Build a REAL browser-based 3D AI startup simulator, not a chat app. The human is CEO. First company has two AI employees: Project Manager (Groq GPT-OSS 120B), Technical Director (DeepSeek V4 Pro). A Developer and QA are future work. One company, one test product initially; no holding-company features yet.

## First read
1. `README.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/TECH_ARCHITECTURE.md`
4. `docs/WORK_ORDERS.md`

## Existing verified baseline
- Start `node server.js`, open http://127.0.0.1:3099.
- Run `npm test` before and after EACH change.
- Current prototype is dependency-free Node HTTP + native WebGL + HTML/CSS/JS. Preserve this working baseline while evolving it. A standalone OFFLINE demo is `ATLAS-PLAYABLE-DEMO.html` and never calls real AI.
- `public/app.js`: 3D scene, keyboard movement, office interaction, UI/voice.
- `server.js`: model providers, draft decisions, CEO approvals, local JSON persistence.

## Non-negotiable engineering rules
- Do not claim an AI agent wrote code, used GitHub, tested a repo, or deployed unless an actual tool action and auditable artifact prove it.
- Do not silently replace the game with a chat page. Preserve world movement, character, E-to-interact, independent offices, RTL Arabic-first UI.
- Make changes in small, reviewable steps and preserve user-facing behavior; add/maintain tests for any changes.
- Existing server has NO AUTH. Bind to localhost ONLY. Do NOT publish it to the public internet or Vercel. Production needs authentication, RLS, server-side validation, CSRF/origin controls as appropriate, audit trails and rate limits.
- NEVER put provider credentials in frontend, .env.example, test fixtures, logs or git. All sensitive keys stay server-side.
- All agent output is untrusted. Validate structured data on server; proposals are drafts. CEO must approve material actions. Never auto-deploy, charge, buy, delete repositories, or create external accounts.
- No autonomous/background claims without scheduled or event-driven infrastructure.
- Do not add paid services, external assets with unclear licensing, or dependencies without explanation.
- Before changing model IDs or SDK APIs, confirm their current official provider docs.
- Separate actual behavior from mocks. Clearly label DEMO vs LIVE.

## Assignment to Claude
Implement ONE work order at a time, beginning with `COS-101` in `docs/WORK_ORDERS.md`. For each: write a short implementation plan, change code, run tests, explain evidence, list limitations, and request review. Do not begin the next work order without CEO acceptance.