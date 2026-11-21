# ATLAS Company OS — Project Hub

Single entry point for everything about the project. All project knowledge lives **in this repository**
(no external workspaces). Last updated: 2026-11-21.

> **Privacy warning.** The GitHub repository `Nf24-AI/Atlas-company-` is **PUBLIC**. Everything committed
> here (code, docs, plans, these notes) is visible to anyone. The Claude account used to build it may be
> shared; this repo is the only place project state is kept. See [Security rules](../SECURITY.md#privacy-limitations).

| Area | Document |
|---|---|
| Product vision | [PRODUCT_SPEC.md](PRODUCT_SPEC.md) |
| Architecture | [ADR-001](adr/ADR-001-production-architecture.md) · [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) |
| Current progress | [STATUS.md](STATUS.md) |
| Change history | [CHANGELOG.md](../CHANGELOG.md) |
| Employee specifications & agent instructions | [EMPLOYEES.md](EMPLOYEES.md) |
| Database schema | [DATABASE.md](DATABASE.md) |
| API documentation | [API.md](API.md) |
| Security rules | [SECURITY.md](../SECURITY.md) |
| Test results | [TEST-RESULTS.md](TEST-RESULTS.md) · [TEST_PROTOCOL.md](TEST_PROTOCOL.md) |
| Deployment instructions | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Cost estimates | [COSTS.md](COSTS.md) |
| Known issues & blockers | [BLOCKERS.md](BLOCKERS.md) |
| Pending approvals (CEO) | [STATUS.md#pending-ceo-approvals](STATUS.md#pending-ceo-approvals) |
| Handover | [HANDOVER.md](HANDOVER.md) |
| Work orders | [WORK_ORDERS.md](WORK_ORDERS.md) · reports in `docs/cos-1xx/` |

## One-minute orientation

- **What it is:** a browser 3D office where a human CEO walks between rooms and directs AI employees
  (Project Manager, Technical Director, Developer, QA). Work is real: the Developer and QA edit files,
  run tests and commit inside an isolated sandbox git repo; the CEO approves plans, decisions and merges.
- **Run it:** `npm ci && npm start` → <http://127.0.0.1:3099> (DEMO mode, no keys, $0).
- **Test it:** `npm run lint && npm test && npx playwright test`.
- **Modes:** DEMO (scripted text, real tool execution, $0) · LIVE (real models, costs, per-employee) ·
  STATIC DEMO (GitHub Pages build, everything simulated in the browser).
