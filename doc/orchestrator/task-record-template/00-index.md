---
harness_flow: plan
task_class: standard
task_id: T-000
next_action: Fill goal and affected paths
drill_down: doc/orchestrator/harness-flow.md
---

# Task T-000 — title

Mirror for Obsidian `Projects/berry-pi-agent/tasks/<task>/00-index.md`. Copy this folder into the vault when using task records.

## Goal

One sentence outcome.

## Affected

- `apps/context-canvas/src/...`

## Harness

| Field | Value |
| --- | --- |
| harness_flow | plan \| implement \| review |
| task_class | trivial \| standard \| complex \| pr-loop-only |
| head_sha | optional |
| next_action | one line |
| drill_down | path to evidence |

## Flow phases

| harness_flow | Record file | Exit when |
| --- | --- | --- |
| plan | `phases/plan-exit.md` | Issue ready, scope clear |
| implement | `phases/implement-exit.md` | PR ready, verify green |
| review | `phases/review-exit.md` | Merged or round closed |

See [harness-flow.md](../harness-flow.md) for exit checklists.

## Links

- Issue: #
- PR: #
- Worklog: `doc/working-log/YYYY-MM-DD-topic.md`
