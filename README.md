# ATLAS — Company OS

An **Arabic-first 3D browser startup simulator**, built to let a human CEO interact with AI staff, assign projects, approve draft tasks and evaluate real outcomes. First company has **Manager** and **Technical Director**, with Developer and QA planned later.

> **Current state:** working local prototype + **offline-only public game demo**. This is not a production-ready multi-user service. The public demo uses simulated replies — it does not connect to AI providers.

## Try the game

**Option A — Public static demo:** Open the GitHub Pages URL once Pages is enabled (see [PUBLISHING.md](PUBLISHING.md)). Or download and open [`ATLAS-PLAYABLE-DEMO.html`](ATLAS-PLAYABLE-DEMO.html) in a modern desktop browser. It saves its test state using browser `localStorage`.

**Option B — Local app with API and persistent state:** Requires Node.js 20+ (no npm dependencies to install):

```bash
npm start
# http://127.0.0.1:3099
```

The backend binds **127.0.0.1** on purpose. Never expose this insecure API publicly. It writes state to the ignored `data/state.json` file.

## Real AI (local testing only)

Copy `.env.example` to `.env`, insert your own `GROQ_API_KEY` and/or `DEEPSEEK_API_KEY`, and restart the server. The browser never receives these credentials. Confirm the model IDs in each provider's current documentation.

- **Manager** — Groq, `openai/gpt-oss-120b` by default.
- **Director** — DeepSeek; model is configured with `DIRECTOR_MODEL` and should be checked for current availability.
- If keys are absent, each employee clearly runs in **DEMO** mode with deterministic fake responses.

API usage may incur charges. No background development, GitHub code edits or deployment tools exist in this prototype yet. Proposals remain **pending** until the human approves them.

## Controls

- Move: `W`, `A`, `S`, `D` (or arrow keys).
- Interact: `E` near a staff office, or use mini-map access.
- Talk: browser microphone (where supported), with text fallback.
- Visit **Operations Center** to inspect draft approvals and approved tasks.

## Quality

```bash
npm test
```

Current automated coverage: basic page availability, Manager draft task, CEO approval and persistence, Director escalation, duplicate-approval rejection. Collision/camera automated coverage is **not implemented yet**: see `COS-101` in [`docs/WORK_ORDERS.md`](docs/WORK_ORDERS.md).

## For Claude Code

Read [`CLAUDE.md`](CLAUDE.md), [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), and [`docs/WORK_ORDERS.md`](docs/WORK_ORDERS.md). Start with **COS-101** only. Create a branch and small Pull Request; don't rewrite as a chat app. Do not claim features or tests you haven't actually executed.

## Repository map

| Path | Contents |
|---|---|
| `ATLAS-PLAYABLE-DEMO.html` | Standalone static/offline game demo (simulated AI) |
| `public/` | 3D browser UI and interactions for local server |
| `server.js` | Local API, model connectors, drafts/approvals and JSON persistence |
| `tests/` | Node built-in test suite |
| `docs/` | Product, architecture, work orders, test protocol |
| `CLAUDE.md` | AI developer handoff and guardrails |
| `.github/workflows/` | CI tests and optional static Pages publication |
| `PUBLISHING.md` | Public repo / GitHub Pages / Claude setup |

## Security

This repo is public **source code**, not a secure public SaaS. It has no user authentication or authorization. Do not host `server.js` on a publicly reachable endpoint until auth, access control, persistence and security review are implemented. Never commit keys, transcripts, private customer data or `data/state.json`.

No license is granted at this stage; add an explicit license only when the owner chooses one.