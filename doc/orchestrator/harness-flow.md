# Harness flow (작업 플로우 단계)

Tracked mirror for orchestrator session routing. Local templates may also live under `.orchestrator/templates/`.

## Terminology — avoid IT confusion

| Do not use | Use `harness_flow` | Meaning |
| --- | --- | --- |
| preproduction | **`plan`** | Classify, scout, skeleton, open Issue |
| production | **`implement`** | Code, worker tickets, local verify (**not** prod deploy env) |
| postproduction | **`review`** | PR, triage, Diff Review, merge |

- **Field**: `harness_flow` = `plan` | `implement` | `review`
- **Deploy environment** (when relevant): `deploy_env: local | staging | production` — never mix with `harness_flow`

One-line definition for agents:

> `harness_flow` = what kind of work this session does (plan / implement / review). It is not the live server or deployment target.

## Session start read order

When an Issue or PR body contains a **Harness** block:

1. Read Harness block (`harness_flow`, `task_class`, breadcrumbs)
2. Classify or confirm task class (`docs/TASK_CLASSIFIER.md`)
3. Load only runbooks for the current `harness_flow`
4. Tick Session Checklist (before implementation / before merge)

## Flow stages

| harness_flow | Goal | Load | Drop from session attention |
| --- | --- | --- | --- |
| **`plan`** | Classify, Scout, skeleton, register Issue | `TASK_CLASSIFIER`, `REASONIX` (if needed) | PR loop, merge gate, review triage |
| **`implement`** | Implement, worker ticket, local verify | `QWEN.md` (worker), product `AGENTS.md`, `COMMENT_CONVENTIONS.md` | Full issue-planning bot text, Scout raw (when conclusions are in worklog) |
| **`review`** | PR, triage, Diff Review, merge | `PR_REVIEW_DEPLOY_LOOP`, `pr-review-triage` | Plan exploration logs, implement trial-and-error chat |

Normal progression: `plan` → `implement` → `review`.

## Context dropping (safe)

**Drop** = do not preload in the current session; breadcrumbs point to files when needed.

**Never drop** = Git/SHA/CI, worklog, Issue/PR body, `.orchestrator/` evidence, decisions at flow transitions.

### Safe to drop only when

| Condition | If missing |
| --- | --- |
| Breadcrumb 5 fields on Issue/PR/worklog/`read-next.md` | Do not drop |
| Current flow `exit` checklist satisfied | Do not advance flow |
| `drill_down` path valid | Do not drop |
| `task_class` unchanged or change recorded | Wrong agent budget |

### Flow transition record (1–3 lines)

- New `harness_flow`
- `next_action` one line
- Key decision or `drill_down` from the finished step

### When to re-read dropped context

- Triage `evidence:heuristic` on keyboard/guards → read the **file**, not chat replay
- `drill_down` or `signals.json.drill_if_needed` requires raw artifacts
- `harness_flow` label mismatches actual work → `unknown`, verify facts (`AGENTS.md` Start Here)

## Breadcrumb fields

Use on Issue, PR, worklog, and `read-next.md`:

```yaml
harness_flow: plan | implement | review
task_class: trivial | standard | complex | pr-loop-only
head_sha: <optional>
next_action: <one line>
drill_down: <path>
# deploy_env: local | staging | production  # only when deploy is the topic
```

## Exit checklists

### plan — exit before implement

- [ ] `task_class` chosen and recorded
- [ ] Scope and affected paths listed
- [ ] Issue opened or task record path set (if used)
- [ ] Scout run at most once; key files identified

### implement — exit before review

- [ ] Local verification recorded (`npm test` / build / typecheck per class)
- [ ] Non-obvious behavior has comment tags per `COMMENT_CONVENTIONS.md` (no WHAT comments)
- [ ] Worker disposition recorded if a worker ticket ran
- [ ] PR opened or branch ready

### review — exit before merge

- [ ] Session Checklist merge items (`TASK_CLASSIFIER.md`)
- [ ] Triage disposition table complete for new findings
- [ ] `complex` → post-implementation Diff Review once
- [ ] CI green; `evidence_all_done` when actionable items existed

## Related

- [read-next.template.md](./read-next.template.md)
- [task-record-template/00-index.md](./task-record-template/00-index.md)
- [pr-review-triage.md](./pr-review-triage.md)
- [apps/context-canvas/COMMENT_CONVENTIONS.md](../../apps/context-canvas/COMMENT_CONVENTIONS.md)
