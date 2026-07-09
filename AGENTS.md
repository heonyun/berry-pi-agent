# Repository Bootstrap Router

Thin router only. **Do not** load the full orchestrator tree. Pick the current `harness_flow`, read its phase hint, then conditional routes as needed.

## Phase router (one doc, one section)

| `harness_flow` | Section in [doc/orchestrator/harness-flow.md](doc/orchestrator/harness-flow.md) |
| --- | --- |
| **`plan`** | `## plan` |
| **`implement`** | `## implement` |
| **`review`** | `## review` |

```powershell
pwsh scripts/Invoke-HarnessPhaseContext.ps1 -Phase plan
```

## Start Here

1. **Phase** — Set `harness_flow`, read that section in [harness-flow.md](doc/orchestrator/harness-flow.md) only (or `pwsh scripts/Invoke-HarnessPhaseContext.ps1 -Phase <phase>`).
2. **Issue-first** — When an Issue drives the session: `gh issue view <N>` → Harness block (`harness_flow`, `task_class`, `process_mode`) → one `drill_down` file. Session start: [phase-peer-review.md](doc/orchestrator/phase-peer-review.md) § Session start.
3. **New Issue (`plan`)** — Agent Task only (`.github/ISSUE_TEMPLATE/agent-task.yml` / Writer in [issue-agent-prompts.md](doc/orchestrator/issue-agent-prompts.md)); after create: `pwsh scripts/Test-IssueContractGate.ps1 -IssueNumber <N>`.
4. **Harness block on Issue/PR** — Confirm `process_mode` gates: `pwsh scripts/Test-ProcessModeGating.ps1 -IssueNumber <N>`. Runbook: [issue-process-modes.md](doc/orchestrator/issue-process-modes.md).
5. **`harness_flow: implement` entry** — Before coding: [issue-agent-prompts.md](doc/orchestrator/issue-agent-prompts.md) § Implement gates + [issue-review-reception](doc/orchestrator/templates/issue-review-reception.md) (M+).
6. **Task record** — If the user gives a task-record path: read `00-index.md` → current phase `exit.md` / `verdict.md` → linked evidence only. No automatic task discovery.
7. **No task record** — Classify with [docs/TASK_CLASSIFIER.md](docs/TASK_CLASSIFIER.md) (`task_class` + `process_mode`) before Reasonix, Qwen, Cursor, or PR loop.
8. **Obsidian paths** — Resolve via [.orchestrator/workstation.local.md](.orchestrator/workstation.local.md) when explicitly provided.

## Global boundaries (always)

- Repo: `C:/Dev/pi-agent`, fork `heonyun/berry-pi-agent` of `earendil-works/pi`.
- Shell: PowerShell 7+ (`pwsh`).
- **Codex owns** implementation, verification, GitHub mutations, merge, deploy, release.
- Reasonix, Qwen, Cursor = advisory unless user authorizes edit-mode experiment.
- External output = hint; verify files/tests before acting.
- Raw runs stay local: `.orchestrator/`, `reasonix-runs/`, `qwen-runs/`, `cursor-runs/`.
- Secrets, credentials, DB, deploy config, GitHub permissions = user approval only.
- **New workflow rules** → `workflow-improvement-log.md` candidate row first; do not expand `AGENTS.md` or add mandatory orchestrator docs without promotion.
- **Phase-exit peer review** — only `Invoke-HarnessPhasePeerReview.ps1` with `lint_pass=true` in `peer-runs/issue-<N>/metrics.md` counts for plan/implement exit; standalone agy/Task peer does not.

## Conditional routes (narrow)

| Condition | Read |
| --- | --- |
| Repo conventions, fork `gh`, local verify | [docs/REPOSITORY_CONVENTIONS.md](docs/REPOSITORY_CONVENTIONS.md) |
| Diff-review gate | [QWEN.md](QWEN.md) |
| Reasonix Scout / Verifier / triage | [REASONIX.md](REASONIX.md) |
| Cursor invoke or output review | [CURSOR.md](CURSOR.md) |
| Open PR / CI / merge | [docs/PR_REVIEW_DEPLOY_LOOP.md](docs/PR_REVIEW_DEPLOY_LOOP.md), [pr-review-triage.md](doc/orchestrator/pr-review-triage.md) |
| PR merge — inline comment disposition | `scripts/Get-PrReviewDisposition.ps1 -PrNumber <N> -Markdown` (every inline row → worklog before merge) |
| GitHub Issue/PR commands | [docs/GITHUB_AGENT_COMMANDS.md](docs/GITHUB_AGENT_COMMANDS.md) |
| Workflow patterns, improvement discipline | [docs/WORKFLOW_PATTERNS.md](docs/WORKFLOW_PATTERNS.md) |
| Code comment tags (implement, workers) | [agent-code-comments.md](doc/orchestrator/agent-code-comments.md), `scripts/Test-AgentCommentTags.ps1` |
| Context Canvas invariants / comments | [apps/context-canvas/COMMENT_CONVENTIONS.md](apps/context-canvas/COMMENT_CONVENTIONS.md) |
| Context Canvas app router | [apps/context-canvas/AGENTS.md](apps/context-canvas/AGENTS.md) |
| Codex subagent (DeepSeek sidecar, scope-check, triage) | [subagent-mini-ticket-template.md](doc/orchestrator/subagent-mini-ticket-template.md) |
| PR loop handoff | `.orchestrator/runs/pr-<PR>/read-next.md` |
| agy / Antigravity review (plan or issue) | [doc/orchestrator/agy-review.md](doc/orchestrator/agy-review.md), [antigravity-agy-review.mdc](.cursor/rules/antigravity-agy-review.mdc) |
| `harness_flow: plan` — optional agy issue review | `scripts/Invoke-AgyIssueReview.ps1` (DeepSeek issue gate unchanged) |
| plan/implement exit peer review (PEPR) | [phase-peer-review.md](doc/orchestrator/phase-peer-review.md), `scripts/Invoke-HarnessPhasePeerReview.ps1`, `scripts/Test-PeerReviewOutput.ps1` |
| Issue `process_mode` / escalation | [issue-process-modes.md](doc/orchestrator/issue-process-modes.md), `scripts/Test-ProcessModeGating.ps1` |
| Issue writer/reviewer/implementer prompts | [issue-agent-prompts.md](doc/orchestrator/issue-agent-prompts.md) |
| Issue body contract (after create / plan exit) | `scripts/Test-IssueContractGate.ps1` |
| 업무일지 / worklog | Obsidian `DailyNote/업무일지 기록 규칙.md`, `worklog-writer` skill; detail in **tracked** [doc/working-log/](doc/working-log/README.md) |

Do not preload later-phase docs. Example: `plan` session does not load PR loop until `harness_flow` advances to `review`.
