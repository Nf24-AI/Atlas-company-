# Company OS — Product brief (MVP)

## North star
A CEO enters a browser-based 3D startup office as a controllable avatar, approaches AI employees, speaks to them, issues work, receives independent professional assessments, approves actual proposals, and evaluates verified outcomes. The company must feel like a game AND operate like an auditable software studio.

## Scope: ONE startup, ONE test project
- **Owner:** CEO (human).
- **Employees today:** Technical Project Manager (routine delivery), Technical Director (architecture and escalations). Each may use a different model/provider.
- **Employees next:** Developer and QA with narrow, sandboxed GitHub permissions; not part of current playable baseline.
- **First exercise:** Ask manager to plan a small task-app test product. Director reviews major risks. CEO approves tasks. Later, Developer creates PR and QA attaches test evidence.
- No sales, marketing, holding company, subsidiaries, payments, marketplace, billing or automated third-party account resale yet. These are later phases.

## Player fantasy and UX
- CEO avatar navigates a polished 3D headquarters from the browser; **WASD**, camera follows; **E** interacts near a staff office. Touch fallback on mobile.
- Dedicated rooms: Manager Office, Director Office, Operations Center (tasks, decisions, approvals).
- Voice-first Arabic interaction, with keyboard fallback if browser speech recognition unavailable.
- Never substitute an ordinary chat-app UI for the office/game experience.
- A modern visually clear style is preferred; do not promise GTA-level AAA photorealism on a starter budget.

## Workflow (acceptance scenario)
1. CEO loads the local game and reaches Manager office using WASD.
2. CEO says/types `أبي نطلق المنتج في أسبوع بدون اختبارات`.
3. Manager challenges unsupported deadline and drafts a task with acceptance criteria.
4. The system labels real provider calls as LIVE, deterministic fallback as DEMO.
5. CEO explicitly approves task; task persists through page reload.
6. CEO escalates Manager response; Director replies independently and records review.
7. Operations Center shows proposals, approved tasks, events, and evidence.

## Non-functional principles
- Single user local demo first. No public deployment until auth and authorization ship.
- No silent spending or unsafe side effects. All model usage opt-in through credentials.
- Easy separation of the 3D visual client from the company runtime.
- Arabic RTL localization; English technical titles allowed.
- Evidence-driven employee evaluation rather than personality-based scoring.

## Out of scope for current prototype
- Persistent browser login, Supabase, 3D imported avatars, headless coding agents, multiplayer, always-on AI, cloud production, actual paid transactions, automatic release to production.
