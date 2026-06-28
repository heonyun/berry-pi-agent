import { z } from "zod";
import type { AiCommand, WritePatch } from "./domain.ts";

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
 * Parse and validate an unknown payload as an AiCommand.
 * Returns the validated command or an array of ZodError issues.
 */
export function parseAiCommand(raw: unknown):
  | { ok: true; command: AiCommand }
  | { ok: false; errors: z.ZodError } {
  const result = AiCommandSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, command: result.data };
  }
  return { ok: false, errors: result.error };
}

/**
 * Validate a batch of write patches. Returns the validated patches
 * or an array of error messages by index.
 */
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