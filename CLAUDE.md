# ATLAS Company OS — Claude Code project instructions

## Mission
Repository: `https://github.com/Nf24-AI/Atlas-company-` (**public**). Work on separate branches and deliver
reviewable PRs. Never force-push, never merge without CEO approval, never change repo visibility.

Build a REAL browser-based 3D AI company, not a chat app. The human is the CEO. The AI employees are a Project
Manager (Groq GPT-OSS 120B), a Technical Director (DeepSeek V4 Pro), a Software Developer and a QA Engineer.
There is one company, with one active project at a time (MVP).

## First read
1. `docs/PROJECT-HUB.md` (links to everything)
2. `docs/STATUS.md` and `docs/BLOCKERS.md`
3. `docs/HANDOVER.md`

## Verified baseline
- `npm ci && npm start`, then open http://127.0.0.1:3099 (DEMO mode with no keys).
- Run `npm run lint && npm test && npx playwright test` before and after each change.
- The stack is native ES modules + Three.js (vendored from node_modules) on the client, and a Node HTTP server
  with `node:sqlite` on the server. See ADR-001.

## Non-negotiable engineering rules
- Never claim an agent wrote code, used GitHub, tested or deployed anything unless a recorded tool execution
  or artifact proves it.
- Preserve: world movement, collisions, E-to-interact with line of sight, independent offices, RTL Arabic-first UI.
- Keep the server on loopback. Public exposure needs approved, authenticated staging (`docs/DEPLOYMENT.md`).
- Keep credentials out of the frontend, `.env.example`, fixtures, logs and git.
- Agent output is untrusted: validate it on the server and escape it in the UI. CEO approval is required for
  plans, decisions, merges, deployments, spending, destructive actions, account creation and permission changes.
- Add no paid services, unlicensed assets or unexplained dependencies. Do not fall back to unpriced or more
  expensive models.
- Before changing model IDs or prices, confirm the official provider docs, then update `docs/COSTS.md`.
- Label DEMO, LIVE and SIMULATED (static) behaviour accurately.

## Process
Work in small, reviewable steps, one work order or roadmap item per branch. For each: plan, implement, test,
record evidence in `docs/TEST-RESULTS.md` and `docs/STATUS.md`, list limitations in `docs/BLOCKERS.md`, add a
`CHANGELOG.md` entry, open a PR and request review.
