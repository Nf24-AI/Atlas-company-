# Technical architecture and migration plan

## A. What exists RIGHT NOW — local prototype

```
Browser (HTML/CSS, native WebGL, WASD, voice)
   | fetch /api/*
Node HTTP server (server.js, localhost:3099)
   |-- agent adapter [Manager: Groq] -- requires optional API key
   |-- agent adapter [Director: DeepSeek] -- requires optional API key
   |-- draft proposals and CEO approval checks
   `-- local state: data/state.json (gitignored)
```

The separate `ATLAS-PLAYABLE-DEMO.html` is an offline simulation: it replaces API calls with localStorage and deterministic scripted answers. **It is NOT live AI.**

## B. Target architecture AFTER game foundation acceptance

```
Next.js (React 19 + TypeScript) UI
  React Three Fiber 9, Three.js, 3D scene and avatars
  Office HUD / Arabic voice and text fallback
      |
  Protected API routes / server-side agents and tools
      |-- Manager adapter (Groq)
      |-- Director adapter (DeepSeek)
      |-- Approval policy, output schema validation, rate limits
      |-- Eventually coding sandbox + GitHub PR tools
      `-- Supabase Auth + Postgres + RLS + audit
```

### Why staged migration?
The existing single-file game is useful for immediate usability testing, but does not yet implement authorization, robust data modelling or tool execution. Do not erase a functioning prototype before proving replacement functionality. Migrate in small vertical slices with reproducible tests and screenshots.

### Proposed future entities
`company`, `employees`, `projects`, `tasks`, `decisions`, `meetings`, `agent_runs`, `audit_events`, `approvals`, `artifacts`, `evaluations`. All company-owned rows need owner/company scope and RLS. Treat model name as employee configuration, not role identity.

### Permission boundaries
- **CEO**: approves budgets, deployments, purchases, external publishing and irreversible actions.
- **Manager**: may suggest tasks and update assigned statuses if authorized; may not approve CEO-only actions.
- **Director**: architecture opinion and review; no automatic admin escalation.
- **Future Developer**: isolated repo/branch/worktree, can propose PR only by default.
- **Future QA**: test/review sandbox and attach evidence, cannot silently release.

### Security release gates
- No public URL pointing to current `server.js`.
- Auth/AuthZ, origin/CSRF protections where relevant, strict server-side schema validation, RLS and row ownership, rate limits/cost controls, secrets management, auditable events, error redaction.
- Input and AI output are untrusted. Explicit CEO approval before external actions.

### Sources
- Next.js App Router: https://nextjs.org/docs/app
- R3F v9 / React 19: https://r3f.docs.pmnd.rs/getting-started/introduction
- Supabase Auth: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Claude Code CLAUDE.md: https://docs.anthropic.com/en/docs/claude-code/memory
