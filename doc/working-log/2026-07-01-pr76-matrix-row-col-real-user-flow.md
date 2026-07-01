---
title: "PR #76 matrix row/col selection and real-user-flow e2e"
type: worklog
status: completed
project:
  - berry-pi-agent
area:
  - context-canvas
tags:
  - pr-loop
  - matrix-grid
  - issue-71
  - e2e
keywords:
  - PR #76
  - row header
  - column header
  - real-user-flow
summary: "Merged PR #76 mapping Glide row/column selection to full-sheet ranges, clickable row markers, and composite AI-history-rerun Playwright spec; closes #71."
date: 2026-07-01
updated: 2026-07-01
author: cursor-agent
canonical_repo: heonyun/berry-pi-agent
---

## TL;DR

PR [#76](https://github.com/heonyun/berry-pi-agent/pull/76) squash-merged @ `0b6495bf`. Row/column header clicks now produce usable `matrix-status-selection` ranges. Added `real-user-flow.spec.ts`. Closes [#71](https://github.com/heonyun/berry-pi-agent/issues/71).

## Implementation

- `gridSelectionToMatrixSelection`: map Glide `selection.rows` / `selection.columns` `CompactSelection` to full 20×50 sheet bounds.
- `MatrixGrid.tsx`: `rowMarkers={{ kind: "clickable-number", width: 32 }}`, `rowSelect="single"`, `columnSelect="single"`.
- E2E: `clickRowMarker` / `clickColumnHeader` on canvas bounding box; row marker requires **clickable-number** (plain `number` is not interactive).
- `real-user-flow.spec.ts`: edit A1/B1 → context range → target E1 → `/api/matrix-run` → history detail → rerun prefill.

## Verification

| Check | Result |
| --- | --- |
| `matrix-grid-selection.test.ts` | 5/5 |
| Full e2e | 16/16 |
| PR CI `build-check-test` | success |
| DeepSeek PR Review | pass (P2/P3 suggestions only) |

## Decisions

- Fixed 32px row marker width for stable Playwright coordinates (Glide auto-width was wider than E2E constants).
- `real-user-flow` avoids `expectCellStored` between Tab and B1 edit (refocus would reset selection to A1).

## Related Files

- `apps/context-canvas/src/adapters/matrix-grid-selection.ts`
- `apps/context-canvas/src/web/MatrixGrid.tsx`
- `apps/context-canvas/e2e/real-user-flow.spec.ts`
- `apps/context-canvas/e2e/matrix-grid-helpers.ts`
