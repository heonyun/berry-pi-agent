---
title: "2026-07-11 Matrix inline commit-then-run"
type: worklog
status: active
project:
  - berry-pi-agent
area:
  - context-canvas
tags:
  - matrix
  - inline-edit
  - playwright
  - pr-loop
keywords:
  - Ctrl+Enter
  - Ctrl+Shift+Enter
  - selectionRange
  - target origin
  - NaN layout guard
summary: "Matrix inline edit shortcuts now commit once, preserve the edited source range, and run exactly once with explicit-target protection."
date: 2026-07-11
updated: 2026-07-11
author: Codex
canonical_repo: "C:\\Dev\\pi-agent"
---

# 2026-07-11 Matrix inline commit-then-run

## TL;DR

The inline Matrix shortcut path now carries an explicit commit-and-run request from the editor to the canvas. The request captures the edited source range, final inline prompt, and direction before finishing Glide editing, then flushes exactly once after the matching cell commit.

## Work Completed

- Replaced the global `matrix-commit-run` event handoff with a typed `onInlineCommitRun` callback.
- Preserved the inline source range through commit callbacks so selection drift cannot change the AI source.
- Kept inline prompt text authoritative over the composer prompt and added duplicate-keydown and IME guards.
- Tracked target origin so explicit targets remain unchanged while targets inferred from grid or inline sources can be re-inferred safely.
- Added finite container/layout guards to clear overlay positions before non-finite CSS coordinates can be rendered.
- Added unit and Playwright coverage for below/right execution, repeated runs, stale prompts, explicit targets, IME behavior, and non-finite overlay bounds.

## Verification

- `npm run typecheck --workspace=@berry-pi/context-canvas`: passed.
- `npm run test --workspace=@berry-pi/context-canvas`: 52 files, 403 tests passed.
- `npm run e2e --workspace=@berry-pi/context-canvas -- e2e/matrix-grid.spec.ts --workers=1`: 44 tests passed.
- PEPR implement gate: `peer-runs/issue-140/metrics.md` reports `lint_pass=True` and `reception_missing=False`.
- Internal browser: C5 `Ctrl+Enter` targeted C6; C11 `Ctrl+Shift+Enter` targeted D11 and applied one result; browser error/warn log was empty.

## Current State

- Branch: `codex/issue-140-inline-commit-run`.
- Source changes are ready for commit and Draft PR review.
- Actual native Korean IME composition was not reproducible through the browser automation input surface; composition behavior is covered by unit tests.

## Decisions

- A target set through the Set target control is `explicit` and blocks inline target replacement.
- A target inferred from the current grid selection is `inferred-grid`; a later inline source may replace it.
- A target inferred from an inline source is `inferred-inline`; the next inline source may replace it.
- Browser console verification remains a manual evidence step; Playwright currently verifies functional target and prompt behavior.

## Next Actions

- Commit the source/test files plus this worklog.
- Push the branch and open a Draft PR linked to Issue #140.
- Run the PR review/CI loop and address actionable feedback before merge.

## Related Files

- `apps/context-canvas/src/web/MatrixGrid.tsx`
- `apps/context-canvas/src/web/MatrixCanvas.tsx`
- `apps/context-canvas/src/shared/matrix-shortcut.ts`
- `apps/context-canvas/e2e/matrix-grid.spec.ts`
- `peer-runs/issue-140/metrics.md`
