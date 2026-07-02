---
title: "Matrix UX I05 row height resize completion"
type: worklog
status: completed
project:
  - berry-pi-agent
area:
  - context-canvas
tags:
  - worklog
  - context-matrix
  - matrix-ux
  - issue-97
  - pr-113
keywords:
  - row-resize
  - rowHeights
  - MatrixGrid
  - DeepSeek
  - Cursor fallback
summary: "Completed I05 #97 row height resize via PR #113; CI, DeepSeek review, CodeRabbit, and local verification passed."
date: 2026-07-02
updated: 2026-07-02
author: codex-orchestrator
canonical_repo: heonyun/berry-pi-agent
---

# Matrix UX I05 row height resize completion

## TL;DR

- **Issue:** #97 Matrix: drag-resize row heights.
- **PR:** #113, squash-merged on 2026-07-02.
- **Merge commit:** `502d2900cf6fc11c710e011ae5a99c0f5d9b9a3d`.
- **Result:** row marker drag-resize persists through SPA reload and bundle sidecar/wire paths.

## What changed

| Area | Files |
| --- | --- |
| Domain / clamp | `src/shared/matrix-row-height.ts` |
| Reducer | `set_row_height` in `src/core/matrix-reducer.ts` |
| SPA persist | `src/web/matrix-row-heights.ts` (`context-matrix-row-heights`) |
| Grid UI | `MatrixGrid.tsx` row-marker resize overlay handles |
| Canvas | `MatrixCanvas.tsx` init/load/save + bundle export |
| Bundle / wire | `sidecar.ts`, `load.ts`, `types.ts`, `export-matrix-bundle.ts`, `server/matrix-bundle.ts` |
| E2E | `e2e/matrix-grid-helpers.ts`, `e2e/matrix-grid.spec.ts` |

## Important Invariants

- **INVARIANT:** Persist row height only on pointer-up resize end, mirroring #96 column resize-end behavior.
- **CONTRACT:** Browser wire serializes numeric `Map`s as JSON objects; server rehydrates `rowHeights` with `numericMapFromWire`.
- **WHY:** Glide exposes declarative `rowHeight` but no `onRowResizeEnd`; row marker handles are an app-owned overlay.

## Review / Agent Loop

| Step | Result |
| --- | --- |
| DeepSeek planning sidecar | PASS; confirmed no Glide row-resize callback |
| DeepSeek testing sidecar | PASS; recommended #96-style unit/storage/e2e coverage |
| Local e2e first attempts | Failed twice due overlay handle hit-testing (`Row 20 height`) |
| Cursor CLI fallback | Consulted after 2 repeated failures; advisory only |
| Codex final diagnosis | DOM `elementFromPoint` showed handles stacked when `top` was invalid; fixed and added visible-region row positioning |
| DeepSeek diff review sidecar | PASS, no blockers |
| GitHub Actions DeepSeek review | PASS |
| CodeRabbit | PASS |

## Verification

| Check | Result |
| --- | --- |
| `npm test -- --run src/shared/matrix-row-height.test.ts src/web/matrix-row-heights.test.ts src/core/matrix-reducer.test.ts src/storage/matrix/projection.test.ts src/server/matrix-bundle.test.ts src/web/export-matrix-bundle.test.ts` | pass |
| `npm run typecheck` | pass |
| `npm run e2e -- -g "Column width resize|Row height resize"` | pass |
| `npm run build` | pass |
| pre-commit `npm run check` | pass |
| PR #113 `build-check-test` | pass |
| PR #113 `dispatch` / `review` (DeepSeek) | pass |
| PR #113 CodeRabbit | pass |

## Next Actions

1. I06 #98 group corner-dot boundaries.
2. Keep using DeepSeek subagent smoke after reboot before relying on sidecar work.
3. Time-box Cursor CLI fallback; it helped orient after two e2e failures but did not converge quickly.

## Links

- PR: https://github.com/heonyun/berry-pi-agent/pull/113
- Issue: https://github.com/heonyun/berry-pi-agent/issues/97
- Related harness evaluation: `doc/working-log/2026-07-02-pr113-review-harness-evaluation.md`
