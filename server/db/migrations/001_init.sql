-- ATLAS Company OS — initial schema (SQLite, local adapter).
-- Mirrors supabase/migrations/0001_init.sql (PostgreSQL + RLS) for the hosted phase.
-- Every company-owned row carries company_id; the repository scopes every query by it.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  motto TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE employee_roles (
  key TEXT PRIMARY KEY,                 -- ceo | manager | director | developer | qa
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  responsibilities TEXT NOT NULL        -- JSON array of strings
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES employee_roles(key),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('human','ai')),
  provider TEXT,                        -- groq | deepseek | null for human
  model TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','planning','in_meeting','executing','reviewing','blocked','awaiting_approval','completed')),
  status_detail TEXT NOT NULL DEFAULT '',
  status_run_id TEXT,
  daily_budget_usd REAL NOT NULL DEFAULT 0.5,
  max_steps INTEGER NOT NULL DEFAULT 12,
  updated_at TEXT NOT NULL,
  UNIQUE (company_id, role_key)
);

CREATE TABLE permissions (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  requires_ceo_approval INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE employee_permissions (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key),
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (employee_id, permission_key)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','planning','awaiting_approval','active','completed','cancelled')),
  plan TEXT,                            -- JSON (manager plan: scope, risks)
  sandbox_path TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '[]',   -- JSON array
  assignee_role TEXT NOT NULL DEFAULT 'developer',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','todo','in_progress','in_qa','rework','awaiting_ceo','done','rejected','blocked')),
  rework_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deliverables (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  run_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('plan','code','pull_request','qa_report','review')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  branch TEXT, commit_sha TEXT, pr_url TEXT, pr_number INTEGER,
  is_local_pr INTEGER NOT NULL DEFAULT 0,
  evidence TEXT NOT NULL DEFAULT '{}',  -- JSON: test output, diff stat, defects
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','rejected','merged')),
  created_at TEXT NOT NULL
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'technical' CHECK (kind IN ('technical','scope','schedule','other')),
  title TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  proposed_by TEXT NOT NULL,            -- employee id
  director_review TEXT,                 -- JSON (structured review)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','awaiting_ceo','approved','rejected')),
  ceo_note TEXT,
  decided_by TEXT, decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  project_id TEXT,
  run_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('demo','live')),
  ceo_input TEXT NOT NULL,
  input_channel TEXT NOT NULL DEFAULT 'text' CHECK (input_channel IN ('text','voice')),
  reply TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                 -- plan.approve | pr.merge | deploy | spend | permission.change | destructive
  target_type TEXT NOT NULL, target_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,           -- employee id or 'system'
  summary TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed')),
  decided_by TEXT, decided_at TEXT, reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  project_id TEXT, task_id TEXT,
  kind TEXT NOT NULL,                   -- meeting | plan | review | develop | qa
  mode TEXT NOT NULL CHECK (mode IN ('demo','live')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled','blocked')),
  input TEXT NOT NULL DEFAULT '',
  output TEXT,                          -- JSON validated output (no raw chain-of-thought)
  error TEXT,
  steps INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  started_at TEXT, finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE tool_executions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  tool TEXT NOT NULL,
  args TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('ok','error','denied','timeout')),
  result_summary TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  run_id TEXT,
  provider TEXT NOT NULL, model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL, tokens_out INTEGER NOT NULL, cached_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE evaluations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  task_id TEXT REFERENCES tasks(id),
  evaluator TEXT NOT NULL CHECK (evaluator IN ('ceo','system')),
  scores TEXT NOT NULL,                 -- JSON: quality, compliance, tests, decisions, time, rework, reliability, cost
  overall REAL NOT NULL,
  evidence TEXT NOT NULL DEFAULT '{}',
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
-- Evaluations are an append-only history: nobody (including employees) can edit or delete them.
CREATE TRIGGER evaluations_no_update BEFORE UPDATE ON evaluations BEGIN SELECT RAISE(ABORT, 'evaluations are immutable'); END;
CREATE TRIGGER evaluations_no_delete BEFORE DELETE ON evaluations BEGIN SELECT RAISE(ABORT, 'evaluations are immutable'); END;

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','employee','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT, target_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;

CREATE TABLE settings (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, key)
);

CREATE INDEX idx_tasks_project ON tasks(company_id, project_id);
CREATE INDEX idx_runs_company ON agent_runs(company_id, created_at);
CREATE INDEX idx_tools_run ON tool_executions(run_id);
CREATE INDEX idx_usage_company ON usage_records(company_id, created_at);
CREATE INDEX idx_audit_company ON audit_logs(company_id, created_at);

INSERT INTO employee_roles (key, title_en, title_ar, responsibilities) VALUES
 ('ceo','Chief Executive Officer','الرئيس التنفيذي','["Final authority on material decisions","Approves plans, merges, spending and deployments","Evaluates employees"]'),
 ('manager','Project Manager','مدير المشاريع التقنية','["Analyse CEO requests","Define scope and acceptance criteria","Create and assign tasks","Escalate technical decisions","Monitor execution and report blockers","Challenge unreasonable requirements"]'),
 ('director','Technical Director','المدير التقني','["Review architecture and technical decisions","Evaluate security and scalability","Reject inadequate solutions with evidence","Resolve escalations"]'),
 ('developer','Software Developer','مطوّر البرمجيات','["Inspect sandbox source code","Plan and implement assigned tasks","Run tests","Commit on a feature branch and open a pull request"]'),
 ('qa','QA Engineer','مهندس ضمان الجودة','["Review requirements","Write and execute test cases","Classify defects by severity","Reject incomplete work","Produce test reports"]');

INSERT INTO permissions (key, description, requires_ceo_approval) VALUES
 ('meeting.reply','Reply to the CEO in meetings',0),
 ('project.plan','Draft project plans and proposed tasks',0),
 ('decision.escalate','Escalate a technical decision to the Director',0),
 ('decision.review','Issue a structured technical review',0),
 ('task.assign','Assign approved tasks',0),
 ('sandbox.read','Read files in the authorised sandbox repository',0),
 ('sandbox.write.src','Write source files (src/, test/, README.md) in the sandbox',0),
 ('sandbox.write.qa','Write QA test files (test/qa/) in the sandbox',0),
 ('tests.run','Run the sandbox test suite (time-limited, permission-restricted)',0),
 ('git.branch_commit','Create feature branches and commit in the sandbox',0),
 ('pr.open','Open a pull request on the sandbox repository',0),
 ('qa.report','Submit a QA report and verdict',0),
 ('pr.merge','Merge a pull request',1),
 ('deploy.production','Deploy to production',1),
 ('spend.money','Financial commitments',1),
 ('destructive','Destructive or irreversible operations',1),
 ('account.create','Create external accounts',1),
 ('permission.change','Change security permissions',1);
