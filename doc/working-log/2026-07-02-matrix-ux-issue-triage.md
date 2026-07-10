---
title: "Matrix UX issue triage and I01 skeleton PR loop"
type: worklog
status: active
project:
  - berry-pi-agent
area:
  - context-canvas
tags:
  - worklog
  - context-matrix
  - matrix-ux
  - issue-triage
  - pr-loop
keywords:
  - issue-93
  - issue-94
  - PR-107
  - Korean IME
  - matrix-ime
  - Qwen worker
summary: "Matrix UX #93-#106; I01-I10 done through PR #116-#117; #102 closed satisfied-by-#117; next I11 #103."
updated: 2026-07-03
harness_flow: plan
next_action: "Implement I11 #103 cell = reference edit mode from origin/main"
drill_down: doc/working-log/2026-07-03-issue-102-satisfaction-check.md
author: cursor-orchestrator
canonical_repo: heonyun/berry-pi-agent
---

# Matrix UX issue triage and I01 skeleton PR loop

## TL;DR

- Registered **14 Matrix UX issues** (#93–#106).
- **I01–I10** complete through PR #115–#117; **#102** closed as satisfied by #117 (no code PR).
- **Next: I11 #103** — cell `=` reference edit mode.

## Issue progress (2026-07-03)

| ID | # | PR | Status |
|----|---|-----|--------|
| I01 | 93 | #107 | merged |
| I02 | 94 | #109 | merged |
| I03 | 95 | #110 | merged |
| I04 | 96 | #111 | merged |
| I05 | 97 | #113 | merged |
| I06 | 98 | #114 | merged |
| I07 | 99 | #115 | merged |
| I08 | 100 | #116 | merged |
| I09 | 101 | #117 | merged |
| I10 | 102 | — | **closed** (satisfied by #117) |
| I11–I14 | 103–106 | — | pending |
| I01b | 108 | — | open (IME phase 2) |

## Next Actions

1. **I11 #103** — `=` reference edit mode from `origin/main`.
2. Optional: localStorage offset migration (design review follow-up).
3. #108 overlay ImeTextarea when scheduled.

## Issue map (I01–I14 → GitHub)

| ID | # | Title |
|----|---|-------|
| I01 | 93 | Korean IME first char English |
| I02 | 94 | Ctrl+Enter shortcut investigation |
| I03 | 95 | Group label double-click rename |
| I04 | 96 | Column width resize |
| I05 | 97 | Row height resize |
| I06 | 98 | Group corner-dot boundaries |
| I07 | 99 | Corner-dot cell grid |
| I08 | 100 | Draggable group label offset |
| I09 | 101 | Stable group IDs |
| I10 | 102 | Context chips resolve by label |
| I11 | 103 | Cell `=` reference edit mode |
| I12 | 104 | Cell `=` AI same-cell output |
| I13 | 105 | History snapshot save |
| I14 | 106 | History snapshot restore |

Local index: `doc/working-log/.matrix-ux-issue-ids.json` (untracked).

## Work Completed

### GitHub issues

- `scripts/New-MatrixUxIssues.ps1` — batch creator (tracked in PR #107).
- Issue #93 DeepSeek planning review: **hold** — confirmed ImeTextarea not used in grid; orchestrator proceeded with `onKeyDown` cancel skeleton.

### I01 implementation (PR #107)

- `apps/context-canvas/src/shared/matrix-ime.ts` + tests
- `MatrixGrid.tsx`: `onKeyDown` → `event.cancel()` when IME composing
- `MatrixDetailPane.tsx`: `ImeTextarea` for markdown body
- Tag comments: `WHY:`, `CONTRACT:`, `RELATED:`, `ASSUMPTION:`, `TODO:` per COMMENT_CONVENTIONS

### Harness

- `scripts/QwenWorkerCommon.ps1`, `Invoke-QwenWorkerTicket.ps1` — written with `Resolve-NpxExecutable`; **blocked from git** by `.gitignore` / exclude policy.

## Verification

| Check | Result |
| --- | --- |
| `npm run test --workspace=@berry-pi/context-canvas` | 252 passed |
| `npm run typecheck --workspace=@berry-pi/context-canvas` | pass |
| PR #107 `build-check-test` | pass |
| PR #107 `review` (DeepSeek) | **pass**, no findings |
| Manual Windows Korean IME | **not run** (deferred) |

## PR loop round 1

- **URL:** https://github.com/heonyun/berry-pi-agent/pull/107
- **Branch:** `codex/issue-93-matrix-korean-ime` @ `2a0c45bf`
- **DeepSeek:** pass — suggests manual IME smoke, optional edge-case unit tests, future `provideEditor`
- **Action taken:** none (no P1/P2 blockers)
- **CodeRabbit:** pass (watch completed ~07:47 UTC)

## Decisions

- Skeleton defers Glide overlay `provideEditor` + `ImeTextarea` (`TODO: issue-93` in MatrixGrid).
- **#108** opened for #93 phase 2 (overlay ImeTextarea).
- Per-issue PR loop adopted: merge when CI + review pass.
- I02: orchestrator-direct (Qwen auth missing → **fixed** harness `--auth-type` + API key env mapping)

## Issue progress (2026-07-02 session 2)

| ID | # | PR | Status |
|----|---|-----|--------|
| I01 | 93 | #107 | **merged** (skeleton) |
| I01b | 108 | — | open (phase 2) |
| I02 | 94 | #109 | **merged** |
| I03 | 95 | #110 | **merged** |
| I04 | 96 | #111 | **merged** |
| I05 | 97 | #113 | **merged** |
| I06–I14 | 98–106 | — | pending |

## Next Actions

1. I06 #98 group corner-dot boundaries.
2. Manual Windows Korean IME smoke on grid `editOnType` (#93).
3. Follow-up PR for #108: Glide `provideEditor` + `ImeTextarea` overlay.
4. Promote Qwen worker scripts to tracked repo if harness promotion approved (`git add -f`).

## Related Files

- `apps/context-canvas/src/shared/matrix-ime.ts`
- `apps/context-canvas/src/web/MatrixGrid.tsx`
- `apps/context-canvas/src/web/MatrixDetailPane.tsx`
- `scripts/New-MatrixUxIssues.ps1`
