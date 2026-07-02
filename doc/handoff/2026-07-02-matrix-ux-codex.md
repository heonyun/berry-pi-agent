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
summary: "Matrix UX issues registered; I01-I04 merged; next up is I05 (#97) row height resize."
---

# Matrix UX #93–#106 — Codex Handoff

**State after Codex resume:** PR #111 squash-merged to `main` at `355a6692`; next issue is #97.

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
| I05–I14 #97–#106 | Not started |
| User stop scope | GitHub issue + PR filed; **no merge** this session |

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
| I05 | 97 | Row height resize | — | pending (depends #96) |
| I06–I14 | 98–106 | See triage worklog | — | pending |

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

### Resume here

Start **I05 #97 — row height resize**. Reuse the column-width pattern, especially the resize-end-only persistence invariant.

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
Do **not** include unrelated `doc/orchestrator/*` local edits in product PRs.
