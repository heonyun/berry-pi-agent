export const VERTICAL_GAP = 240;
export const INITIAL_PROMPT_TEXT = "What should we explore on this canvas?";
export const DEFAULT_CANVAS_ID = "canvas-1";

export type StanceBand = "critical" | "neutral" | "constructive";
export type FeedbackState = "agree" | "disagree" | "unsure" | "needs_retry";
export type EdgeMeaning = "lineage" | "context_reference";
export type NodeKind = "prompt_input" | "ai_answer";

export interface Vec2 {
  x: number;
  y: number;
}

export interface AnswerVersion {
  id: string;
  text: string;
  createdAt: string;
  feedback?: FeedbackState;
}

export interface AnswerStack {
  activeVersionId: string;
  versions: AnswerVersion[];
}

export interface NodeMetadata {
  stance?: StanceBand;
}

export interface PromptInputNode {
  id: string;
  kind: "prompt_input";
  groupId: string;
  text: string;
  position: Vec2;
  metadata: NodeMetadata;
}

export interface AIAnswerNode {
  id: string;
  kind: "ai_answer";
  groupId: string;
  text: string;
  position: Vec2;
  metadata: NodeMetadata;
  feedback?: FeedbackState;
  stack?: AnswerStack;
}

export type ContextNode = PromptInputNode | AIAnswerNode;

export interface ContextEdge {
  id: string;
  source: string;
  target: string;
  meaning: EdgeMeaning;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ContextGroup {
  id: string;
  title: string;
  origin: Vec2;
  summary?: string;
  updatedAt?: string;
}

export interface ContextCanvasDocument {
  schemaVersion: 1;
  canvas: { id: string; title: string };
  groups: ContextGroup[];
  nodes: ContextNode[];
  edges: ContextEdge[];
}

export function calculateStanceBand(
  promptPosition: Vec2,
  referencePosition: Vec2,
  threshold = 140,
): StanceBand {
  const dx = promptPosition.x - referencePosition.x;
  if (dx <= -threshold) {
    return "critical";
  }
  if (dx >= threshold) {
    return "constructive";
  }
  return "neutral";
}

export function appendAnswerVersion(
  node: AIAnswerNode,
  version: { text: string; createdAt?: string; feedback?: FeedbackState },
): AIAnswerNode {
  const existingVersions = node.stack?.versions ?? [];
  const nextVersionNumber = existingVersions.length + 1;
  const nextVersion: AnswerVersion = {
    id: `${node.id}-v${nextVersionNumber}`,
    text: version.text,
    createdAt: version.createdAt ?? new Date().toISOString(),
    feedback: version.feedback,
  };
  return {
    ...node,
    text: version.text,
    feedback: version.feedback ?? node.feedback,
    stack: {
      activeVersionId: nextVersion.id,
      versions: [...existingVersions, nextVersion],
    },
  };
}

export function createInitialDocument(): ContextCanvasDocument {
  return {
    schemaVersion: 1,
    canvas: {
      id: DEFAULT_CANVAS_ID,
      title: "Context Canvas MVP",
    },
    groups: [
      {
        id: "group-1",
        title: "Conversation",
        origin: { x: 0, y: 0 },
        summary: "",
      },
    ],
    nodes: [
      {
        id: "prompt-1",
        kind: "prompt_input",
        groupId: "group-1",
        text: INITIAL_PROMPT_TEXT,
        position: { x: 0, y: 0 },
        metadata: { stance: "neutral" },
      },
    ],
    edges: [],
  };
}

export function findNode(document: ContextCanvasDocument, nodeId: string): ContextNode {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new Error(`Unknown node: ${nodeId}`);
  }
  return node;
}

export function normalizeDocument(document: ContextCanvasDocument): ContextCanvasDocument {
  return {
    ...document,
    groups: document.groups.map((group) => ({
      ...group,
      summary: group.summary ?? "",
    })),
  };
}

export function updateNode(
  document: ContextCanvasDocument,
  nodeId: string,
  updater: (node: ContextNode) => ContextNode,
): ContextCanvasDocument {
  return {
    ...document,
    nodes: document.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
  };
}

/** WHY: schema v2 is a clean break from prompt_input + ai_answer pairs; v1 converter is deferred. */
export const QA_BLOCK_SCHEMA_VERSION = 2 as const;
/** WHY: v2 blocks are ~50% larger than v1 nodes (320×180); gap scales with block size (issue-39). */
export const QA_BLOCK_APPROX_WIDTH = 480;
export const QA_BLOCK_APPROX_HEIGHT = 270;
/** Visual gap between stacked blocks after height-aware reflow (issue #44). */
export const QA_BLOCK_STACK_GAP = 20;
/** Initial vertical offset before measured reflow; approx height + stack gap (issue-39). */
export const QA_BLOCK_VERTICAL_GAP = QA_BLOCK_APPROX_HEIGHT + QA_BLOCK_STACK_GAP;
export const QA_BLOCK_HORIZONTAL_GAP = 540;
export const QA_BLOCK_COLUMN_TOLERANCE = 72;
/** TODO: issue-39 — tentative snap/detach threshold; confirm in manual UX pass. */
export const QA_BLOCK_MAGNETIC_DETACH_THRESHOLD = 30;

export interface QABlock {
  id: string;
  kind: "qa_block";
  groupId: string;
  question: string;
  answer: string;
  position: Vec2;
  /** Magnetic anchor; edges show when position drifts beyond detach threshold. */
  snapPosition: Vec2;
  metadata: NodeMetadata;
  stack?: AnswerStack;
}

export interface QABlockCanvasDocument {
  schemaVersion: typeof QA_BLOCK_SCHEMA_VERSION;
  canvas: { id: string; title: string };
  groups: ContextGroup[];
  blocks: QABlock[];
  edges: ContextEdge[];
}

/** Minimal canvas sidecar for Obsidian/external-tool observability (viewport optional). */
export interface CanvasSidecar {
  id: string;
  title: string;
  schemaVersion: typeof QA_BLOCK_SCHEMA_VERSION;
  viewport?: { x: number; y: number; zoom: number };
}

/** TODO: issue-39 — replace v1 initial document once App reads v2 only. */
export function createEmptyQABlockDocument(): QABlockCanvasDocument {
  return {
    schemaVersion: QA_BLOCK_SCHEMA_VERSION,
    canvas: { id: DEFAULT_CANVAS_ID, title: "Context Canvas" },
    groups: [
      {
        id: "group-1",
        title: "Conversation",
        origin: { x: 0, y: 0 },
        summary: "",
      },
    ],
    blocks: [],
    edges: [],
  };
}

export function findQABlock(document: QABlockCanvasDocument, blockId: string): QABlock {
  const block = document.blocks.find((candidate) => candidate.id === blockId);
  if (!block) {
    throw new Error(`Unknown qa_block: ${blockId}`);
  }
  return block;
}

export function updateQABlock(
  document: QABlockCanvasDocument,
  blockId: string,
  updater: (block: QABlock) => QABlock,
): QABlockCanvasDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
  };
}

export function appendQABlockAnswerVersion(
  block: QABlock,
  version: { text: string; createdAt?: string },
): QABlock {
  const existingVersions = block.stack?.versions ?? [];
  const nextVersionNumber = existingVersions.length + 1;
  const nextVersion: AnswerVersion = {
    id: `${block.id}-v${nextVersionNumber}`,
    text: version.text,
    createdAt: version.createdAt ?? new Date().toISOString(),
  };
  return {
    ...block,
    answer: version.text,
    stack: {
      activeVersionId: nextVersion.id,
      versions: [...existingVersions, nextVersion],
    },
  };
}

// ── Context Matrix domain types (#49) ─────────────────────────────────────
/** INVARIANT: MatrixDocument is source of truth; grid renderer is a view adapter only. */

export const MATRIX_DEFAULT_COLS = 50;
export const MATRIX_DEFAULT_ROWS = 20;
export const MATRIX_SHEET_ID = "sheet-main";

/** Cell value types the matrix supports (no rich objects yet). */
export type CellValue = string | number | boolean | null;

/** A single cell in the matrix; body + hidden frontmatter. */
export interface Cell {
  readonly value: CellValue;
  /** Markdown body displayed as concise summary in the grid. */
  readonly body: string;
  /** Hidden YAML/frontmatter metadata (not shown in grid). */
  readonly frontmatter: string;
  /** Provenance badge label shown as small metadata indicator. */
  readonly provenance?: string;
}

/** A rectangular range reference anchored by top-left and bottom-right. */
export interface RangeRef {
  readonly sheetId: string;
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
}

/** Serialisable range reference for cross-boundary messages. */
export interface RangeRefDTO {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
}

/** AI-generated instruction for what to patch and where. */
export interface AiCommand {
  readonly intent: string;
  readonly targetRange: RangeRefDTO;
  readonly patches: WritePatch[];
}

/** A single write patch targeting one cell. */
export interface WritePatch {
  readonly row: number;
  readonly col: number;
  readonly value: CellValue;
  readonly body: string;
  readonly frontmatter?: string;
  readonly provenance?: string;
}

/** A named sheet within the matrix document. */
export interface Sheet {
  readonly id: string;
  readonly name: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells: ReadonlyMap<string, Cell>;
}

/** User-defined label for a rectangular region. */
export interface NamedRange {
  readonly name: string;
  readonly range: RangeRefDTO;
  readonly role?: "context" | "target" | "neutral";
}

/** Semantic column role for sheet templates (Phase 3). */
export type ColumnRole =
  | "label"
  | "question"
  | "answer"
  | "context"
  | "status"
  | "note"
  | "custom";

/** One column definition within a SheetTemplate. */
export interface SheetTemplateColumn {
  readonly col: number;
  readonly role: ColumnRole;
  readonly header: string;
}

/** Column layout template attached to a matrix sheet. */
export interface SheetTemplate {
  readonly id: string;
  readonly name: string;
  readonly columns: SheetTemplateColumn[];
}

/** Parsed from cell.frontmatter YAML (subset used by grid chips). */
export interface CellFrontmatterParsed {
  readonly status?: string;
  readonly [key: string]: unknown;
}

/** UI-only recent range entry (session/localStorage until Phase 4a). */
export interface RecentRangeEntry {
  readonly name: string;
  readonly rangeLabel: string;
  readonly lastUsedAt: string;
}

/** Context range snapshot stored with a history entry for re-run pre-fill. */
export interface MatrixHistoryContextRange {
  readonly label: string;
  readonly range: RangeRefDTO;
}

/** Append-only record of a successful matrix AI run (Phase 4b). */
export interface MatrixHistoryEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly intent: string;
  readonly contextRangeNames: string[];
  readonly contextRanges: readonly MatrixHistoryContextRange[];
  readonly targetRangeLabel: string;
  readonly targetRange: RangeRefDTO;
  readonly patchesApplied: number;
  readonly compiledContextPreview?: string;
  readonly patchesSummary?: string;
}

/** Top-level matrix document: the single source of truth. */
export interface MatrixDocument {
  readonly kind: "matrix";
  readonly schemaVersion: 4;
  readonly sheet: Sheet;
  readonly namedRanges: ReadonlyMap<string, NamedRange>;
  readonly templateId?: string;
  readonly template?: SheetTemplate;
}

export const RESEARCH_SHEET_TEMPLATE: SheetTemplate = {
  id: "research-default",
  name: "Research",
  columns: [
    { col: 0, role: "label", header: "ID" },
    { col: 1, role: "question", header: "Question" },
    { col: 2, role: "answer", header: "Key Answer" },
    { col: 3, role: "context", header: "Evidence" },
    { col: 4, role: "status", header: "Status" },
    { col: 5, role: "note", header: "Notes" },
  ],
};

/** Helper: encode row,col into a map key. */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** Helper: create initial empty matrix document (20x50) with optional Research template. */
export function createEmptyMatrixDocument(options?: { withResearchTemplate?: boolean }): MatrixDocument {
  const withTemplate = options?.withResearchTemplate ?? true;
  return {
    kind: "matrix",
    schemaVersion: 4,
    sheet: {
      id: MATRIX_SHEET_ID,
      name: "Context Matrix",
      rows: MATRIX_DEFAULT_ROWS,
      cols: MATRIX_DEFAULT_COLS,
      cells: new Map(),
    },
    namedRanges: new Map(),
    ...(withTemplate
      ? { templateId: RESEARCH_SHEET_TEMPLATE.id, template: RESEARCH_SHEET_TEMPLATE }
      : {}),
  };
}

/** Resolve semantic header for a column from the active template, else Excel-style label. */
export function getColumnHeader(document: MatrixDocument, col: number): string {
  const templateCol = document.template?.columns.find((c) => c.col === col);
  return templateCol?.header ?? formatColumnLabel(col);
}

export function rangesEqual(a: RangeRefDTO, b: RangeRefDTO): boolean {
  return (
    a.startRow === b.startRow &&
    a.startCol === b.startCol &&
    a.endRow === b.endRow &&
    a.endCol === b.endCol
  );
}

export function findNamedRangeForSelection(
  document: MatrixDocument,
  selection: RangeRefDTO,
): NamedRange | undefined {
  if (!document.namedRanges) {
    return undefined;
  }
  for (const namedRange of document.namedRanges.values()) {
    if (rangesEqual(namedRange.range, selection)) {
      return namedRange;
    }
  }
  return undefined;
}

/** Helper: column label like "A" or "AA" from a 0-based coordinate. */
export function formatColumnLabel(col: number): string {
  let label = "";
  let n = col;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** Helper: range label like "B2:D8" from 0-based coordinates. */
export function formatRangeLabel(startCol: number, startRow: number, endCol: number, endRow: number): string {
  return `${formatColumnLabel(startCol)}${startRow + 1}:${formatColumnLabel(endCol)}${endRow + 1}`;
}

/** Excel-style selection summary, e.g. "A1:C3 (3×3)" or "B2" for single cell. */
export function formatSelectionSummary(range: RangeRefDTO): string {
  const label = formatRangeLabel(range.startCol, range.startRow, range.endCol, range.endRow);
  const width = range.endCol - range.startCol + 1;
  const height = range.endRow - range.startRow + 1;
  if (width === 1 && height === 1) {
    return label;
  }
  return `${label} (${width}×${height})`;
}
