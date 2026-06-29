import { z } from "zod";
import type {
  AiCommand,
  MatrixHistoryContextRange,
  MatrixHistoryEntry,
  RangeRefDTO,
  WritePatch,
} from "./domain.ts";

// ── Zod schemas for Context Matrix AI boundary ───────────────────────────
// These schemas validate AI-generated commands and write patches before
// they reach the reducer, enforcing structural contracts at the domain edge.
// ─────────────────────────────────────────────────────────────────────────

export const WritePatchSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  body: z.string(),
  frontmatter: z.string().optional(),
  provenance: z.string().optional(),
}) satisfies z.ZodType<WritePatch>;

export const RangeRefDTOSchema = z.object({
  startRow: z.number().int().min(0),
  startCol: z.number().int().min(0),
  endRow: z.number().int().min(0),
  endCol: z.number().int().min(0),
});

export const AiCommandSchema = z.object({
  intent: z.string().min(1),
  targetRange: RangeRefDTOSchema,
  patches: z.array(WritePatchSchema).min(0),
}) satisfies z.ZodType<AiCommand>;

export type ValidatedAiCommand = z.infer<typeof AiCommandSchema>;
export type ValidatedWritePatch = z.infer<typeof WritePatchSchema>;

/**
 * Unwrap nested `{ command: AiCommand }` envelopes (common model shape) before Zod parse.
 */
export function coerceAiCommandPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  if (
    typeof record.intent === "string" &&
    record.targetRange &&
    typeof record.targetRange === "object" &&
    Array.isArray(record.patches)
  ) {
    return record;
  }
  if (record.command && typeof record.command === "object") {
    return coerceAiCommandPayload(record.command);
  }
  return raw;
}

/**
 * Parse and validate an unknown payload as an AiCommand.
 * Returns the validated command or an array of ZodError issues.
 */
export function parseAiCommand(raw: unknown):
  | { ok: true; command: AiCommand }
  | { ok: false; errors: z.ZodError } {
  const result = AiCommandSchema.safeParse(coerceAiCommandPayload(raw));
  if (result.success) {
    return { ok: true, command: result.data };
  }
  return { ok: false, errors: result.error };
}

/**
 * Validate a batch of write patches. Returns the validated patches
 * or an array of error messages by index.
 */
export function isRangeRefDTO(value: unknown): value is RangeRefDTO {
  return RangeRefDTOSchema.safeParse(value).success;
}

export function isMatrixHistoryContextRange(value: unknown): value is MatrixHistoryContextRange {
  if (!value || typeof value !== "object") {
    return false;
  }
  const range = value as Record<string, unknown>;
  return typeof range.label === "string" && isRangeRefDTO(range.range);
}

export function isMatrixHistoryEntry(value: unknown): value is MatrixHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "string" &&
    typeof entry.intent === "string" &&
    Array.isArray(entry.contextRangeNames) &&
    entry.contextRangeNames.every((name) => typeof name === "string") &&
    Array.isArray(entry.contextRanges) &&
    entry.contextRanges.every(isMatrixHistoryContextRange) &&
    typeof entry.targetRangeLabel === "string" &&
    isRangeRefDTO(entry.targetRange) &&
    typeof entry.patchesApplied === "number" &&
    (entry.compiledContextPreview === undefined || typeof entry.compiledContextPreview === "string") &&
    (entry.patchesSummary === undefined || typeof entry.patchesSummary === "string")
  );
}

export function isCellInRange(row: number, col: number, range: RangeRefDTO): boolean {
  return (
    row >= range.startRow &&
    row <= range.endRow &&
    col >= range.startCol &&
    col <= range.endCol
  );
}

/**
 * Bind an AI command to the user-selected target range.
 * The UI/composer target is canonical; model-returned targetRange may drift.
 */
export function bindAiCommandToUserTarget(
  command: AiCommand,
  userTargetRange: RangeRefDTO,
): AiCommand {
  const { patches } = filterPatchesToTargetRange(command.patches, userTargetRange);
  return {
    ...command,
    targetRange: userTargetRange,
    patches,
  };
}

/** Strip patches outside targetRange; return count removed for user-visible warnings. */
export function filterPatchesToTargetRange(
  patches: readonly WritePatch[],
  targetRange: RangeRefDTO,
): { patches: WritePatch[]; strippedCount: number } {
  const inRange: WritePatch[] = [];
  let strippedCount = 0;
  for (const patch of patches) {
    if (isCellInRange(patch.row, patch.col, targetRange)) {
      inRange.push(patch);
    } else {
      strippedCount++;
    }
  }
  return { patches: inRange, strippedCount };
}

export function validateWritePatches(patches: unknown[]):
  | { ok: true; patches: WritePatch[] }
  | { ok: false; errors: Array<{ index: number; message: string }> } {
  const errors: Array<{ index: number; message: string }> = [];
  const valid: WritePatch[] = [];
  for (let i = 0; i < patches.length; i++) {
    const result = WritePatchSchema.safeParse(patches[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({ index: i, message: result.error.message });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, patches: valid };
}