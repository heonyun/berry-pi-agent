# Harness pilot runbook

Local execution under `.orchestrator/harness-pilot/runs/` (gitignored). Tracked procedures only.

## Flow

1. Choose `harness_flow` and task class (`harness-flow.md`)
2. Write or select eval case (`harness-eval-cases.md`)
3. `run.json` + `gate_plan.json` + `agent_contract.json`
4. **Checkpoint** — `New-HarnessCheckpoint.ps1` (local) or manual table below
5. **Preflight** — `Test-HarnessPreflight.ps1`
6. Agent or direct-read work
7. **Postflight** — `Test-HarnessPostflight.ps1`
8. `read-next.md` + `summary.md` + `evidence.json`
9. Scorecard → circuit breaker → pilot summary

## Worker checkpoint (mandatory before Qwen implementation ticket)

If `scripts/harness/New-HarnessCheckpoint.ps1` is unavailable, record manually:

| Field | Value |
| --- | --- |
| branch | |
| HEAD | |
| changed files | |
| harness_flow | plan \| implement \| review |
| task_id | |

## Manual checkpoint fallback

```text
checkpoint_at: <ISO8601>
branch: <name>
head: <sha>
harness_flow: implement
task_class: standard
```

## Circuit breaker (MVP)

Open when: same test fail 3×, wrong-mode 2×, budget exceeded, evidence size exceeded. Preflight blocks next agent run until `next_action` recorded.

## Improvement loop

Failures → [workflow-improvement-log.md](./workflow-improvement-log.md) as `candidate_only` → eval case if reproducible → promote after evidence.

## Related scripts (local workstation)

`scripts/harness/New-HarnessCheckpoint.ps1`, `Test-HarnessPreflight.ps1`, `Test-HarnessPostflight.ps1`, `Save-HarnessAttempt.ps1`, `Write-HarnessScorecard.ps1`, `Write-HarnessPilotSummary.ps1`, `Test-HarnessCircuitBreaker.ps1`, `Invoke-HarnessPilotRun.ps1`, `Test-HarnessEvalCase.ps1`

`Invoke-HarnessPilotRun.ps1` accepts `-ForbiddenModes` (default: `implementation-worker` only). Use eval case `allowed_modes` when running scout/triage pilots.

Not committed to remote by default. See `doc/working-log/2026-06-20-local-only-harness-cleanup.md`.

## Latest recorded batch

2026-06-24: 3/3 helped — [harness-pilot-recorded-2026-06-24.md](./harness-pilot-recorded-2026-06-24.md)
