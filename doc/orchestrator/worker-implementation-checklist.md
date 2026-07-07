# Worker implementation post-checklist (orchestrator)

Tracked mirror of `.orchestrator/templates/worker-implementation-checklist.md`.

Run after a Qwen implementation worker ticket completes. Orchestrator verifies; worker output is advisory.

## 1. Scope

- [ ] Diff touches only files listed in the worker ticket `scope` (or documented expansion in disposition)
- [ ] No unrelated refactors, dependency bumps, or comment mass-retrofit

## 2. Correctness

- [ ] Read changed hunks; confirm behavior matches ticket acceptance criteria
- [ ] Check helpers **called** by the change — open definition if not in worker diff
- [ ] Preserve existing invariants (`INVARIANT` / `RELATED` comments when editing)
- [ ] Do not add WHAT comments; use tags per [agent-code-comments.md](./agent-code-comments.md) only when needed

### 2a. Tagged comments (`apps/`, `scripts/`, `outputs/`)

- [ ] Worker read [agent-code-comments.md](./agent-code-comments.md) and paste [templates/worker-comment-tags.md](./templates/worker-comment-tags.md) into implementation tickets
- [ ] Non-obvious hunks have tagged comments (`INVARIANT`, `CONTRACT`, `RISK`, `RELATED`, etc.) — max ~2 tags per file; no mass retrofit
- [ ] Context-canvas examples: [apps/context-canvas/COMMENT_CONVENTIONS.md](../../apps/context-canvas/COMMENT_CONVENTIONS.md)

## 2b. Comment tag lint (orchestrator, before §3)

- [ ] `pwsh scripts/Test-AgentCommentTags.ps1 -IssueNumber <N>` — M+ hard_fail; XS/S warn only
- [ ] Disposition row: comment tags adopt / N/A (trivial hunk) + evidence

## 3. Tests (once)

- [ ] Run targeted test file once: `npm test --workspace @berry/context-canvas -- App.test.tsx` (or ticket-specified path)
- [ ] If worker already ran tests, orchestrator still runs once before disposition
- [ ] Add or adjust tests only when ticket required or a gap is found

## 4. Disposition

Record in worker ticket disposition file when a Qwen ticket ran; template shape in `QWEN.md`.

| Item | adopt / reject / defer | Evidence |
| --- | --- | --- |
| … | … | file:line or test name |

## 5. Handoff

- [ ] Update task record phase / `00-index.md` if applicable
- [ ] Commit message references task id (e.g. T-003)
- [ ] **Repo worklog** `doc/working-log/YYYY-MM-DD-<topic>.md` with frontmatter (required for non-trivial work)
- [ ] **Obsidian DailyNote** summary + link to repo worklog (`worklog-writer` skill)
- [ ] UI issues: visual AC check vs issue mockup noted in worklog
- [ ] Changes on a **feature branch** (not uncommitted `main`) unless user explicitly waived — align with `harness-flow.md` implement exit

## Budget note

If the worker hit tool budget but edits look correct, orchestrator completes verification and documents budget overrun — do not re-run the full worker ticket without cause.
