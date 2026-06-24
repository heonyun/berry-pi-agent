# Worker implementation post-checklist (orchestrator)

Tracked mirror of `.orchestrator/templates/worker-implementation-checklist.md`.

Run after a Qwen implementation worker ticket completes. Orchestrator verifies; worker output is advisory.

## 1. Scope

- [ ] Diff touches only files listed in the worker ticket `scope` (or documented expansion in disposition)
- [ ] No unrelated refactors, dependency bumps, or comment mass-retrofit

## 2. Correctness

- [ ] Read changed hunks; confirm behavior matches ticket acceptance criteria
- [ ] Check helpers **called** by the change — open definition if not in worker diff
- [ ] Preserve existing invariants (`INVARIANT` / `RELATED` comments when editing context-canvas)
- [ ] Do not add WHAT comments; use tags per `COMMENT_CONVENTIONS.md` only when needed

## 3. Tests (once)

- [ ] Run targeted test file once: `npm test --workspace @berry/context-canvas -- App.test.tsx` (or ticket-specified path)
- [ ] If worker already ran tests, orchestrator still runs once before disposition
- [ ] Add or adjust tests only when ticket required or a gap is found

## 4. Disposition

Record in worker ticket disposition file:

| Item | adopt / reject / defer | Evidence |
| --- | --- | --- |
| … | … | file:line or test name |

## 5. Handoff

- [ ] Update task record phase / `00-index.md` if applicable
- [ ] Commit message references task id (e.g. T-003)
- [ ] Repo worklog + Obsidian daily note when the round closes

## Budget note

If the worker hit tool budget but edits look correct, orchestrator completes verification and documents budget overrun — do not re-run the full worker ticket without cause.
