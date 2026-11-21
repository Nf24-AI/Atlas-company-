# Costs

**Default cost: $0.** With no API keys every employee runs in DEMO mode, and no paid service is used.
Three.js (MIT) and Playwright (Apache-2.0) are free. Nothing in this project activates a subscription, buys
credits or enables auto-billing.

## Prices used by the cost tracker (verified 2026-11-21)

USD per 1M tokens, from the provider pricing pages:
- [Groq model page](https://console.groq.com/docs/model/openai/gpt-oss-120b)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)

| Provider · model | Input | Cached input | Output |
|---|---|---|---|
| Groq · `openai/gpt-oss-120b` (Manager, QA) | 0.15 | 0.075 | 0.60 |
| DeepSeek · `deepseek-v4-pro` (Director), peak / off-peak | 1.32 / 0.66 | 0.044 / 0.022 | 3.96 / 1.98 |
| DeepSeek · `deepseek-flash` (Developer), peak / off-peak | 0.30 / 0.15 | 0.006 / 0.003 | 1.20 / 0.60 |

The table lives in `server/agents/providers.js`. Peak windows are those implemented in `isDeepSeekPeak`;
re-check them against DeepSeek's page before relying on them. A model **not in this table is refused**, so
the system never silently uses an unpriced or more expensive model. There is no fallback to other models.

## Estimates (LIVE, rough)

| Activity | Calls | Tokens (in/out) | Approx. cost |
|---|---|---|---|
| Meeting with the Manager | 1 | 3k / 0.6k | ≈ $0.0008 |
| Plan a project (Manager) | 1 | 4k / 1.5k | ≈ $0.0015 |
| Director review (peak) | 1 | 4k / 1k | ≈ $0.009 |
| Developer task (≤ 12 steps, Flash peak) | ~8 | 60k / 6k | ≈ $0.025 |
| QA (≤ 12 steps, Groq) | ~6 | 40k / 4k | ≈ $0.009 |
| **Full acceptance scenario** incl. one rework cycle | | | **≈ $0.06–0.10** |

These are estimates only. Real token counts are recorded per run and shown in the CEO workspace (Costs tab).

## Controls
- **Company monthly budget.** Default $5 (`ATLAS_MONTHLY_BUDGET_USD`), editable in the Costs tab.
- **Per-employee daily budget.** Editable in the Employees tab.
- **Pre-call estimate.** A call is refused (HTTP 402, employee marked `blocked`) if it would exceed a budget.
- **Bounds.** Max steps per run, run timeout, bounded retries, max 2 rework cycles.
- **Emergency stop.** Operations center or CEO workspace. It aborts running jobs and blocks new ones.
