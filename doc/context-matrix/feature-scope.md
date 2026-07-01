---
title: Context Matrix — feature scope
type: plan
project: berry-pi-agent
---

# Context Matrix — feature scope

Product positioning: **AI workspace with range-based context**, not Excel. The grid is a projection of domain state; Glide Data Grid is a renderer adapter only.

## Must / Should / Won't by phase

### Phase 0 — skeleton (PR #50)

| Priority | Item |
| --- | --- |
| **Must** | `MatrixDocument` + `Sheet` + sparse `Cell` map |
| **Must** | `applyMatrixCommand` reducer (`apply_patches`, `update_cell_body`, `mock_ai_command`, `clear_cell`) |
| **Must** | Zod validation at AI boundary (`AiCommand`, `WritePatch`) |
| **Must** | Glide grid render + rectangular range selection |
| **Must** | Bottom composer with selection context chip + mock AI button |
| **Must** | Side panel markdown body edit via reducer |
| **Must** | Canvas ↔ Matrix view toggle in `App.tsx` |
| **Should** | Status bar with range label |
| **Won't** | Real LLM, named ranges, persistence, left nav, semantic columns |

### Phase 1 — named range + real run

| Priority | Item |
| --- | --- |
| **Must** | `NamedRange` registry on document (`schemaVersion: 3`) |
| **Must** | Reducer: `set_named_range`, `remove_named_range`, `apply_ai_command` |
| **Must** | Composer input enabled; single selection chip → named range or ad-hoc range |
| **Must** | `POST /api/matrix-run` → validated `AiCommand` (see [data-contract.md](./data-contract.md)) |
| **Must** | Apply LLM output through Zod + `apply_ai_command` |
| **Must** | Right pane: **Markdown** tab only (upgrade overlay `aside` to pinned pane shell) |
| **Should** | Minimal compile stub (selected cells as plain text) sufficient for first real run |
| **Should** | Error surfacing when API or Zod validation fails |
| **Won't** | `compileMatrixRangeContext` (full), context vs target split, Summary/Provenance tabs, templates, persistence |

### Phase 2 — compile + target patches

| Priority | Item |
| --- | --- |
| **Must** | Composer: separate **context range(s)** vs **target range** |
| **Must** | `compileMatrixRangeContext(document, contextRanges, targetRange, prompt)` |
| **Must** | Patches outside `targetRange` rejected or stripped with user-visible warning |
| **Must** | Detail pane tabs: **Summary** + **Provenance** (Markdown tab from Ph1) |
| **Should** | Multiple context range chips in composer |
| **Should** | `CompiledRangeContext` included in `/api/matrix-run` request body |
| **Won't** | Semantic column templates, status chips, file persistence, left nav |

### Phase 3 — template + recent ranges

| Priority | Item |
| --- | --- |
| **Must** | `SheetTemplate` column roles + header row (`schemaVersion: 4`) |
| **Must** | `frontmatter.status` → visible status chip in grid cell |
| **Must** | Left nav: **Recent Ranges** list only (record last N selections / named ranges) |
| **Must** | Extract `MatrixShell` / `MatrixComposer` / `MatrixDetailPane` from monolith |
| **Should** | Default Research template (Question, Key Answer, Evidence, …) seed |
| **Should** | Reducer `update_cell_frontmatter`, `apply_template` |
| **Should** | Multiple context chips with remove/reorder |
| **Won't** | Projects / Templates / History full nav (→ post–4b), multi-project switching |

### Phase 4a — storage projection

| Priority | Item |
| --- | --- |
| **Must** | `projectMatrixToBundle` / `loadMatrixBundle` mirroring canvas markdown layout |
| **Must** | One markdown file per non-empty cell (`cells/{row}-{col}.md`) |
| **Must** | Workspace root index + sheet sidecar JSON |
| **Should** | Round-trip: bundle → `MatrixDocument` without cell loss |
| **Should** | Export/import API endpoints parallel to `/api/bundle/*` |
| **Won't** | Git sync, cloud storage |

### Phase 4b — history

| Priority | Item |
| --- | --- |
| **Must** | `MatrixHistoryEntry` append on each successful matrix run |
| **Must** | History list in left nav (intent, ranges, timestamp, cell count) |
| **Must** | Click entry → read-only detail (compiled context snippet + patches summary) |
| **Should** | Re-run from history (pre-fill composer) |
| **Should** | Local persistence of history alongside bundle (Phase 4a) |
| **Won't** | Server-side audit log, multi-user collaboration |

### Phase 5 — Excel-familiar grid UX

Product entry: users approach the grid like Excel first; AI composer is optional once a range or cell content exists.

| Priority | Item |
| --- | --- |
| **Must** | Inline text edit in grid (`onCellEdited` → `update_cell_body`) |
| **Must** | `editOnType` + rectangular range selection with address summary (`A1:C3 (3×3)`) |
| **Must** | Controlled `gridSelection` — grid highlight syncs with parent (Recent range, Enter/Tab) |
| **Must** | Enter moves selection down, Tab moves right (`trapFocus`, Glide overlay defaults) |
| **Must** | Grid displays plain cell body (badges/metadata in detail pane only) |
| **Must** | Name-box selection display in composer + status bar |
| **Must** | Selection theme (`accentColor` / `accentLight`) for visible range highlight |
| **Should** | First-visit onboarding overlay (type · drag · optional AI) |
| **Should** | Progressive AI disclosure — composer AI block after selection or cell content |
| **Should** | "Summarize selection" quick action |
| **Won't** | Formula engine, number/boolean overlay edit, full Excel macro parity |

---

## 핵심 루프 (Core loop)

End-to-end user flow spans **Phases 1→2** (Ph3 adds template UX):

1. User defines or selects **context range(s)** and a **target range** (Ph2; Ph1: single selection + named range).
2. User types intent in bottom composer (Ph1: input enabled).
3. App calls `compileMatrixRangeContext` → structured text (Ph2; Ph1: minimal stub).
4. **`POST /api/matrix-run`** — **decided** separate endpoint (not `/api/prompt`).
5. Zod validates; reducer applies patches to **target range only** (Ph2).
6. User inspects **Markdown** (Ph1), then **Summary / Provenance** (Ph2) for a cell.

Phase 0 covers: single selection chip, mock patches, markdown body in overlay aside.

---

## 추가 제안 (Additional proposals)

| Proposal | Phase | Rationale |
| --- | --- | --- |
| Dedicated `/api/matrix-run` | 1 | **Decided.** Matrix payload separate from canvas `/api/prompt` |
| `apply_ai_command` replaces `mock_ai_command` | 1 | Single path for real LLM after validation |
| Reducer `set_named_range` / `remove_named_range` | 1 | Named ranges as document state |
| `compileMatrixRangeContext` | 2 | Full range compilation after real run works |
| Context vs target range split | 2 | Prevents patches landing outside intent |
| `frontmatter.status` chips | 3 | Workflow signal without formula engine |
| `SheetTemplate` column roles | 3 | Semantic columns + Research seed template |
| `MatrixShell` component split | 3 | When Recent Ranges nav is added |

---

## MVP 이후 (Post-MVP deferrals)

Agreed **out of scope** until after Phases 0–4b:

| Item | Why deferred |
| --- | --- |
| Notifications / toasts for async runs | Needs run lifecycle + UX design |
| Multi-project workspace | Requires `MatrixWorkspace` routing + nav state |
| Full template library (CRUD, sharing) | Ph3 seed template sufficient |
| Left nav: Projects, Templates, History (full) | Ph3 ships Recent only; History in 4b; Projects/Templates post–4b |
| Canvas ↔ Matrix **data merge** | Separate document kinds today; unification is a design project |
| Formula engine / computed cells | Spreadsheet territory; conflicts with range-context model |
| Real-time collaboration | No shared backend model yet |

---

## Acceptance gherkin (concise)

### Phase 0

```gherkin
Scenario: Mock AI applies validated patches
  Given I am in Matrix view with an empty grid
  When I select range B2:D4 and click "Mock AI"
  Then cells in the patch set receive body and provenance
  And the status bar reports the update count

Scenario: Side panel edits through reducer
  Given I click cell C3
  When I edit markdown body and save
  Then C3 body updates without inline grid edit
```

### Phase 1

```gherkin
Scenario: Real matrix run via dedicated API
  Given I am in Matrix view with named range "outputs" on E1:E5
  When I enter a prompt and click Run
  Then POST /api/matrix-run is called (not /api/prompt)
  And validated patches update cells via apply_ai_command

Scenario: Markdown detail pane
  Given I click cell C3
  When I edit markdown body and save
  Then C3 body updates in the pinned detail pane (not full-screen overlay)
```

### Phase 2

```gherkin
Scenario: Named context and target ranges drive LLM run
  Given named range "inputs" covers A1:A5
  And target range "outputs" covers E1:E5
  When I submit "Summarize inputs into outputs"
  Then compileMatrixRangeContext includes A1:A5
  And only cells in E1:E5 receive patches

Scenario: Detail pane Summary and Provenance
  Given cell E2 has body, frontmatter, and provenance
  When I select E2
  Then I see Summary and Provenance tabs in addition to Markdown
```

### Phase 3

```gherkin
Scenario: Semantic column headers
  Given a SheetTemplate assigns column B role "answer"
  When I open the matrix
  Then column B header shows "answer" not only "B"

Scenario: Recent Ranges in left nav
  Given I used named range "inputs" in a prior session
  When I open the left nav
  Then "inputs" appears under Recent Ranges

Scenario: Status chip from frontmatter
  Given cell A1 frontmatter contains "status: draft"
  When the grid renders A1
  Then a "draft" status chip is visible
```

### Phase 4a

```gherkin
Scenario: Bundle round-trip
  Given a matrix with cells A1 and B2 populated
  When I export to bundle and reload
  Then MatrixDocument cells match pre-export values
```

### Phase 4b

```gherkin
Scenario: History records runs
  Given a successful matrix run updated 3 cells
  When I open History in left nav
  Then an entry shows intent, timestamp, and "3 cells updated"
```

### Phase 5

```gherkin
Scenario: Inline grid edit
  Given I am in Matrix view
  When I click cell A1 and type "hello" then press Enter
  Then A1 displays "hello" without opening the detail pane Save flow

Scenario: Range selection feedback
  Given I drag-select A1:C3
  Then the name box shows "A1:C3 (3×3)"

Scenario: Progressive AI
  Given an empty grid with no selection
  Then the AI composer section is hidden
  When I select a range or type in a cell
  Then the AI section becomes available
```
