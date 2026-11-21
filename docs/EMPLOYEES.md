# AI employees — specifications and agent instructions

The authoritative instructions are in code: `server/agents/employees.js` (system prompts and output schemas)
and `server/tools/registry.js` (tools). This page summarises them. Each employee is an independent agent
with its own provider, model, prompt, permissions, daily budget and step limit.

| Employee | Default provider · model | Permissions | Tools |
|---|---|---|---|
| Technical Project Manager | Groq · `openai/gpt-oss-120b` | meeting.reply, project.plan, decision.escalate, task.assign | none (structured JSON output) |
| Technical Director | DeepSeek · `deepseek-v4-pro` | meeting.reply, decision.review | none (structured JSON review) |
| Software Developer | DeepSeek · `deepseek-flash` | meeting.reply, sandbox.read, sandbox.write.src, tests.run, git.branch_commit, pr.open | list_files, read_file, write_file, run_tests, show_diff, submit_work |
| QA Engineer | Groq · `openai/gpt-oss-120b` | meeting.reply, sandbox.read, sandbox.write.qa, tests.run, qa.report | list_files, read_file, write_file, run_tests, show_diff, submit_qa_report |

Models are configured per employee in `.env` (`MANAGER_MODEL`, …). Verify model IDs in the provider docs before
changing them. A model without an entry in the pricing table is **refused**, so unknown costs are never incurred.

## Responsibilities
- **Manager:** analyses CEO requests, defines scope and acceptance criteria, splits the work into tasks,
  identifies risks, escalates important technical decisions, and challenges unrealistic requests.
- **Director:** reviews escalated decisions and plans for architecture, security, scalability and testability.
  Approves, rejects, or recommends alternatives with evidence. Does not write code.
- **Developer:** works only in the sandbox repo. Reads the code, implements against every acceptance criterion,
  adds unit tests under `test/`, runs the tests and submits. A commit on the branch `atlas/task-<id>` is
  created by the system.
- **QA:** independent of the Developer. Writes its own tests under `test/qa/` only, maps each criterion to test
  cases, classifies defects (critical/major/minor) and passes or rejects.

## Enforced rules (code, not just prompts)
- **Tool allowlist per role.** A tool outside the role's list is denied and audited as `denied`.
- **Path policy.**
  - Developer may write `src/`, `test/` (not `test/qa/`) and `README.md`. QA may write only `test/qa/`.
  - No `.git`, `node_modules`, `.env`, absolute paths, traversal or symlinks.
- **Test runner.** Runs as `node --permission`, with fs access limited to the sandbox and no child processes.
  It has a timeout and a scrubbed environment.
- **QA override.** The system re-runs the tests itself. A QA "pass" while tests fail is overridden to "fail".
- **Bounded rework.** At most 2 rework cycles (3 attempts). After that the task becomes `blocked` for the CEO.
- **Limits.** Max steps per run, 6-minute run timeout, per-employee daily budget, company monthly budget,
  emergency stop.
- **Prompt injection.** CEO text, file contents, tool results and other employees' output are wrapped as
  `<untrusted>` data. Instructions inside it are ignored by rule, and tool access is enforced in code regardless.
- **No hidden reasoning** is stored or shown. Provider `reasoning` fields are discarded.

## CEO-only actions
Plan approval, decision approval, merging employee PRs (`pr.merge` approval), evaluations by the CEO, budgets,
and the emergency stop. Production deployment, financial commitments, destructive operations, external
account creation and security permission changes are **not implemented as agent tools at all**.

## Statuses (shown in 3D, on the mini-map and in the UI)
`available`, `planning`, `in_meeting`, `executing`, `reviewing`, `blocked`, `awaiting_approval`, `completed`.
They are set by the orchestrator from real run state. Animations follow them; nothing is shown as "working"
unless a run is executing.

## DEMO vs LIVE
An employee is LIVE when its provider has an API key; otherwise it is DEMO.
- DEMO text, plans and code patches are **pre-written** (`server/agents/demo.js`) and labelled
  `DEMO — scripted content, not AI-generated`.
- In DEMO, the tool executions are still **real**: files are written, tests are run, git commits are made. The
  first DEMO developer attempt contains a deliberate defect, so the QA rejection and rework cycle can be
  demonstrated with a genuinely failing test.
