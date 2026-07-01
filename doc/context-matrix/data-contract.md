---
title: Context Matrix — data contract
type: plan
project: berry-pi-agent
---

# Context Matrix — data contract

Domain state is the source of truth; Glide grid and markdown files are projections.

---

## Existing types (Phase 0 — `domain.ts`)

| Type | Purpose |
| --- | --- |
| `CellValue` | `string \| number \| boolean \| null` |
| `Cell` | `value`, `body`, `frontmatter`, optional `provenance` |
| `RangeRef` | Sheet-anchored rectangle (`sheetId`, start/end row/col) |
| `RangeRefDTO` | Serializable range (no `sheetId`; default sheet implied) |
| `WritePatch` | Single-cell write: coords + cell fields |
| `AiCommand` | `intent`, `targetRange`, `patches[]` |
| `Sheet` | `id`, `name`, `rows`, `cols`, sparse `cells: Map<string, Cell>` |
| `MatrixDocument` | `{ kind: "matrix", schemaVersion: 2, sheet: Sheet }` |

Helpers: `cellKey`, `createEmptyMatrixDocument`, `formatColumnLabel`, `formatRangeLabel`.

Constants: `MATRIX_DEFAULT_ROWS` (20), `MATRIX_DEFAULT_COLS` (50), `MATRIX_SHEET_ID`.

Zod mirrors: `WritePatchSchema`, `RangeRefDTOSchema`, `AiCommandSchema` in `matrix-validation.ts`.

---

## Planned types by phase

### Phase 1 — `schemaVersion: 3`

```typescript
/** User-defined label for a rectangular region. */
interface NamedRange {
  readonly name: string;           // unique per sheet, slug-safe
  readonly range: RangeRefDTO;
  readonly role?: "context" | "target" | "neutral";
}

interface MatrixDocumentV3 extends Omit<MatrixDocument, "schemaVersion"> {
  readonly schemaVersion: 3;
  readonly namedRanges: ReadonlyMap<string, NamedRange>;
}

interface MatrixRunRequest {
  readonly document: MatrixDocumentV3;
  readonly prompt: string;
  /** Phase 1: single selection or one named range; Phase 2 adds explicit context/target split */
  readonly contextRangeNames?: string[];
  readonly targetRange?: RangeRefDTO;
}
```

### Phase 2

```typescript
interface CompiledRangeContext {
  readonly contextRangeLabels: string[];   // e.g. ["inputs (A1:A5)"]
  readonly targetRangeLabel: string;
  readonly contextText: string;            // compiled markdown/YAML block
  readonly messages: Array<{ role: "system" | "user"; content: string }>;
}
```

`compileMatrixRangeContext(document, request)` — mirrors `compileQABlockContext` output shape.

### Phase 3 — `schemaVersion: 4`

```typescript
type ColumnRole =
  | "label"
  | "question"
  | "answer"
  | "context"
  | "status"
  | "note"
  | "custom";

interface SheetTemplateColumn {
  readonly col: number;          // 0-based
  readonly role: ColumnRole;
  readonly header: string;       // display override
}

interface SheetTemplate {
  readonly id: string;
  readonly name: string;
  readonly columns: SheetTemplateColumn[];
}

interface MatrixDocumentV4 extends MatrixDocumentV3 {
  readonly schemaVersion: 4;
  readonly templateId?: string;
  readonly template?: SheetTemplate;
}

/** Parsed from cell.frontmatter YAML. */
interface CellFrontmatterParsed {
  readonly status?: string;
  readonly [key: string]: unknown;
}

/** UI-only: recent named ranges / selections (session or localStorage until 4a). */
interface RecentRangeEntry {
  readonly name: string;
  readonly rangeLabel: string;
  readonly lastUsedAt: string;
}
```

`MatrixWorkspace` (full multi-project wrapper) remains **post–4b**; Phase 3 uses document + `RecentRangeEntry[]` in UI state.

### Phase 4a

```typescript
/** On-disk bundle layout (mirror canvas markdown). */
interface MatrixBundleManifest {
  readonly kind: "matrix-bundle";
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly sheetId: string;
  readonly rows: number;
  readonly cols: number;
  readonly namedRanges: NamedRange[];
  readonly templateId?: string;
}

interface MatrixCellFile {
  /** Path: cells/{row}-{col}.md */
  readonly frontmatter: CellFrontmatterParsed & {
    row: number;
    col: number;
    provenance?: string;
    value?: CellValue;
  };
  readonly body: string;
}
```

### Phase 4b

```typescript
interface MatrixHistoryEntry {
  readonly id: string;
  readonly timestamp: string;          // ISO
  readonly intent: string;
  readonly contextRangeNames: string[];
  readonly targetRangeLabel: string;
  readonly patchesApplied: number;
  readonly compiledContextPreview?: string;  // truncated
}
```

Stored in workspace: `history/runs.json` or `history/{id}.json` alongside bundle root.

---

## Reducer commands

### Existing (`matrix-reducer.ts`)

| Command | Effect |
| --- | --- |
| `apply_patches` | Merge `WritePatch[]` into sparse cell map |
| `update_cell_body` | Set `body` on one cell |
| `mock_ai_command` | `apply_patches` + meta `targetRange` |
| `clear_cell` | Remove cell from map |

### Planned

| Command | Phase | Effect |
| --- | --- | --- |
| `set_named_range` | 1 | Upsert `NamedRange` by name |
| `remove_named_range` | 1 | Delete named range |
| `apply_ai_command` | 1 | Validated `AiCommand` → patches (replaces mock-only path) |
| `update_cell_frontmatter` | 3 | Set `frontmatter` string on one cell |
| `apply_template` | 3 | Attach `SheetTemplate`, optional column resize |
| `import_bundle` | 4a | Replace document from loaded bundle |
| `append_history` | 4b | Push `MatrixHistoryEntry` (UI store or document extension) |

All commands return `MatrixApplyResult { document, meta }`.

---

## API boundary

### Decided: `POST /api/matrix-run` (Phase 1)

**Do not** extend `/api/prompt` as the primary matrix entry point. User confirmed 2026-06-28.

| Criterion | `/api/prompt` | `/api/matrix-run` |
| --- | --- | --- |
| Request body | `QABlockCanvasDocument` + `blockId` / `promptNodeId` | `MatrixRunRequest` + pre-compiled `CompiledRangeContext` |
| Response | SSE answer stream for canvas nodes | `AiCommand` JSON (or SSE chunks ending in command) |
| Validation | Canvas compiler | `parseAiCommand` + patch bounds check |
| Security | Already in `PROTECTED_API_PATHS` | Add to same set in `security.ts` |

**Rationale:**

1. `/api/prompt` handlers branch on `isQABlockPromptBody` and legacy `ContextCanvasDocument` — adding matrix risks coupling and regression in canvas flows.
2. Matrix needs **range compilation** and **patch validation** distinct from QABlock lineage.
3. Separate route simplifies testing (`security.test.ts` pattern) and future rate limits per feature.

### Proposed request/response

```typescript
// POST /api/matrix-run
interface MatrixRunRequestBody {
  compiled: CompiledRangeContext;
  document: MatrixDocumentV3;   // for model awareness of sheet dimensions
}

// Response 200
interface MatrixRunResponse {
  command: AiCommand;         // Zod-validated server-side
}

// Or SSE: delta chunks → final AiCommand frame (match canvas streaming UX if desired)
```

Client flow:

1. **Phase 1:** minimal context from selection; POST `/api/matrix-run` with prompt + document.
2. **Phase 2:** `compileMatrixRangeContext` locally → include `compiled` in request body.
3. `parseAiCommand` on client again (defense in depth).
4. `dispatch({ type: "apply_ai_command", command })`.

---

## Storage projection (Phase 4a)

Mirror `apps/context-canvas/src/storage/markdown/` bundle pattern:

```
matrix-bundle/
├── index.md                    # workspace title + nav
├── matrix.sidecar.json         # MatrixBundleManifest (like canvas.sidecar)
├── sheet/
│   └── main/
│       └── index.md            # sheet metadata + named range table
├── cells/
│   ├── 0-0.md                  # MatrixCellFile per populated cell
│   └── 1-4.md
├── templates/
│   └── default.json              # optional SheetTemplate
└── history/                    # Phase 4b
    └── runs.json
```

| Canvas module | Matrix analogue (new) |
| --- | --- |
| `projectDocumentToBundle` | `projectMatrixToBundle` |
| `loadBundle` | `loadMatrixBundle` |
| `regenerateIndexes` | `regenerateMatrixIndexes` |
| `nodes/{id}.md` | `cells/{row}-{col}.md` |
| `CANVAS_SIDECAR` | `MATRIX_SIDECAR` |

Empty cells **omit** files (sparse projection, same as sparse `cells` map).

---

## Invariants

1. **Domain over renderer** — Glide never owns canonical cell text; all edits go through `applyMatrixCommand`.
2. **AI boundary** — No patch reaches the reducer without Zod validation (`parseAiCommand` / `validateWritePatches`).
3. **Target range** — Patches outside `AiCommand.targetRange` are rejected or stripped with user-visible warning (Phase 1).
4. **Sparse storage** — Default empty cell has no map entry and no markdown file.
5. **Schema version** — Bump `schemaVersion` on document shape changes; loaders reject unknown versions.
6. **Single sheet MVP** — `MATRIX_SHEET_ID` default until multi-sheet is explicitly scoped.
7. **frontmatter opaque to grid** — Grid shows `body` summary + derived chips (status); raw YAML edited in Markdown tab.
8. **Named range uniqueness** — `name` keys are unique per sheet; compiler resolves names to `RangeRefDTO` before API call.
9. **History append-only** — Entries are not mutated; re-run creates a new entry (Phase 4b).
10. **Separate document kind** — `kind: "matrix"` never mixed into `QABlockCanvasDocument` without an explicit merge phase (post-MVP).

---

## Compile function sketch (Phase 2)

Pattern reference: `compile-qablock-context.ts`.

```typescript
function compileMatrixRangeContext(
  document: MatrixDocumentV3,
  contextNames: string[],
  target: RangeRefDTO,
  userPrompt: string,
): CompiledRangeContext;
```

Responsibilities:

- Resolve named ranges → cell bodies + frontmatter for cells in context rectangles.
- Emit `targetRangeLabel` via `formatRangeLabel`.
- Build `contextText` as structured blocks per range (name, A1 notation, cell excerpts).
- Produce `messages[]` for the agent (system: matrix write rules + JSON schema for `AiCommand`).
