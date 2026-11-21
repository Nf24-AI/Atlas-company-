# Roadmap

## Done — MVP (COS-101 → COS-107, merged)
See [STATUS.md](STATUS.md).

## In review
- **COS-108 immersive office experience**: camera, HUD, presence, environment. See [cos-108/REPORT.md](cos-108/REPORT.md).

## Next (requires CEO decisions)
1. **LIVE trial**: add Groq + DeepSeek keys locally, run one project with a $1 monthly cap, review output quality
   and real costs in the CEO workspace. Tune prompts in `server/agents/employees.js`.
2. **Real sandbox PRs**: dedicated GitHub repo + fine-grained token (Contents + Pull requests on that repo only).
3. **Supabase adapter**: execute `supabase/migrations/0001_init.sql` on a local Supabase (Docker) and add an
   RLS test suite; implement a Postgres repository behind the same `repo` interface.
4. **Network isolation for sandbox tests**: run the test runner in a container with `--network=none`.
5. **Private authenticated staging**: only after approval; see [DEPLOYMENT.md](DEPLOYMENT.md#staging-requires-approval).

## Later
- Several projects at once and a dependency graph for tasks.
- Better speech: a local open-source STT/TTS model, so audio stays on the device.
- Character art: licensed or original rigged models (glTF) to replace the procedural humanoids.
- Office follow-ups from COS-108: fade furniture that sits between the camera and the avatar; employees walking
  to the meeting room while `in_meeting` (needs moving colliders); camera modes in the Canvas2D fallback.
- Holding-company / multi-company features (explicitly out of scope for the MVP).
