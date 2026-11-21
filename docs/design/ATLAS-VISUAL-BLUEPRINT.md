# ATLAS — Visual & Interaction Blueprint (COS-109 + COS-110)

> **Status:** Reference/design only. Nothing here is proof that the illustrated gameplay has been implemented.
> **Public repo warning:** No real customer documents, personal emails, credentials, or live model transcripts belong in this repository.

## Product decision
ATLAS is a **third-person browser game**, not a floating chat application. CEO walks with WASD, steers camera with mouse, talks to employees within walking distance, assigns audited tasks and monitors real work through a Jira-inspired interface accessible on the in-game wall screen or CEO laptop.

## Original visual concepts created for this project
Five original AI-generated 16:9 concept renders have been prepared separately in the project hand-off pack `ATLAS-Visual-Blueprint.zip`. They are **target art**, not screenshots of implemented ATLAS. For developer review, the package's files are:
- `01-third-person-interaction.jpg` — CEO close-up speaking with employee; options Talk / Assign Task.
- `02-reception-visitors.jpg` — credible lobby, receptionist and visibly identified visitors.
- `03-in-world-workboard.jpg` — in-game task board + employee dialogue.
- `04-third-person-hq-walk.jpg` — follow-behind camera, navigable aisles and workplace atmosphere.
- `05-isometric-company-map.jpg` — high-quality overhead strategic mode, distinct departments.

**Important:** these full-resolution renders were generated in the user conversation and are supplied as a downloadable ZIP, not committed to GitHub by this text-only design commit. Do not confuse links to this document with uploaded raster assets. The accompanying `ATLAS-REFERENCE-SHEET.svg` is a repo-native editable diagram of the visual direction, NOT one of the 3D renders. Upload/source the renders into `docs/design/concepts/` with permission before calling them repo assets.

## Art direction: premium stylized corporate game
Palette: deep navy/teal (#142B31, #1E5557), warm cream (#EEE9DE), wood (#9B7050), muted amber (#D9A35F), mint highlight (#64D7BB). Avoid oversaturated neon and pure-white void floors. Visible wood grain, soft roughness variation, carpet and wall trims. Emphasize readable silhouettes and intentional lighting over excessive polygon count.

Camera requirements:
- Default: shoulder-height/behind avatar, visible body, eye-level believable scene scale, moderate FOV.
- Optional: strategic overview for map, department layout and project operations.
- Matched screenshots at fixed spawn and PM desk from both views.
- Use licensed or original assets; the images are inspiration, not license to copy branded work.

## Controller spec: third person with mouse (GTA-like feel, not an asset/game clone)
- `WASD`: move camera-relative; `W` always walks toward the camera's ground-projected forward vector.
- Mouse horizontal/vertical: smoothly orbit yaw/pitch when immersive control is active, with sensible sensitivity, pitch clamp and optional invert Y.
- User initiates pointer lock with an explicit click; `Esc` releases mouse; leaving browser focus stops movement.
- `Shift` sprint, `E` interact, `Tab` workboard, `M` map, `V` overview, `R` camera reset.
- Smooth acceleration/deceleration, character turn and walk/run animations. Camera collision/obstacle fading, no wall clipping.
- When opening task UI, workplace DM, voice consent or chat overlay: release pointer and suspend movement. Restore focus without involuntary interaction.
- Keyboard localization independent of Arabic/English input; remappable controls and touch fallback.
- First-person can be future optional, not the default.
- Do **not** use Three.js PointerLockControls alone as a third-person controller; it is documented mainly as a first-person control. Implement a third-person rig with mouse capture as an input primitive.

## Task management: ATLAS Work (Jira-inspired, custom implementation)
**In-world affordance:** click/press E on physical project wall monitor/CEO laptop. Show a serious full-size board only while doing work, not as a permanent floating wall of UI.

Work hierarchy: Initiative > Epic > Story / Task / Bug / Spike > Subtasks. Start MVP extension with Epic / Task / Bug and extend after tests.

Workflow:
`Backlog → Ready → In Progress → Code Review → QA → Awaiting CEO Approval → Done`
Exceptional states: `Blocked`, `Rejected`, `Cancelled`.

Each work item has: stable ID, parent link, project, role/assignee, title, priority, details, acceptance criteria, estimate, dependency, sprint, comments, attachments as safe references, version history/audit, linked GitHub branch/commit/PR/test evidence, tracked cost. Drag-drop transitions must obey backend role permissions, prerequisites and CEO-approval gates; keyboard accessible.

Views: Board, Backlog, Sprint, Issue, Timeline (later), Activity, Costs. Workflow statuses truthfully mirror agent/tool runs.

## Comms: connect to the employees
1. **Walk-up interaction:** E → Talk / Assign Task / Review Work / Schedule Meeting.
2. **Employee Inbox:** direct threaded conversations, searchable with read states, messages linked to work items, @mention and notifications.
3. **Room meetings:** voice push-to-talk with clear consent and text fallback; timestamps, transcription and decisions stored through current authorized APIs.
4. **Operational events:** Blocked, review requested, tests failed, deliverable ready → notification with deep link; do not imply agent operates in background unless actual queue/event infrastructure is running.
5. Never send external emails to real people without CEO approval.

## Lean first-company hiring plan
| Phase | Role | Deliverable | Approval/gate |
|---|---|---|---|
| Existing | Human CEO | Decisions, priorities, approval | Human |
| Existing | Technical Director | Architecture, risk review | Cannot approve CEO spend |
| Existing | Project Manager | Work plan, assignments, updates | No silent external actions |
| Existing | Developer | Actual code/PR in sandbox | CEO approves merges |
| Existing | QA Engineer | Tests, reject/rework report | Independent verification |
| Next P0 | Product Manager + Business Analyst (combined) | PRD, backlog, user stories, acceptance criteria | Reviewed by CEO |
| Next P0 | Product Designer / UX | Wireframes, design system, usable UI prototype | Design review before implementation |
| Next P1 | DevOps / Security | Sandboxed CI, auth, release readiness | Approval before deployment |
| Later P2 | Growth & Marketing | Market research, channel tests | After product validates |
| Later P2 | Support / Customer Success | Ticket handling and documentation | After real customers |
| Later P2 | Finance & Operations | Budget/cost/receipts | Never independent purchases |

Do not instantiate many paid bots for vacant departments; design the role registry first, spawn actual agents on assigned work.

### Visitor (guest) roles, if intended
- Receptionist, invited prospect, usability tester, visiting expert, business partner, job applicant. NPCs are visibly labeled **simulated** in DEMO mode and cannot impersonate real people. Actual human visitors require invitations, authenticated permissions and consent.

## Reference framework and sources
- Jira boards and workflows: https://www.atlassian.com/software/jira/guides/boards/overview
- Atlassian Scrum/Kanban planning: https://support.atlassian.com/jira-software-cloud/docs/create-and-plan-work-with-scrum-and-kanban/
- Three.js PointerLockControls (first-person oriented; build a distinct third-person rig): https://threejs.org/docs/pages/PointerLockControls.html
- YC guidance on cross-functional product/growth teams: https://www.ycombinator.com/blog/growth-office-hours-with-anu-hariharan-and-gustaf-alstromer

## Implementation and acceptance order
1. **COS-109 visual slice**: one beautiful PM office with character/props/lighting and actual in-browser before/after shots. CEO approval before other departments. [Issue #11](https://github.com/Nf24-AI/Atlas-company-/issues/11)
2. **COS-110A locomotion:** optional third-person mouse-controlled mode in a feature branch, validated movement & collision, separate overview.
3. **COS-110B employee workboard:** create/read/update work items in-game, backend authorization, correct audit and approval.
4. **COS-110C employee comms:** office conversations and inbox plus notifications, no fake tool execution.
5. **COS-110D roles and guests:** add Product/BA and Designer with real role/output contracts; receptionist and simulated guests.
6. Cross-browser tests, performance measurements and screenshots, GitHub PR per slice. No auto-merge and no public backend exposure.

This document is the implementation target, not a claim of completed features.