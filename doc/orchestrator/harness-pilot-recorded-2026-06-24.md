# Harness pilot batch 2026-06-24 (tracked summary)

Tracked mirror of local `.orchestrator/harness-pilot/recorded-runs/2026-06-24-pilot-batch/summary.md`.

## Results

| run_id | eval_case | harness_flow | verdict |
| --- | --- | --- | --- |
| `2026-06-24-pilot-trivial-docs` | `docs-only-trivial` | plan | helped |
| `2026-06-24-pilot-standard-scout` | `broad-scout-standard` | plan | helped |
| `2026-06-24-pilot-pr-loop-triage` | `pr-loop-triage` | review | helped |

**Batch: 3/3 helped.** Aggregated `runs/pilot-summary.md` (includes 2026-06-21-eod-retro mixed): recommendation **global-harness-candidate**.

## Eval case added

- `pr-loop-triage.eval_case.json` — truncated hold + disposition table (`M`, pr-loop-only)

## Not promoted yet

`harness_flow` routes stay in `doc/orchestrator/` until a second real PR-loop round confirms. See [workflow-improvement-log.md](./workflow-improvement-log.md).
