# Harness eval cases (tracked summary)

Local JSON schemas live under `.orchestrator/harness-pilot/templates/` (workstation). This file is the tracked index.

## Cases

| id | harness_flow | task_class | complexity | purpose | pilot 2026-06-24 |
| --- | --- | --- | --- | --- | --- |
| `trivial-docs` → `docs-only-trivial` | plan | trivial | S | Docs-only change; no Reasonix | helped |
| `standard-scout` → `broad-scout-standard` | plan | standard | M | Unfamiliar area; Scout once then direct-read | helped |
| `pr-loop-triage` | review | pr-loop-only | M | Truncated hold; disposition table; no_code_change | helped |

Local JSON: `.orchestrator/harness-pilot/eval-cases/` (`docs-only-trivial`, `broad-scout-standard`, `pr-loop-triage`, …).

## Pilot batch 2026-06-24

- **3/3 helped** — see [harness-pilot-recorded-2026-06-24.md](./harness-pilot-recorded-2026-06-24.md)
- Aggregated `runs/pilot-summary.md`: **global-harness-candidate** (with 2026-06-21-eod-retro mixed included)
- Promotion to `AGENTS.md`: **not automatic** — workflow-improvement-log + second real PR round

## Manual rubric (common)

- Correct `harness_flow` and task class chosen
- Session checklist respected
- Breadcrumb fields present at flow transition
- Verification commands recorded with exit code

## Existing local case

| id | Notes |
| --- | --- |
| `orchestrator-worker-implementation` | See [harness-eval-orchestrator-worker.md](./harness-eval-orchestrator-worker.md) |

## Pilot verdict rule

After 3 pilot runs: `helped >= 2` → global candidate; `hurt >= 2` → reduce or discard; else keep local pilot.

See [harness-pilot-runbook.md](./harness-pilot-runbook.md).
