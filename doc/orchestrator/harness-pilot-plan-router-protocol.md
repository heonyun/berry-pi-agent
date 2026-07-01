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
2. Apply [plan-method-router.md](./plan-method-router.md) — record which methods ran (0–N)
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
2. **AGENTS.md** — add one conditional route row:
   - `harness_flow: plan` and non-trivial scope → `doc/orchestrator/plan-method-router.md`
3. **QWEN.md** — confirm Worker Ticket example references `worker-ticket-template.md`
4. Set `plan-method-router-v0` row in workflow-improvement-log to `promoted`

Until gate passes, keep `candidate_only` and load plan-method-router only when explicitly piloting or user requests.

## Desk pilot (documentation-only)

If live agent pilot is not run, a **desk pilot** may record:

- Hypothetical task description
- Filled worker-ticket-template (redacted)
- Rubric self-score with rationale

Desk pilots count toward learning but **do not** satisfy promotion gate — live or scripted agent runs required.

## Related

- [harness-pilot-runbook.md](./harness-pilot-runbook.md)
- [harness-eval-cases.md](./harness-eval-cases.md)
