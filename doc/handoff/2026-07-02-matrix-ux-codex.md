---
title: "Matrix UX #93–#106 — Codex Handoff"
type: handoff
status: completed
project: pi-agent
area: context-canvas
date: 2026-07-02
updated: 2026-07-02
author: Cursor
canonical_repo: "C:\\Dev\\pi-agent"
summary: "Matrix UX issues registered; I01-I06 merged; next up is I07 (#99) full corner-dot cell grid."
---

# Matrix UX #93–#106 — Codex Handoff

**State after Codex resume:** PR #114 squash-merged to `main` at `0e206ca8`; next issue is #99.

**Repo:** `C:\Dev\pi-agent` (`heonyun/berry-pi-agent` fork of `earendil-works/pi`)

**Orchestration:** Cursor owns judgment/commits/PR; Qwen/Reasonix advisory unless user authorizes edit-mode.

---

## TL;DR

| Item | Status |
| --- | --- |
| GitHub issues #93–#106 registered | **Done** |
| I01 #93 Korean IME skeleton (PR #107) | **Merged** — follow-up **#108** |
| I02 #94 Ctrl+Enter (PR #109) | **Merged** |
| I03 #95 group label dbl-click rename (PR #110) | **Merged** |
| I04 #96 column width resize (PR #111) | **Merged** — `355a6692` |
| I05 #97 row height resize (PR #113) | **Merged** — `502d2900` |
| I06 #98 group corner-dot boundaries (PR #114) | **Merged** — `0e206ca8` |
| I07–I14 #99–#106 | Not started |
| User stop scope | Continue all issues with per-issue PR loop |

---

## Workflow (do not change without user ask)

1. **One issue → one PR → CI + review → squash merge**
2. Use **regular PR** (`gh pr create`), not `--draft`, unless user requests Draft PR workflow
3. Skeleton/incomplete work → **follow-up issue** (lesson from #93 → #108)
4. Tag comments in code: `WHY:`, `INVARIANT:`, `CONTRACT:`, `RELATED:` per `apps/context-canvas/COMMENT_CONVENTIONS.md`

---

## Issue map

| ID | # | Title | PR | State |
|----|---|-------|-----|-------|
| I01 | 93 | Korean IME first char English | #107 | merged |
| I01b | 108 | Grid overlay ImeTextarea (phase 2) | — | open |
| I02 | 94 | Ctrl+Enter shortcut | #109 | merged |
| I03 | 95 | Group label double-click rename | #110 | merged |
| I04 | 96 | Column width resize | **#111** | **merged, #96 closed** |
| I05 | 97 | Row height resize | **#113** | **merged, #97 closed** |
| I06 | 98 | Group corner-dot boundaries | **#114** | **merged, #98 closed** |
| I07–I14 | 99–106 | See triage worklog | — | pending |

Local IDs: `doc/working-log/.matrix-ux-issue-ids.json`

---

## Completed: I04 #96 / PR #111

### What was built

```
apps/context-canvas/src/shared/matrix-column-width.ts   # default 120, clamp 50–500
apps/context-canvas/src/web/matrix-column-widths.ts     # localStorage key
apps/context-canvas/src/core/matrix-reducer.ts          # set_column_width
apps/context-canvas/src/web/MatrixGrid.tsx              # onColumnResizeEnd → onColumnResize
apps/context-canvas/src/web/MatrixCanvas.tsx            # dispatch + save + bundle export
apps/context-canvas/src/storage/matrix/{sidecar,load,types}.ts
apps/context-canvas/e2e/matrix-grid.spec.ts           # resize + reload test
```

### Critical invariant

**Only persist on `onColumnResizeEnd`.** Do not wire `onColumnResize` to domain save — Glide emits interim widths (often min 50px) during drag start.

```tsx
// MatrixGrid.tsx — correct pattern
onColumnResizeEnd={handleColumnResize}
// NOT: onColumnResize={handleColumnResize}
```

### Persistence layers

| Layer | Mechanism |
| --- | --- |
| SPA reload | `localStorage` `context-matrix-column-widths` |
| Bundle export | `columnWidths` in matrix sidecar manifest |
| Init | `MatrixCanvas` merges `loadMatrixColumnWidths()` into empty document |

### Final status (PR #111)

| Check | Result |
| --- | --- |
| `build-check-test` | pass |
| CodeRabbit | pass |
| `review` (DeepSeek diff review workflow) | pass |
| Merge | `355a6692` |

### Commands to verify locally

```powershell
cd C:\Dev\pi-agent
git checkout codex/issue-96-matrix-column-resize

cd apps\context-canvas
npm test -- --run src/shared/matrix-column-width.test.ts src/web/matrix-column-widths.test.ts src/core/matrix-reducer.test.ts src/storage/matrix/projection.test.ts
npm run e2e -- -g "Column width resize"
npm run build
```

## Completed: I05 #97 / PR #113

### What was built

```
apps/context-canvas/src/shared/matrix-row-height.ts     # default 34, clamp 24-300
apps/context-canvas/src/web/matrix-row-heights.ts       # localStorage key
apps/context-canvas/src/core/matrix-reducer.ts          # set_row_height
apps/context-canvas/src/web/MatrixGrid.tsx              # row marker overlay handles
apps/context-canvas/src/web/MatrixCanvas.tsx            # dispatch + save + bundle export
apps/context-canvas/src/storage/matrix/{sidecar,load,types}.ts
apps/context-canvas/e2e/matrix-grid.spec.ts             # resize + reload test
```

### Critical invariant

**Persist only on pointer-up resize end.** Drag motion may preview height in local Grid state, but domain/localStorage/bundle export happen once at release.

```tsx
// MatrixGrid.tsx
// INVARIANT: Persist only on drag end, matching column resize-end behavior (#96, #97).
onRowResize(rowResizeDrag.row, height);
```

### Final status (PR #113)

| Check | Result |
| --- | --- |
| `build-check-test` | pass |
| CodeRabbit | pass |
| `dispatch` / `review` (DeepSeek workflow) | pass |
| Merge | `502d2900` |

### Commands verified locally

```powershell
cd C:\Dev\pi-agent\apps\context-canvas
npm test -- --run src/shared/matrix-row-height.test.ts src/web/matrix-row-heights.test.ts src/core/matrix-reducer.test.ts src/storage/matrix/projection.test.ts src/server/matrix-bundle.test.ts src/web/export-matrix-bundle.test.ts
npm run typecheck
npm run e2e -- -g "Column width resize|Row height resize"
npm run build
```

## Completed: I06 #98 / PR #114

### What was built

```
apps/context-canvas/src/web/MatrixGrid.tsx              # group boundary overlay + corner dots
apps/context-canvas/src/web/styles.css                  # soft boundary and dot styling
apps/context-canvas/e2e/matrix-grid.spec.ts             # visible boundary/dot coverage
```

### Critical invariant

**Corner dots are static visual affordances only.** Do not attach selection, drag, or resize behavior to #98 dots; I07 #99 owns the full cell-grid corner-dot interaction.

```tsx
{/* ASSUMPTION: issue-98 dots are static affordances; interactive grid corners are I07. */}
```

### Final status (PR #114)

| Check | Result |
| --- | --- |
| `build-check-test` | pass |
| CodeRabbit | success |
| `dispatch` / `review` (DeepSeek workflow) | pass |
| Merge | `0e206ca8` |

### Commands verified locally

```powershell
cd C:\Dev\pi-agent\apps\context-canvas
npm run e2e -- -g "Auto group appears|Single click on group label|Escape cancels group label edits|Clicking away saves group label edits"
npm run typecheck
npm run build
cd C:\Dev\pi-agent
npm run test --workspace=@berry-pi/context-canvas
```

### Resume here

Start **I07 #99 — full corner-dot cell grid**.

---

## Qwen worker (local only)

- `scripts/QwenWorkerCommon.ps1`, `Invoke-QwenWorkerTicket.ps1` — **gitignored** on this workstation
- Auth smoke fix: `--auth-type openai`, `OPENAI_API_KEY` mapped from process `DEEPSEEK_API_KEY`
- Do not commit API keys; `~/.qwen/settings.json` may have placeholder values

---

## After I04

**I05 #97** — row height resize (acceptance likely mirrors column: drag, persist, reload test). Reuse column-width patterns; check Glide `onRowResizeEnd` API.

Also record harness follow-up from PR #111:

- Qwen local diff-review failed twice due tool-call budget drift; make the script emit `INCONCLUSIVE` artifacts.
- GitHub Actions review should separate execution status from review verdict.
- DeepSeek subagent mini-tickets were more useful for fast sidecar triage.

---

## Related docs

- Repo worklog (detail): `doc/working-log/2026-07-02-matrix-ux-i04-handoff.md`
- Triage index: `doc/working-log/2026-07-02-matrix-ux-issue-triage.md`
- Obsidian: `DailyNote/2026-07-02.md`
- AGENTS router: `AGENTS.md`, `apps/context-canvas/AGENTS.md`
- PR body draft: `doc/working-log/.pr-body-issue-96.md`

---

## Git note

PR #111 merge commit: `355a6692`.  
PR #113 merge commit: `502d2900`.  
PR #114 merge commit: `0e206ca8`.  
Do **not** include unrelated `doc/orchestrator/*` local edits in product PRs.
