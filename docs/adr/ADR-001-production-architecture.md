# ADR-001 — Production architecture for the ATLAS MVP

- **Status:** Proposed (COS-103) — CEO acceptance required
- **Date:** 2026-11-21
- **Deciders:** CEO (approver), engineering (author)

## Context

After COS-102 the client is ~1,000 lines of dependency-free ES modules on a native WebGL renderer, served by a dependency-free Node HTTP server with JSON-file persistence. The MVP now needs:

1. A noticeably better 3D office (lighting, shadows, animated third-person character, doors, many rooms, raycast picking) — COS-107.
2. A real backend: auth, authorization, persistent relational data, audit, rate limits — COS-104.
3. Server-side AI orchestration with tools that touch git and run tests — COS-105/106.
4. One user, one company, one project; lowest possible cost; local-first; a safe static public demo.

The original plan (docs/TECH_ARCHITECTURE.md §B) proposed **Next.js + React 19 + React Three Fiber 9 + Supabase**.

## Options

| | A. Keep native WebGL + Node | **B. Three.js (vanilla ESM) + Node, SQLite locally, Postgres/Supabase-ready schema** | C. Next.js 15/16 + R3F 9 + Supabase |
|---|---|---|---|
| **Performance** | Good for boxes; no shadows/PBR/instancing without writing them | Good: mature renderer, instancing, shadow maps, frustum culling; ~180 kB gzip | Same renderer as B plus React reconciliation overhead per frame (mitigated with refs) |
| **Maintainability** | Hand-written shaders/matrices; every visual feature is bespoke code | Standard, widely documented API; small codebase; no build step | Strong conventions but many moving parts (bundler, server components, RSC/client boundaries) |
| **Dev complexity** | Low now, high for COS-107 visuals | Low–medium | High: framework, build, hydration, R3F idioms; full rewrite of working UI |
| **Browser compat** | WebGL1 everywhere | WebGL2 (all evergreen browsers incl. Safari 15+); Canvas2D fallback kept | Same as B |
| **Mobile** | OK | OK; pixel-ratio cap + shadow toggle | Same as B, heavier JS bundle |
| **Hosting cost** | Local: $0. Pages: $0 | Local: $0. Pages: $0. Staging: any small Node host | Usually Vercel/Node host + Supabase; free tiers exist but add accounts/limits |
| **Security** | Small surface, but no auth | Small, auditable surface; auth/CSRF/rate-limit implemented explicitly (COS-104) | Framework helps, but more dependencies = larger supply-chain surface |
| **Scalability** | Single user | Single user now; storage behind a repository interface → Postgres/Supabase later without touching routes | Multi-user ready earlier |
| **AI integration** | Server-side fetch to providers | Same; long-running agent jobs live in the Node process with explicit limits | API routes/serverless have execution time limits that fight long agent runs and git/test tools |

## Decision

**Option B.**

- **Client:** keep the COS-102 modules; replace only `renderer-webgl.js` with a Three.js renderer (`three@0.187.0`, pinned, MIT) imported as a native ES module via an import map. No bundler, no React. Canvas2D fallback stays.
- **Server:** keep the dependency-free Node HTTP server; split it into modules (config, db, auth, routes, agents, tools).
- **Persistence:** `node:sqlite` (built into Node ≥ 22.13; no native addon to compile) with versioned SQL migrations, behind a repository module. A matching **PostgreSQL/Supabase schema with RLS** is kept in `supabase/migrations/` for the hosted phase, so moving to Supabase changes the adapter, not the domain.
- **Auth (local):** single CEO account, scrypt password hash, HttpOnly SameSite=Strict session cookie, Origin check on mutations, rate limits. Supabase Auth replaces it in hosted mode.
- **Next.js/R3F migration: rejected for the MVP.** It is not needed to meet any requirement, would rewrite working code, adds the largest dependency tree, and serverless time limits are a poor fit for agent jobs that run tests. Revisit if ATLAS becomes multi-user SaaS.

## Consequences

- (+) Visual upgrade is isolated to one renderer module; gameplay, collision, UI and tests are untouched.
- (+) Two runtime dependencies total (`three` in the browser; none on the server). Lockfile committed.
- (+) Runs fully offline/local at $0; static demo on Pages at $0.
- (−) `node:sqlite` is marked "release candidate" in Node 24 docs; we pin `engines.node >= 22.13`, isolate it behind `server/db`, and test it in CI. Fallback: swap adapter for `better-sqlite3` or Postgres.
- (−) No framework-provided auth/CSRF — implemented and tested explicitly.
- (−) Hosted multi-user mode requires the Supabase adapter (blocked on credentials; see docs/BLOCKERS.md).

## Verification of versions (2026-11-21)
- `three` latest on npm: **0.187.0** (published 2026-10-30) — `npm view three version`.
- `@playwright/test`: **1.65.1**.
- Node in this environment: v24.19.0; `node:sqlite` works without a flag (SQLite 3.53.3).
- Groq `openai/gpt-oss-120b`: listed on https://console.groq.com/docs/model/openai/gpt-oss-120b ($0.15 in / $0.60 out per 1M tokens).
- DeepSeek: current IDs `deepseek-v4-pro` and `deepseek-flash` per https://api-docs.deepseek.com/quick_start/pricing; `deepseek-chat`/`deepseek-reasoner` were scheduled for discontinuation on 2026-07-24.
