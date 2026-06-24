# Failure mode defenses

Execution checks extending `docs/WORKFLOW_PATTERNS.md`. Codex owns final judgment.

## Checks by failure mode

| Failure mode | Static floor (always) | Dynamic ceiling (when available) | Execution check |
| --- | --- | --- | --- |
| Agentic laziness | npm verification + evidence | PR loop local verify in artifacts | Record `command` + `exit_code` in worklog or `evidence.jsonl` |
| Self-preferential bias | external review + Codex file verify | post-implementation Diff Review | `complex` → Qwen Diff Review once before merge |
| Goal drift | `goal.md` per PR; `AGENTS.md` bootstrap | resume from `.orchestrator/runs/pr-<N>/` | Issue/PR Harness block has `harness_flow` + `next_action` |
| Reviewer quota or instability | Qwen Diff Review + manual triage | Reasonix/Cursor fallback | Disposition table per [pr-review-triage.md](./pr-review-triage.md) |

## evidence.jsonl recommended fields

```json
{"command":"npm run test --workspace=@berry-pi/context-canvas","exit_code":0,"head_sha":"abc1234","harness_flow":"review"}
```

## harness_flow guard

If label mismatches work (e.g. `implement` but only triage needed):

1. Set state `unknown`
2. Verify facts from Issue/PR/worklog
3. Update breadcrumb before continuing

## Related

- [harness-flow.md](./harness-flow.md)
- [workflow-improvement-log.md](./workflow-improvement-log.md)
