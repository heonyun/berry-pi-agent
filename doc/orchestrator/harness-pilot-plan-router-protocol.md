---
title: Harness pilot — plan method router protocol
type: runbook
status: candidate_only
project: berry-pi-agent
area: orchestrator
tags: [harness, pilot, plan, candidate_only]
date: 2026-06-26
summary: How to run plan-router eval pilots and when to promote to TASK_CLASSIFIER / AGENTS.md
---

# Plan method router — pilot protocol

> **Superseded for daily use** by `harness_flow` + [issue-process-modes.md](./issue-process-modes.md). This file is historical pilot material only; do not rely on any plan-method-router link from it.

Runs under `.orchestrator/harness-pilot/runs/` (local). Tracked procedure only.

## Goal

Validate **Spec Compressor + Method Router** before promoting from `candidate_only` to Session Checklist and `AGENTS.md` one-line route.

## Required eval cases

| id | harness_flow | task_class | plan_intent | complexity |
| --- | --- | --- | --- | --- |
| `implementation-spec-standard` | plan | standard | C | M |
| `feature-shaping-complex` | plan | standard or complex | B | L |

## Per-run checklist

1. Record Harness breadcrumbs: `harness_flow: plan`, `task_class`, `plan_intent`, `next_action`, `drill_down`
2. Record which pilot methods ran (0–N) against the current `harness_flow` and issue-process-modes notes
3. Run Premortem if `task_class` ≥ `standard`
4. Produce Spec Compressor output → `worker-ticket.md` per [worker-ticket-template.md](./worker-ticket-template.md)
5. Score against rubric below
6. Append row to [workflow-improvement-log.md](./workflow-improvement-log.md) if novel failure

## Rubric (helped / neutral / hurt)

| Signal | helped | hurt |
| --- | --- | --- |
| Worker ticket | ≤80 lines; AC testable; files listed | Bloated; duplicate discovery prose |
| Scope | Must/Out clear | Scope creep or missing no-gos |
| Premortem | 3 concrete failures | Generic worries only |
| Context | Implement session needed no re-read of OST/DD | Worker confused by discovery noise |
| Time | Faster than unstructured plan | Slower with no quality gain |

## Promotion gate (`helped ≥ 2` on these cases)

When **both** case types have scored `helped` at least once (2+ total helped across live runs):

1. **TASK_CLASSIFIER.md** — add Session Checklist items (before implementation):
   - `plan_intent` recorded when `harness_flow: plan` and task is non-trivial
   - Spec Compressor output at `drill_down` before Qwen implementation ticket
2. **AGENTS.md** — keep daily use on `harness_flow` + `issue-process-modes`; no live route from this historical pilot doc
3. **QWEN.md** — confirm Worker Ticket example references `worker-ticket-template.md`
4. Keep the row in workflow-improvement-log as historical context only

Until gate passes, keep `candidate_only` and use the historical pilot notes only when explicitly piloting or user requests.

## Desk pilot (documentation-only)

If live agent pilot is not run, a **desk pilot** may record:

- Hypothetical task description
- Filled worker-ticket-template (redacted)
- Rubric self-score with rationale

Desk pilots count toward learning but **do not** satisfy promotion gate — live or scripted agent runs required.

## Related

- [harness-pilot-runbook.md](./harness-pilot-runbook.md)
- [harness-eval-cases.md](./harness-eval-cases.md)
