-- ATLAS Company OS — hosted schema for Supabase (PostgreSQL) with Row Level Security.
-- Mirrors server/db/migrations/001_init.sql. NOT yet applied anywhere: requires a Supabase
-- project (see docs/BLOCKERS.md). Users come from Supabase Auth (auth.users).
-- Model: a company belongs to one owner (the CEO). Every company-owned table has company_id and
-- an RLS policy that allows access only to the owner of that company. AI employees never hold
-- database credentials; the server acts with the CEO's JWT, or with the service role only for
-- agent writes that it has already authorised in application code.

create extension if not exists pgcrypto;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  motto text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.owns_company(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = cid and c.owner_id = auth.uid());
$$;

create table public.employee_roles (key text primary key, title_en text not null, title_ar text not null, responsibilities jsonb not null);
create table public.permissions (key text primary key, description text not null, requires_ceo_approval boolean not null default false);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_key text not null references public.employee_roles(key),
  name text not null, kind text not null check (kind in ('human','ai')),
  provider text, model text,
  status text not null default 'available' check (status in ('available','planning','in_meeting','executing','reviewing','blocked','awaiting_approval','completed')),
  status_detail text not null default '', status_run_id uuid,
  daily_budget_usd numeric(10,4) not null default 0.5, max_steps int not null default 12,
  updated_at timestamptz not null default now(),
  unique (company_id, role_key)
);
create table public.employee_permissions (
  employee_id uuid not null references public.employees(id) on delete cascade,
  permission_key text not null references public.permissions(key),
  granted_by text not null, granted_at timestamptz not null default now(),
  primary key (employee_id, permission_key)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, objective text not null, description text not null default '',
  status text not null default 'draft' check (status in ('draft','planning','awaiting_approval','active','completed','cancelled')),
  plan jsonb, sandbox_path text, created_by uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, description text not null default '', acceptance_criteria jsonb not null default '[]',
  assignee_role text not null default 'developer', priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'proposed' check (status in ('proposed','todo','in_progress','in_qa','rework','awaiting_ceo','done','rejected','blocked')),
  rework_count int not null default 0, started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id), run_id uuid,
  kind text not null check (kind in ('plan','code','pull_request','qa_report','review')),
  title text not null, summary text not null default '', branch text, commit_sha text, pr_url text, pr_number int,
  is_local_pr boolean not null default false, evidence jsonb not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','accepted','rejected','merged')),
  created_at timestamptz not null default now()
);
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null default 'technical', title text not null, question text not null default '',
  proposed_by uuid not null, director_review jsonb,
  status text not null default 'pending' check (status in ('pending','in_review','awaiting_ceo','approved','rejected')),
  ceo_note text, decided_by uuid, decided_at timestamptz, created_at timestamptz not null default now()
);
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), project_id uuid, run_id uuid,
  mode text not null check (mode in ('demo','live')), ceo_input text not null,
  input_channel text not null default 'text' check (input_channel in ('text','voice')),
  reply text not null, summary text not null default '', created_at timestamptz not null default now()
);
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  action text not null, target_type text not null, target_id uuid not null, requested_by text not null,
  summary text not null default '', payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','failed')),
  decided_by uuid, decided_at timestamptz, reason text, created_at timestamptz not null default now()
);
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), project_id uuid, task_id uuid,
  kind text not null, mode text not null check (mode in ('demo','live')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled','blocked')),
  input text not null default '', output jsonb, error text, steps int not null default 0,
  tokens_in int not null default 0, tokens_out int not null default 0, cost_usd numeric(12,6) not null default 0,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now()
);
create table public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id), tool text not null, args jsonb not null default '{}',
  status text not null check (status in ('ok','error','denied','timeout')), result_summary text not null default '',
  duration_ms int not null default 0, created_at timestamptz not null default now()
);
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), run_id uuid,
  provider text not null, model text not null, tokens_in int not null, tokens_out int not null, cached_tokens int not null default 0,
  cost_usd numeric(12,6) not null, created_at timestamptz not null default now()
);
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id), task_id uuid references public.tasks(id),
  evaluator text not null check (evaluator in ('ceo','system')), scores jsonb not null, overall numeric(4,2) not null,
  evidence jsonb not null default '{}', comment text not null default '', created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  actor_type text not null check (actor_type in ('user','employee','system')), actor_id text,
  action text not null, target_type text, target_id text, detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.settings (
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null, value text not null, updated_at timestamptz not null default now(),
  primary key (company_id, key)
);

-- Append-only history
create or replace function public.forbid_change() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger evaluations_append_only before update or delete on public.evaluations for each row execute function public.forbid_change();
create trigger audit_append_only before update or delete on public.audit_logs for each row execute function public.forbid_change();

-- Row Level Security: owner-only access to every company-owned table.
alter table public.companies enable row level security;
create policy companies_owner on public.companies for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['employees','projects','tasks','deliverables','decisions','meetings','approvals','agent_runs','tool_executions','usage_records','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (public.owns_company(company_id)) with check (public.owns_company(company_id))', t || '_owner', t);
  end loop;
end $$;

-- Evaluations: CEO may read and insert (as evaluator=ceo) but never update/delete (trigger above).
alter table public.evaluations enable row level security;
create policy evaluations_read on public.evaluations for select using (public.owns_company(company_id));
create policy evaluations_insert on public.evaluations for insert with check (public.owns_company(company_id) and evaluator = 'ceo');

-- Audit: readable by the owner; inserts only by the server (service role bypasses RLS).
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select using (public.owns_company(company_id));

-- employee_permissions: readable by the owner; changes require the CEO (owner) — the app also
-- records a permission.change approval before writing.
alter table public.employee_permissions enable row level security;
create policy emp_perm_owner on public.employee_permissions for all
  using (exists (select 1 from public.employees e where e.id = employee_id and public.owns_company(e.company_id)))
  with check (exists (select 1 from public.employees e where e.id = employee_id and public.owns_company(e.company_id)));

alter table public.employee_roles enable row level security;
create policy roles_read on public.employee_roles for select using (true);
alter table public.permissions enable row level security;
create policy permissions_read on public.permissions for select using (true);

create index on public.tasks (company_id, project_id);
create index on public.agent_runs (company_id, created_at desc);
create index on public.usage_records (company_id, created_at);
create index on public.audit_logs (company_id, created_at desc);
