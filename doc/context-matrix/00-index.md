---
title: Context Matrix — planning hub
type: plan
project: berry-pi-agent
harness_flow: implement
task_class: complex
task_id: context-matrix
next_action: Post-MVP UX/E2E stable on main @ 0b6495bf (16/16 e2e); deferred export/load UI buttons
drill_down: doc/working-log/2026-07-01-harness-eval-final.md
obsidian_task: Projects/berry-pi-agent/tasks/issue-49-context-matrix/00-index.md
---

# Context Matrix — planning hub

**Goal:** Context Matrix is an AI workspace where context lives in **named ranges** on a semantic grid—not a spreadsheet clone. Users select context and target ranges, compile structured context for the LLM, apply validated patches back to cells, and inspect provenance in a detail pane. Delivery is **phase-per-PR**: skeleton → draft PR → review loop.

## Decisions (2026-06-28)

| Topic | Decision |
| --- | --- |
| Matrix API | **Decided:** dedicated `POST /api/matrix-run` (not extend `/api/prompt`) |
| Phase order | **Ph1** named range + real run + Markdown pane → **Ph2** compile + target patches + Summary/Provenance → **Ph3** template + Recent Ranges + semantic grid |
| Component split | **Phase 3** when left nav (Recent) lands; Ph1–2 stay in `MatrixCanvas.tsx` monolith |
| `schemaVersion` | **v3** in Phase 1 (`namedRanges`); **v4** in Phase 3 (`templateId` / `SheetTemplate`) |
| Full 3-zone shell | Projects / Templates nav stubs → **post-MVP**; Ph3 ships **Recent Ranges only** |

## Documents

| Doc | Purpose |
| --- | --- |
| [feature-scope.md](./feature-scope.md) | Must/Should/Won't by phase, core loop, deferrals, acceptance gherkin |
| [screen-layout.md](./screen-layout.md) | Mockup zones → components, testids, build status |
| [data-contract.md](./data-contract.md) | Domain types, reducer commands, API boundary, storage projection |

## Phase map

| Phase | PR target | Summary | Status |
| --- | --- | --- | --- |
| **0** | [#50](https://github.com/heonyun/berry-pi-agent/pull/50) | `MatrixDocument`, reducer, Zod, Glide grid, mock AI, side-panel body edit, Canvas↔Matrix toggle | **Merged** 2026-06-28 |
| **1** | [#52](https://github.com/heonyun/berry-pi-agent/pull/52) | Named ranges, active composer, `POST /api/matrix-run`, `apply_ai_command`, Markdown detail pane | **Merged** 2026-06-28 (`a800d322`) |
| **2** | [#54](https://github.com/heonyun/berry-pi-agent/pull/54) | `compileMatrixRangeContext`, context vs target ranges, patch bounds, Summary + Provenance tabs | **Merged** 2026-06-28 (`359b709a`) |
| **3** | [#56](https://github.com/heonyun/berry-pi-agent/pull/56) | SheetTemplate, semantic columns, status chips, left **Recent Ranges** nav; extract shell components | **Merged** 2026-06-28 (536141ea) |
| **4a** | [#58](https://github.com/heonyun/berry-pi-agent/pull/58) | Markdown bundle storage projection (MatrixWorkspace, per-cell files) | **Merged** 1cb61a89 |
| **4b** | [#60](https://github.com/heonyun/berry-pi-agent/pull/60) · [#62](https://github.com/heonyun/berry-pi-agent/pull/62) | Run history + auto-export to bundle | **Merged** `6c934599` + `89b53779` |

> **MVP complete** on `main` @ `89b53779` (2026-06-28). Deferred: Matrix UI export/load buttons.

## Post-MVP follow-up (2026-06-30 — 2026-07-01)

| PR | Summary | Status |
| --- | --- | --- |
| [#70](https://github.com/heonyun/berry-pi-agent/pull/70) | Matrix grid inline edit Gherkin | **Merged** |
| [#74](https://github.com/heonyun/berry-pi-agent/pull/74) | Layout overlay click fix (#72) | **Merged** |
| [#75](https://github.com/heonyun/berry-pi-agent/pull/75) | F2 cell edit (#73) | **Merged** |
| [#76](https://github.com/heonyun/berry-pi-agent/pull/76) | Row/column header selection + `real-user-flow.spec.ts` (#71) | **Merged** `0b6495bf` |

E2E baseline: **16/16** (`matrix-grid.spec.ts` 12 + `real-user-flow.spec.ts` 1 + smoke/a11y).

Planning docs: [user-action-bdd-playwright-e2e-plan.md](./user-action-bdd-playwright-e2e-plan.md), [playwright-real-user-flow-e2e-proposal.md](./playwright-real-user-flow-e2e-proposal.md).

> **Note:** Phase 0 code lives on branch `codex/context-matrix-mvp-spike-local` (same commit family as PR #50). Later phases branch from merged Phase 0 unless user directs stacked PRs.

## Harness

| Field | Value |
| --- | --- |
| harness_flow | implement |
| task_class | complex |
| next_action | Post-MVP E2E 16/16 @ 0b6495bf; harness eval pilot closed — see drill_down |
| drill_down | `doc/working-log/2026-07-01-harness-eval-final.md` |
| obsidian_task | `Projects/berry-pi-agent/tasks/issue-49-context-matrix/00-index.md` |

## Affected (future implementation)

- `apps/context-canvas/src/shared/domain.ts`
- `apps/context-canvas/src/core/matrix-reducer.ts`
- `apps/context-canvas/src/shared/matrix-validation.ts`
- `apps/context-canvas/src/shared/compile-matrix-range-context.ts` (new)
- `apps/context-canvas/src/web/MatrixCanvas.tsx` + new shell components
- `apps/context-canvas/src/storage/matrix/` (new, Phase 4a)
- `apps/context-canvas/src/server/index.ts` (`/api/matrix-run`)

## Links

- Issue: [#49](https://github.com/heonyun/berry-pi-agent/issues/49) (Matrix MVP — closed)
- PR (Phase 0): [#50](https://github.com/heonyun/berry-pi-agent/pull/50) (merged)
- Obsidian task: `Projects/berry-pi-agent/tasks/issue-49-context-matrix/00-index.md`
- Worklog: `doc/working-log/2026-06-28-context-matrix-planning-docs.md`
- Decisions: `doc/context-matrix/00-index.md` § Decisions (2026-06-28)
- Pattern reference: `apps/context-canvas/src/shared/compile-qablock-context.ts`
- Canvas storage pattern: `apps/context-canvas/src/storage/markdown/`
