# Blockers, known issues and limitations

## Blocked on the CEO (credentials / approval / cost)

| # | Item | Why blocked | Workaround in place |
|---|---|---|---|
| B1 | LIVE AI with Groq/DeepSeek | Needs API keys (paid usage) | DEMO mode, clearly labelled. LIVE path tested against a mock provider |
| B2 | Real GitHub PRs from the Developer | Needs a dedicated sandbox repo + fine-grained token | Local review requests (git branch in the sandbox), labelled "local" |
| B3 | Supabase project / RLS execution | Needs a Supabase project or the Docker daemon (not running here) | SQLite adapter; Postgres schema + RLS policies written but **untested** |
| B4 | GitHub Pages | Enabling Pages is a public-facing repo settings change | Workflow ready (`.github/workflows/pages.yml`); build verified locally |
| B5 | Staging deployment | Needs approval + hosting authorization | Not deployed. Instructions in DEPLOYMENT.md |

## Known limitations

- **COS-109 slice performance.** In headless software WebGL the PM office art slice roughly halves the frame rate
  (e.g. 15.2 → 6.7 fps at 1280×720, follow camera). A real-GPU number has not been measured. `?art=0` disables the
  slice. Planned fix after CEO approval of the look: baked lighting. Details: [cos-109/REPORT.md](cos-109/REPORT.md).
- **COS-109 visual gap.** The concept renders (now in docs/design/concepts/) show evening lighting, ceilings and
  detailed characters that the procedural slice does not match yet. See cos-109/REPORT.md.
- **Sandbox network is not restricted.** Node's permission model limits sandboxed test processes to the
  sandbox directory (fs) and blocks child processes, but not the network. Mitigation: secrets are scrubbed
  from the child environment. A container with `--network=none` is the proper fix (roadmap).
- **One active project at a time** (MVP limit enforced by the API).
- **Single CEO user per installation.** The schema supports more users and companies; the UI does not yet.
- **Rate limiter is in-memory.** It resets on restart, and each process keeps its own counts.
- **Voice** uses the browser Web Speech API. In Chrome/Edge, recognition audio goes to the browser vendor's
  cloud. The UI asks for consent first, and ATLAS stores text only. Firefox has no speech recognition, so the
  text fallback is used.
- **Procedural characters** are deliberately simple. No external rigged models were used, to avoid licensing
  risk.
- **No ESLint/TypeScript.** `npm run lint` checks syntax and scans for secrets. A full linter is deferred to keep
  dependencies minimal.
- **COS-108 visuals were checked in headless browsers only.** Screenshots, measurements and frame rates come from
  Playwright (software WebGL) and device emulation, not from a physical phone or a real GPU.
- **Canvas2D fallback has no camera modes.** It keeps its fixed isometric view; V/R are accepted but do not change
  that view. Signs, presence and interactions match the 3D renderer.
- **Tall props can sit between the camera and the avatar** in the close view (e.g. the QA server rack). There is no
  occlusion fading yet (roadmap).
- **GPU in headless browsers.** Automated tests run with software WebGL, which may log performance warnings.
  These are filtered from the console-error assertions.
