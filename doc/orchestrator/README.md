# Orchestrator docs

**Anti-bloat:** one phase doc ([harness-flow.md](./harness-flow.md)). Everything else is on-demand.

## Phase indexes (draft — for review)

Optional navigation; **not** wired into AGENTS.md yet.

| Index | `harness_flow` |
| --- | --- |
| [plan.md](./plan.md) | plan |
| [implement.md](./implement.md) | implement |
| [review.md](./review.md) | review |
| [cross.md](./cross.md) | multi-phase / meta |

## On-demand runbooks

| Doc | When |
| --- | --- |
| [harness-flow.md](./harness-flow.md) | Every session — `## plan` / `## implement` / `## review` (also via `Invoke-HarnessPhaseContext.ps1`) |
| [workflow-improvement-log.md](./workflow-improvement-log.md) | Before proposing new process rules |
| [pr-review-triage.md](./pr-review-triage.md) | `review` phase, open PR |
| [subagent-mini-ticket-template.md](./subagent-mini-ticket-template.md) | Codex → DeepSeek subagent prompt |
| [phase-peer-review.md](./phase-peer-review.md) | `plan` / `implement` exit peer review (PEPR) |
| [issue-process-modes.md](./issue-process-modes.md) | XS–XL gates, escalation |
| [issue-agent-prompts.md](./issue-agent-prompts.md) | Writer / Reviewer / Implementer prompts |
| [harness-improvement-roadmap.md](./harness-improvement-roadmap.md) | Merged harness enforceability backlog (candidate) |
| [templates/issue-review-reception.md](./templates/issue-review-reception.md) | Pre-implement disposition table |
| [task-record-template/00-index.md](./task-record-template/00-index.md) | Obsidian task record |

Router: [AGENTS.md](../../AGENTS.md) · `scripts/Invoke-HarnessPhaseContext.ps1`

Worklogs: [doc/working-log/README.md](../working-log/README.md)
