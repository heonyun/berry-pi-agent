---
title: "Context Matrix user-action BDD probe and handoff"
type: worklog
status: merge-pending
project:
  - berry-pi-agent
area:
  - context-canvas
  - context-matrix
tags:
  - e2e
  - playwright
  - bdd
  - github-issues
  - context-matrix
keywords:
  - user-action probe
  - issue #72
  - issue #73
  - issue #71
  - Cursor CLI plan review
summary: "Completed Context Matrix user-action Playwright probe pass, adopted Cursor plan review, opened issues #72–#73–#71 from confirmed gaps, and handed off to Cursor orchestrator starting with #72."
date: 2026-07-01
updated: 2026-07-01 (PR #74 review loop)
author: cursor-agent
canonical_repo: heonyun/berry-pi-agent
---

## TL;DR

Codex ran a sequential user-action BDD Playwright probe pass for Context Matrix on 2026-07-01. Baseline E2E stayed green (matrix-grid 7/7, smoke 2/2). Confirmed product gaps were filed as GitHub issues #72 (layout click interception bug), #73 (F2 edit), and #71 (row/column header selection). Cursor orchestrator took over with a small-first plan: fix #72 before broader spreadsheet parity. Implementation PR, `real-user-flow.spec.ts`, and final harness eval worklog remain open.

**Yesterday boundary:** PR #70 merged 2026-06-30 @ `03ef2476` — separate from today's probe/issues work. See `doc/working-log/2026-06-30-pr70-matrix-grid-pr-loop.md`.


## #72 fix (2026-07-01)

- **Root cause:** Legacy `bottom-composer` and `v2-status-bar` classes applied absolute/fixed positioning so the composer/status strip overlapped the side panel and intercepted pointer events on Save and Recent Range controls.
- **Fix:** Drop those legacy classes from MatrixComposer / MatrixCanvas; add in-flow .matrix-status-bar flex layout in styles.css.
- **Tests:** Two Playwright scenarios in matrix-grid.spec.ts (normal user clicks on Save and recent range).
- **Verification:** matrix-grid.spec.ts 9/9, smoke.spec.ts 2/2, probe-followup-isolated.mjs — `detail-save-user-click` and `recent-range-user-click` **passed** (F2 / row-column header probes still fail; tracked as #73 / #71).

## PR #74 loop (2026-07-01)

- **Branch:** `cursor/fix-matrix-layout-click-interception` → [PR #74](https://github.com/heonyun/berry-pi-agent/pull/74)
- **Qwen diff-review:** PASS
- **Fork guardrail docs:** commit `62e7794b` (repository conventions / harness guardrails on fork)
- **Review triage:** Accepted Gemini suggestion — `min-width: 0` on `.matrix-status-bar .v2-status-selection` for flex truncation; rejected CodeRabbit proposal to delete global `.v2-status-bar` / `.bottom-composer` CSS (still used by legacy Context Canvas in `App.tsx` / `BottomComposer.tsx`)
- **Status:** merge pending after review-round commit and CI green

## Work Completed

### Plan review and probe strategy

- Drafted `doc/context-matrix/user-action-bdd-playwright-e2e-plan.md` from the Obsidian source note on user-action BDD Playwright E2E testing.
- Ran Cursor CLI plan review and adopted:
  - **Sequential** Playwright probes (no broad parallel subagent probes).
  - **Capability map gate** before each browser probe (`code`, `glide-default`, `matrix-domain`, `not-in-scope`, `e2e-needed`).
  - **Product-loop first** — probe shipped Context Matrix flows before post-MVP spreadsheet parity.
  - Treat likely-not-implemented spreadsheet parity (undo, fill handle, resize, insert/delete) as deferred backlog, not bugs.
- Drafted `doc/context-matrix/playwright-real-user-flow-e2e-proposal.md` to promote the passing composite AI→history→rerun flow into `real-user-flow.spec.ts` (not implemented yet).

### Baseline green check

```powershell
npm run e2e --workspace=@berry-pi/context-canvas -- e2e/matrix-grid.spec.ts
npm run e2e --workspace=@berry-pi/context-canvas -- e2e/smoke.spec.ts
```

| Check | Result |
| --- | --- |
| `matrix-grid.spec.ts` | 9/9 passed (includes #72 Save + recent-range user-click scenarios) |
| `smoke.spec.ts` | 2/2 passed |

### Sequential probe pass

Probe scripts and evidence live under `.orchestrator/runs/20260701-user-action-bdd-e2e/`:

| Artifact | Role |
| --- | --- |
| `probe-user-actions.mjs` | Main sequential probe manifest |
| `probe-results.json` | First-pass aggregate results |
| `probe-followup-isolated.mjs` | Isolated reprobes for ambiguous failures |
| `probe-followup-results.json` | Follow-up confirmation results |
| `failed-*.png` | Screenshots for confirmed gaps |
| `issue-*.md` | Local issue drafts before GitHub filing |

**Passed probes (confirmed working):**

| Probe ID | Evidence |
| --- | --- |
| `T1-template-portal` | `#portal` exists for Glide overlay |
| `T1-real-user-ai-history-rerun` | Live `/api/matrix-run` 200, history detail, rerun prefill |
| `T1-quick-summarize` (isolated) | Quick summarize targets selected A1:B1 |
| `edit-existing-doubleclick` | Double-click edit of existing cell value |
| `P1-delete-backspace-clear` | Delete clears selected cell body |
| `P1-copy-paste-cut` | Clipboard copy/paste/cut with granted permissions |
| `P2-navigation-shortcuts` | Ctrl+Arrow boundary move; Ctrl+A full sheet selection |

**Confirmed gaps — GitHub issues:**

| Issue | Type | Probe | Summary |
| --- | --- | --- | --- |
| [#72](https://github.com/heonyun/berry-pi-agent/issues/72) | bug | `detail-save-user-click`, `recent-range-user-click` | `matrix-composer-hint` / center status text intercepts pointer events on detail **Save** and Recent Range buttons |
| [#73](https://github.com/heonyun/berry-pi-agent/issues/73) | enhancement | `edit-existing-f2` | F2 does not open `.gdg-input`; double-click edit works |
| [#71](https://github.com/heonyun/berry-pi-agent/issues/71) | enhancement | `row-column-header-select` | Row/column header clicks do not produce usable `matrix-status-selection` |

**Probed but not filed (deferred / harness / non-blocking):**

| Probe ID | Result | Disposition |
| --- | --- | --- |
| `T1-quick-summarize` (first pass) | failed | Target chip showed `A1:C1` instead of expected range — passed in isolated reprobe; treated as probe ordering/state leak, not a product issue |
| `P2-alt-enter-multiline` | failed | Multiline cell editing not in current scope; deferred per plan Phase 5 |
| `T1-detail-pane-save-tabs` / `T1-named-recent-range` (first pass) | failed | Confirmed as layout interception via follow-up; rolled into #72 |

### GitHub issue filing

- Opened issues #72, #73, #71 with Gherkin bodies, harness blocks (`harness_flow: plan`, `task_class: standard`), and local evidence paths.
- DeepSeek issue-assistant commented **hold** on all three issues (advisory; Codex/Cursor orchestrator owns implementation decisions).

### Orchestrator handoff (Cursor session)

- User confirmed PR #70 was yesterday's work, separate from today's probe/issues.
- Cursor orchestrator adopted **start small with #72** (layout click interception bug) before F2 or row/column selection enhancements.
- Repo worklog author for this handoff: `cursor-agent`.

## Verification

Baseline (pre-probe):

```powershell
npm run e2e --workspace=@berry-pi/context-canvas -- e2e/matrix-grid.spec.ts   # 7 passed
npm run e2e --workspace=@berry-pi/context-canvas -- e2e/smoke.spec.ts        # 2 passed
```

Probe commands:

```powershell
node .orchestrator/runs/20260701-user-action-bdd-e2e/probe-user-actions.mjs
node .orchestrator/runs/20260701-user-action-bdd-e2e/probe-followup-isolated.mjs
```

Live AI run evidence from `probe-results.json`:

- `matrixRunResponses`: `200 http://127.0.0.1:5173/api/matrix-run`
- Status: `Run applied: 1 cells updated`

## Current State

| Item | Status |
| --- | --- |
| `main` @ PR #70 merge | `03ef2476` (2026-06-30) |
| Baseline E2E | green (9/9 matrix-grid + 2/2 smoke post-#72 fix) |
| User-action probe pass | complete; evidence local |
| GitHub issues #71–#73 | open; DeepSeek hold comments |
| Plan docs | untracked locally under `doc/context-matrix/` |
| `real-user-flow.spec.ts` | not created |
| PR #74 (#72 layout fix) | open; merge pending — Matrix uses in-flow `.matrix-status-bar`; legacy CSS retained for Context Canvas v2 |
| Final harness eval worklog | not written |

## Decisions

- **Sequential probes over parallel subagents** — adopted from Cursor CLI review to avoid harness races and stale dev-server state.
- **Capability map gate** — classify each action before browser probe; skip `not-in-scope` spreadsheet parity.
- **Bug vs enhancement split** — #72 is a regression-style layout bug; #73 and #71 are keyboard/spreadsheet parity enhancements.
- **Issue bucketing** — layout interception grouped into one bug (#72); F2 and row/column selection kept as separate issues.
- **Quick summarize first-pass failure** — not filed; isolated reprobe passed; likely probe state ordering, not product defect.
- **Alt+Enter multiline** — probed, failed, deferred (not in current product scope).
- **Small-first handoff** — fix #72 before broader parity work.

## Next Actions

1. **Immediate:** Fix #72 layout/pointer-event stacking; add focused E2E for detail Save and recent-range user clicks.
2. **After #72:** Decide implement vs defer for #73 (F2) and #71 (row/column selection).
3. **Coverage:** Promote passing composite flow into `apps/context-canvas/e2e/real-user-flow.spec.ts` per proposal doc.
4. **Docs:** Track or PR the untracked plan docs under `doc/context-matrix/`.
5. **Harness:** Write final harness eval worklog when implementation loop closes.

## Related Files

- `.orchestrator/runs/20260701-user-action-bdd-e2e/probe-results.json`
- `.orchestrator/runs/20260701-user-action-bdd-e2e/probe-followup-results.json`
- `.orchestrator/runs/20260701-user-action-bdd-e2e/probe-user-actions.mjs`
- `.orchestrator/runs/20260701-user-action-bdd-e2e/probe-followup-isolated.mjs`
- `doc/context-matrix/user-action-bdd-playwright-e2e-plan.md`
- `doc/context-matrix/playwright-real-user-flow-e2e-proposal.md`
- `doc/working-log/2026-06-30-pr70-matrix-grid-pr-loop.md` — yesterday's PR #70 merge (boundary)
- https://github.com/heonyun/berry-pi-agent/issues/72
- https://github.com/heonyun/berry-pi-agent/issues/73
- https://github.com/heonyun/berry-pi-agent/issues/71
