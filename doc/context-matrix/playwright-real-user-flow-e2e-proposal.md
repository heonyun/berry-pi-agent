---
title: "Context Matrix Playwright real-user-flow E2E proposal"
type: proposal
project: berry-pi-agent
area:
  - context-canvas
  - context-matrix
tags:
  - e2e
  - playwright
  - cursor-cli
  - matrix-grid
status: draft
date: 2026-07-01
author: codex
canonical_repo: heonyun/berry-pi-agent
---

# Context Matrix Playwright real-user-flow E2E proposal

## TL;DR

Promote the ad-hoc "real user" Matrix grid flow into a first-class Playwright spec, tentatively `apps/context-canvas/e2e/real-user-flow.spec.ts`.

This is **not a bug issue**. Existing Matrix grid E2E is green, and the 2026-07-01 manual Playwright probe passed the long flow. The proposal is to add coverage for the combined user journey that current isolated specs only cover in pieces.

## Current Evidence

| Check | Result | Notes |
| --- | --- | --- |
| `matrix-grid.spec.ts` | 7/7 pass | Covers click, direct typing, Enter, Tab, Shift+Arrow range, drag range, 2x2 workflow, AI range readiness. |
| Subagent smoke capability test | 2/2 pass | DeepSeek subagent successfully ran `e2e/smoke.spec.ts` and reported command evidence. |
| Ad-hoc real-user probe | pass | Verified direct grid edit, keyboard movement, range context, target set, `/api/matrix-run`, history detail, rerun prefill. |
| `/api/matrix-run` in probe | 200 | Status: `Run applied: 1 cells updated`. |
| Known fragile areas | monitored | Glide `#portal`, `.gdg-input`, controlled `gridSelection`, stale dev server. |

## Why Add This Spec

The existing tests are strong but mostly scenario-isolated. A single sequential real-user-flow spec would catch state leaks across operations:

1. Click cell and type immediately.
2. Commit with `Tab`.
3. Continue typing and commit with `Enter`.
4. Re-select a previous range.
5. Add that range as AI context.
6. Select a target cell/range.
7. Run AI through `/api/matrix-run`.
8. Open history detail.
9. Use history rerun to pre-fill composer state.

This flow specifically protects the boundary between Glide selection state, React parent state, composer state, AI run state, and history state.

## Proposed Spec Shape

File:

```text
apps/context-canvas/e2e/real-user-flow.spec.ts
```

Recommended test count:

| Test | Purpose |
| --- | --- |
| `Scenario: User edits cells, runs AI, and reruns from history` | One full happy-path flow. |
| Optional `Scenario: Real-user flow reports environment blockers clearly` | Only if stale-server or missing-key failures need first-class diagnostics. |

The first version should avoid broad abstraction. Reuse stable helpers from `matrix-grid-helpers.ts` where they match real user behavior, but keep the flow readable.

## Gherkin Draft

```gherkin
Feature: Context Matrix real user flow
  A user can use the Matrix grid like a lightweight spreadsheet,
  then use selected ranges as AI context and re-run from history.

  Scenario: User edits cells, runs AI, and reruns from history
    Given I open Context Matrix with a fresh local history
    And the Glide portal element exists
    When I click cell A1 and type "q1"
    And I press Tab
    Then A1 stores "q1"
    And the active selection moves to B1

    When I type "q2"
    And I press Enter
    Then B1 stores "q2"
    And the active selection moves down

    When I select range A1:B1
    And I add the range as context
    And I set E1 as the target
    And I run "write concise summary in the target cell"
    Then /api/matrix-run returns 200
    And the status bar reports "Run applied"
    And the history list contains one run

    When I open the history entry
    And I click rerun
    Then the composer is pre-filled with the original prompt
    And the status bar reports "Composer pre-filled from history"
```

## Issue Policy

Create a GitHub issue only for confirmed user-facing failures.

| Outcome | Action |
| --- | --- |
| Existing specs pass and real-user-flow passes | No GitHub issue. Record a short worklog or PR note only. |
| The new spec exposes a product regression | Create one Gherkin-style bug issue with expected/actual, trace, screenshot, and command. |
| Failure is caused by stale dev server, outdated helper, or bad test assumption | Do not create a bug issue. Fix or note the test harness problem. |
| The flow is valuable but not yet automated | Create a test-coverage improvement issue, not a bug issue. |

## Cursor CLI Review Questions

Ask Cursor CLI to review this proposal before implementation:

1. Is the scenario too broad for one Playwright test, or is a long sequential flow justified here?
2. Should AI live-run be part of the default E2E, or should it be gated behind an environment flag to avoid model/network flake?
3. Which helper boundaries should be reused from `matrix-grid-helpers.ts`, and which steps should stay explicit for readability?
4. Should the spec assert cell output content after AI run, or only assert status/history/rerun behavior?
5. What evidence should be collected on failure: trace, screenshot, console logs, `/api/matrix-run` response status, or all of them?

## Recommended Implementation Plan

1. Add `real-user-flow.spec.ts` with one happy-path scenario.
2. Keep live AI run enabled locally, but consider a CI guard if the model path is not deterministic enough.
3. Record `/api/matrix-run` response status and page errors inside the test.
4. Assert `#portal` exists before direct grid edit.
5. Prefer no GitHub issue unless the new spec finds a real product failure.

## Related Files

- `apps/context-canvas/e2e/matrix-grid.spec.ts`
- `apps/context-canvas/e2e/matrix-grid-helpers.ts`
- `apps/context-canvas/e2e/smoke.spec.ts`
- `apps/context-canvas/playwright.config.ts`
- `doc/working-log/2026-06-29-matrix-grid-e2e.md`
- `doc/working-log/2026-06-29-matrix-grid-gherkin-followup.md`
- `doc/working-log/2026-06-30-pr70-matrix-grid-pr-loop.md`
