---
title: "User action BDD Playwright E2E plan"
type: plan
project: berry-pi-agent
area:
  - context-canvas
  - context-matrix
tags:
  - playwright
  - e2e
  - bdd
  - github-issues
  - cursor-cli
status: draft
date: 2026-07-01
author: codex
canonical_repo: heonyun/berry-pi-agent
source_note: "C:/Users/heony/OneDrive/문서/Obsidian/heon24/00 Inbox/사용자 액션 BDD Playwright E2E 테스트.md"
---

# User action BDD Playwright E2E plan

## Background

The source note frames Context Matrix as a spreadsheet-like AI workspace. The core product thesis is:

1. Users select cells or ranges.
2. Users run AI commands against selected context.
3. The AI result is written back into cells, rows, columns, or matrix-shaped output.

The goal of this pass is not just regression testing. It is product discovery through user-action testing: identify which common spreadsheet actions already feel right, which actions are missing, and which failures should become GitHub issues with Gherkin-style reproduction.

Strikethrough items in the source note are explicitly out of scope for this pass.

## Current Evidence

Subagent extraction found 28 active non-strikethrough user actions plus 3 cross-cutting AI product flows.

Current repository analysis found:

| Status | Examples |
| --- | --- |
| Already tested/working | cell click, direct typing, Enter/Tab movement, Shift+Arrow range, drag range, basic AI context/target readiness, Canvas toggle |
| Present in code but under-tested | history detail, history rerun, named ranges, recent ranges, detail pane edits, template headers, quick summarize |
| Unknown, needs actual probe | copy, paste, cut, Delete/Backspace, Ctrl+Arrow, Ctrl+Shift+Arrow, row/column header selection |
| Likely not implemented | undo/redo, fill handle, row/column resize, row/column insert/delete |

Recent local checks:

- `npm run e2e --workspace=@berry-pi/context-canvas -- e2e/matrix-grid.spec.ts` passed 7/7.
- A DeepSeek subagent successfully ran `e2e/smoke.spec.ts` and reported 2/2 pass.
- An ad-hoc real-user probe passed direct edit -> range context -> target -> `/api/matrix-run` -> history detail -> rerun prefill.

## Principles

1. Do not create GitHub issues for passing actions.
2. Do not create GitHub issues for test harness mistakes.
3. Create Gherkin-style GitHub issues only for confirmed user-facing gaps or missing expected actions.
4. Separate "bug/regression" from "feature gap"; many spreadsheet actions may be feature gaps, not bugs.
5. Keep Playwright tests as ordinary Playwright code. Use Gherkin in reports and issue bodies, not as a runner.
6. Preserve the source note's priority: P1 first, then P2, then P3.

## Proposed Work Plan

### Phase 0 - Advisory review

Ask Cursor CLI to critique this plan before running the broad test pass.

Cursor review focus:

- Is the action grouping correct?
- Should likely-not-implemented actions be tested first or converted directly into feature issues?
- What should be treated as a product bug vs a feature gap?
- Which actions are too spreadsheet-native for current Context Matrix scope?
- How should live AI-run tests be isolated from deterministic grid-action tests?

Cursor CLI review completed on 2026-07-01. Adopted decisions:

- Re-base priority on Context Matrix product scope, not only generic spreadsheet frequency.
- Do not run broad parallel Playwright probes in subagents; use one orchestrated sequential probe pass.
- Add a code-first capability map gate before running browser probes.
- Probe shipped product-loop gaps before post-MVP spreadsheet parity gaps.
- Treat likely-not-implemented spreadsheet parity as enhancement/deferred backlog, not bugs.

### Phase 1 - Baseline green check

Run current stable E2E:

```powershell
npm run e2e --workspace=@berry-pi/context-canvas -- e2e/matrix-grid.spec.ts
npm run e2e --workspace=@berry-pi/context-canvas -- e2e/smoke.spec.ts
```

Expected: both pass. If they fail, stop and classify regression before probing new actions.

### Phase 1.5 - Capability map gate

Before each browser probe, classify the action:

| Signal | Meaning | Action |
| --- | --- | --- |
| `code` | direct app/domain support exists | browser probe if user-facing wiring is uncertain |
| `glide-default` | Glide may support it internally | browser probe must assert domain state, not just visual behavior |
| `matrix-domain` | reducer/domain support exists but UI wiring is unclear | browser probe likely useful |
| `not-in-scope` | not in current Context Matrix scope | no browser probe; optional deferred enhancement issue |
| `e2e-needed` | user-facing behavior cannot be settled statically | run Playwright probe |

### Phase 2 - Real-user composite flow

Run or create a temporary Playwright probe for:

```gherkin
Scenario: User edits cells, runs AI, and reruns from history
  Given I open Context Matrix with fresh local history
  When I edit A1 and B1 using direct grid typing
  And I select A1:B1 as context
  And I set E1 as target
  And I run AI
  Then the run succeeds
  And history contains the run
  When I open the history entry and click rerun
  Then the composer is pre-filled from history
```

If this passes, do not create an issue. Promote it later into `real-user-flow.spec.ts` as test coverage.

### Phase 2b - Product-loop probes

Probe shipped or under-tested Context Matrix product loops before broad spreadsheet parity.

| ID | Action | Expected disposition |
| --- | --- | --- |
| T1-history | Run history detail and rerun | Bug if shipped history flow fails. |
| T1-named-range | Save a named range and reuse it | Bug/enhancement depending on failure surface. |
| T1-recent-ranges | Recent range selection jumps to the expected range | Bug if nav is visible but nonfunctional. |
| T1-detail-pane | Detail pane body/frontmatter save and Summary/Provenance tabs | Bug if visible controls do not persist/display state. |
| T1-quick-summarize | Summarize selection pre-fills AI prompt/target/context | Bug if visible button fails. |
| T1-template | Research template semantic headers are visible | Bug if documented default template is absent. |

### Phase 3 - Grid basics probes

Probe only actions that are not already proven by current tests.

| ID | Action | Expected disposition |
| --- | --- | --- |
| P1-copy | Ctrl+C copy | Confirm whether clipboard content is available. |
| P1-paste | Ctrl+V paste | Likely gap; issue if user cannot paste into selected cell/range. |
| P1-cut | Ctrl+X cut | Likely gap; issue if source is not cleared and target cannot receive paste. |
| P1-delete | Delete/Backspace clear | Domain has `clear_cell`; issue if keyboard deletion is not wired. |
| P1-edit-existing | F2/double-click edit existing content | Probe, because current direct typing coverage is not the same as edit-in-place. |

Clipboard probes require explicit Playwright permissions:

```typescript
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
```

Without that setup, clipboard failures are harness failures, not product evidence.

### Phase 4 - Navigation and selection probes

Probe productivity actions:

| ID | Action | Expected disposition |
| --- | --- | --- |
| P2-ctrl-arrow | Ctrl+Arrow data-boundary movement | Unknown; issue if expected and missing. |
| P2-ctrl-shift-arrow | contiguous block selection | Unknown; issue if expected and missing. |
| P2-select-all | Ctrl+A | Unknown; issue if no full/current-region selection. |
| P2-row-col-select | row/column selection | Unknown; issue if row markers/headers do not select full row/column. |
| P2-alt-enter | newline inside cell | Unknown; issue if multiline cell editing is expected now. |

### Phase 5 - Deferred spreadsheet parity

Do not run Playwright probes for these unless a visible UI promises the behavior. Track as optional post-MVP backlog if needed.

| ID | Action | Expected disposition |
| --- | --- | --- |
| D1-undo-redo | Ctrl+Z/Ctrl+Y | Architectural enhancement; no E2E failure issue. |
| D2-fill-handle | drag fill handle | Post-MVP spreadsheet parity. |
| D3-resize | row/column resize | Post-MVP spreadsheet parity. |
| D4-insert-delete | row/column insert/delete | Out of current fixed-sheet scope. |
| D5-sort-filter-freeze | sort/filter/freeze | Scope mismatch for this pass; filter dropdown was explicitly struck through elsewhere. |

## Subagent Strategy

Use Codex subagents as bounded workers:

| Worker | Scope | Authority |
| --- | --- | --- |
| Action extractor | source note -> active backlog | read-only |
| Capability mapper | code/tests -> likely status | read-only |
| Gherkin drafter | issue bodies from confirmed failures | read-only |

Codex remains orchestrator:

- owns final classification;
- verifies claims before opening issues;
- runs Playwright probes sequentially;
- creates GitHub issues only after confirmed evidence;
- keeps raw subagent transcripts local;
- summarizes accepted findings in issue bodies.

If a subagent is allowed to run Playwright later, it must receive a fixed probe manifest and must not invent additional probes. Required output: command, trace/screenshot path if any, assertion result, and stop condition.

## GitHub Issue Buckets

Aim for 4-6 issues total, not one issue per keypress.

| Bucket | When to create |
| --- | --- |
| `Grid clipboard and keyboard clear` | copy/paste/cut/delete fail or are missing as one shared surface |
| `In-place edit activation` | F2/double-click edit existing content fails |
| `Spreadsheet navigation shortcuts` | Ctrl+Arrow, Ctrl+Shift+Arrow, Ctrl+A, row/column selection gaps are confirmed |
| `Product-loop regression` | history, named range, recent range, detail pane, quick summarize, or template headers fail |
| `Multiline cell editing` | Alt+Enter is expected now but missing |
| `Post-MVP spreadsheet parity` | optional deferred epic for undo/fill/resize/insert/delete/sort/filter/freeze |

## GitHub Issue Template

Use one issue per coherent user-facing gap, not one issue per keypress if several keypresses share the same missing feature.

~~~markdown
## Goal
Support <user action> in Context Matrix.

## User Story
As a Matrix user, I want to <action> so that <intent>.

## Gherkin
```gherkin
Scenario: <action>
  Given I am in Context Matrix
  And <initial state>
  When <user action>
  Then <expected result>
```

## Actual
- <observed behavior>

## Evidence
- Command: `<playwright command or probe>`
- Result: <pass/fail>
- Screenshot/trace: <path if available>

## Harness
| Field | Value |
| --- | --- |
| harness_flow | plan |
| task_class | standard |
| next_action | implement or defer after review |
| drill_down | <local worklog or proposal path> |

## Out of scope
- Strikethrough actions from the source note.
~~~

## Open Questions For Cursor CLI

1. Should P3 sort/filter/freeze be deferred because the source note only struck through filter dropdown but later kept sort/filter/freeze active?
2. Should paste/cut/delete be grouped into one "clipboard and clearing basics" issue, or split by user-visible action?
3. Should undo/redo be one architectural issue rather than E2E failure issue?
4. Should row/column insert/delete be in current Context Matrix scope, given the sheet is currently fixed 20x50?
5. Should live AI run be included in issue evidence, or should AI-related issues use mocked/network-controlled probes?

## Recommended Cursor Review Prompt

Review `doc/context-matrix/user-action-bdd-playwright-e2e-plan.md`.

Please critique the testing and issue-creation plan before Codex runs broad Playwright probes. Focus on:

- action prioritization;
- bug vs feature-gap classification;
- whether any active source-note actions should be deferred as out of product scope;
- how to split GitHub issues cleanly;
- risks of letting subagents run Playwright probes.
