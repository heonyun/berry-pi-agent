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

1. Read Harness block (`harness_flow`, `task_class`, `process_mode`, breadcrumbs)
2. Classify or confirm task class (`docs/TASK_CLASSIFIER.md`)
3. Load only runbooks for the current `harness_flow`
4. Tick Session Checklist (before implementation / before merge)

## Flow stages

| harness_flow | Goal | Load | Drop from session attention |
| --- | --- | --- | --- |
| **`plan`** | Classify, Scout, skeleton, register Issue | `TASK_CLASSIFIER`, `REASONIX` (if needed) | PR loop, merge gate, review triage |
| **`implement`** | Implement, worker ticket, local verify | `QWEN.md` (worker), [agent-code-comments.md](./agent-code-comments.md), product `AGENTS.md` | Full issue-planning bot text, Scout raw (when conclusions are in worklog) |
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
process_mode: XS | S | M | L | XL
head_sha: <optional>
next_action: <one line>
drill_down: <path>
```

## plan

**Goal:** Classify, Scout, skeleton, register Issue. Load `TASK_CLASSIFIER`, `REASONIX` (if needed). Drop PR loop and merge gate from session attention.

### Exit before implement

- [ ] `task_class` and `process_mode` (XS/S/M/L/XL) recorded; mismatch noted if any
- [ ] Scope and affected paths listed; contract sections (Problem, AC, Non-goals) for M+
- [ ] Issue opened or task record path set (if used)
- [ ] Scout run at most once; key files identified
- [ ] Phase peer review per [issue-process-modes.md](./issue-process-modes.md) (`Invoke-HarnessPhasePeerReview.ps1 -Phase plan`); `Test-PeerReviewOutput` PASS or documented `-Force` bypass
- [ ] M+: Issue contract gate (`Test-IssueContractGate.ps1`)
- [ ] XS: self-critique 3 lines in worklog; S: test command planned
- [ ] L/XL: contract skeleton recorded or agy-skeleton link
- [ ] Peer disposition in worklog when peer ran
- [ ] No open BLOCKER; pending escalation disposed
- [ ] Issue Harness: `harness_flow` → `implement`, `next_action`, `drill_down`

## implement

**Goal:** Implement, worker ticket, local verify. Load `QWEN.md` (worker), product `AGENTS.md`, `COMMENT_CONVENTIONS.md`. Drop full issue-planning bot text and Scout raw when conclusions are in worklog.

### Entry before coding

- [ ] Issue review reception table complete ([templates/issue-review-reception.md](./templates/issue-review-reception.md))
- [ ] No unresolved BLOCKER (`adopt` or user `defer` on BLOCKER rows)
- [ ] Implement gates satisfied ([issue-agent-prompts.md](./issue-agent-prompts.md) § Implement gates)
- [ ] `process_mode` gates: S+ test plan; L+ contract skeleton on record

### Exit before review

- [ ] Local verification recorded (`npm test` / build / typecheck per class)
- [ ] Non-obvious behavior has comment tags per [agent-code-comments.md](./agent-code-comments.md) (no WHAT comments)
- [ ] M+: `Test-AgentCommentTags.ps1` PASS or documented `-Force` bypass; XS/S: review `comment_tags_warn` if any
- [ ] Worker disposition recorded if a worker ticket ran
- [ ] **Repo worklog** written: `doc/working-log/YYYY-MM-DD-<topic>.md` with YAML frontmatter (required for `task_class: standard` or `complex`)
- [ ] **Obsidian DailyNote** updated with TL;DR index + link to repo worklog (see `worklog-writer` skill)
- [ ] UI/visual issues: screenshot or manual check against issue mockup / acceptance criteria recorded in worklog
- [ ] Changes on a **feature branch** (not uncommitted `main`) unless user explicitly waived
- [ ] PR opened or branch ready
- [ ] Phase peer review per process_mode / failure ≥ 2 (`Invoke-HarnessPhasePeerReview.ps1 -Phase implement`); `Test-PeerReviewOutput` PASS or documented `-Force` bypass
- [ ] `verification_verdict`: pass | pass_with_gaps | fail in worklog/signals
- [ ] failure_count ≥ 3 → mode escalation applied or dismissed with evidence
- [ ] Issue updated with PR link / `Closes #N` when PR exists

## review

**Goal:** PR, triage, Diff Review, merge. Load `PR_REVIEW_DEPLOY_LOOP`, `pr-review-triage`. Drop plan exploration logs and implement trial-and-error chat.

### Exit before merge

- [ ] Session Checklist merge items (`TASK_CLASSIFIER.md`)
- [ ] **Review disposition table** in repo worklog: **one row per inline comment** + each non-empty review body (`adopt` | `dismiss` | `defer` | `stale` | `no_signal` + evidence)
- [ ] Scaffold generated: `scripts/Get-PrReviewDisposition.ps1 -PrNumber <N> -Markdown`
- [ ] Triage disposition table complete for new findings
- [ ] `complex` → post-implementation Diff Review once
- [ ] CI green; all `adopt` items on head SHA
- [ ] DeepSeek / bot triage: [pr-review-triage.md](./pr-review-triage.md) § DeepSeek PR review (automated)

## Related

- [issue-process-modes.md](./issue-process-modes.md)
- [issue-agent-prompts.md](./issue-agent-prompts.md)
- [phase-peer-review.md](./phase-peer-review.md)
- [read-next.template.md](./read-next.template.md)
- [task-record-template/00-index.md](./task-record-template/00-index.md)
- [pr-review-triage.md](./pr-review-triage.md)
- [agent-code-comments.md](./agent-code-comments.md)
