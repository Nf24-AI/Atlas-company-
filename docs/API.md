# HTTP API

Base: `http://127.0.0.1:3099`. JSON only.

**Rules for all routes**
- Every route except the public ones needs the `atlas_sid` session cookie (HttpOnly, SameSite=Strict).
- Mutations must be `POST`, with `Content-Type: application/json` (otherwise 415) and an `Origin` equal to
  `Host` (otherwise 403).
- Errors return `{error}`. 5xx messages are generic.

**Rate limits** (per IP, in-memory)

| Bucket | Limit | Applies to |
|---|---|---|
| auth | 10 / 15 min | `/api/auth/*` |
| agent | 30 / 10 min | model calls |
| mutate | 180 / min | other POSTs |
| read | 600 / min | GETs |

| Method · Path | Auth | Description |
|---|---|---|
| GET `/api/health` | public | `{ok, setupRequired}` |
| GET `/api/auth/status` | public | `{setupRequired, user|null}` |
| POST `/api/auth/setup` | public, once | `{email, password(≥10), displayName, companyName?}` creates the CEO + company + AI staff |
| POST `/api/auth/login` · `/logout` | public | session cookie |
| GET `/api/state` | ✔ | the full snapshot the UI renders: employees (with mode and permissions), projects, tasks, decisions, approvals, deliverables, meetings, runs, evaluations, usage, jobs, halted, integrations |
| POST `/api/meetings` | ✔ agent | `{role, text, channel: text|voice, projectId?}` → `{mode, output, proposedTaskId?, decisionId?}`. Errors: 423 halted, 402 budget, 502 provider |
| POST `/api/projects` | ✔ | `{name, objective}`. 409 if a project is already active |
| POST `/api/projects/:id/plan` | ✔ agent | queues the Manager planning job (then the Director's review of escalations) |
| POST `/api/projects/:id/decide-plan` | ✔ CEO | `{approve, reason?}`. Approval activates the project and its tasks |
| POST `/api/projects/:id/cancel` | ✔ CEO | |
| POST `/api/decisions/:id/review` | ✔ agent | queues a Director review |
| POST `/api/decisions/:id/decide` | ✔ CEO | `{approve, note?}` |
| GET `/api/tasks/:id` | ✔ | task + deliverables + runs with tool executions |
| POST `/api/tasks/:id/approve` | ✔ CEO | approve or reject a proposed task |
| POST `/api/tasks/:id/execute` | ✔ agent | queues Developer → QA → rework loop |
| GET `/api/tasks/:id/diff` | ✔ | `git diff main...branch` from the sandbox |
| POST `/api/approvals/:id/decide` | ✔ CEO | `{approve, reason?}`. Approving `pr.merge` merges; rejecting sends the task back to rework |
| POST `/api/evaluations` | ✔ CEO | `{employeeId, taskId?, scores{quality,compliance,tests,decisions,time,rework,reliability,cost: 1–5}, comment}`. Immutable once saved |
| GET `/api/runs/:id` | ✔ | run detail |
| POST `/api/agents/stop` · `/resume` | ✔ CEO | emergency stop: aborts running jobs, clears the queue and blocks new agent work |
| POST `/api/settings/budget` | ✔ CEO | `{monthlyBudgetUsd}` or `{employeeId, dailyBudgetUsd}` |
| GET `/api/audit` | ✔ | latest audit entries |

The static Pages demo implements the same routes in the browser (`public/js/net/demo-backend.js`) as a
simulation, with no network.
