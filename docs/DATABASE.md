# Database schema

- **Local (current):** SQLite via `node:sqlite`. File: `data/atlas.sqlite` (git-ignored). WAL mode, foreign
  keys on. Migrations: `server/db/migrations/*.sql`, applied in order at startup and tracked in `schema_migrations`.
- **Cloud (prepared, untested):** Postgres/Supabase at `supabase/migrations/0001_init.sql`. It has the same
  entities, with Row Level Security via `owns_company(company_id)` and append-only triggers. See [BLOCKERS.md](BLOCKERS.md) (B3).

## Entities

| Table | Purpose | Notes |
|---|---|---|
| `users` | CEO accounts | scrypt password hash, unique email |
| `sessions` | login sessions | only `sha256(token)` is stored; expiry |
| `companies` | tenant root | `owner_user_id`; every other row carries `company_id` |
| `employee_roles` | role catalogue | manager, director, developer, qa, ceo |
| `employees` | human CEO + AI staff | provider, model, status (8 statuses, CHECK), daily budget, max steps |
| `permissions`, `employee_permissions` | capability grants | seeded per role |
| `projects` | one active per company (MVP) | plan JSON, sandbox path |
| `tasks` | work items | acceptance criteria JSON, assignee role, status, rework count |
| `deliverables` | plan / code / pull_request / qa_report / review | branch, commit SHA, PR URL or local flag, evidence JSON |
| `decisions` | escalated technical decisions | Director review JSON, CEO decision |
| `meetings` | CEO ↔ employee transcripts | channel text/voice (text only is stored, never audio) |
| `approvals` | CEO-gated actions | `plan.approve`, `pr.merge`, … |
| `agent_runs` | every model/tool run | mode demo/live, status, steps, tokens, cost, error |
| `tool_executions` | every tool call | status ok/denied/error/timeout, args/result summaries, duration |
| `usage_records` | token + cost ledger | provider, model, peak flag |
| `evaluations` | evidence-based scores | **immutable** (UPDATE/DELETE triggers abort) |
| `audit_logs` | who did what | **append-only** (UPDATE/DELETE triggers abort) |
| `settings` | per-company settings | monthly budget, agents_halted |

## Isolation
Every repository method takes `companyId` and filters by it. The routes derive `companyId` from the session,
never from the request body. Tests cover cross-company reads (`tests/agents.test.mjs`, data isolation).

## Backup and recovery
SQLite in WAL mode. Choose one:
1. **Online backup:** `sqlite3 data/atlas.sqlite ".backup 'backup/atlas-YYYYMMDD.sqlite'"`.
2. **Cold copy:** stop the server, then copy `data/atlas.sqlite` together with any `-wal`/`-shm` files.

The sandbox repos live in `data/sandbox/<projectId>/repo`. Back them up together with the database.
Restore by stopping the server and replacing `data/`. Backups contain transcripts, so keep them private and
out of git.
