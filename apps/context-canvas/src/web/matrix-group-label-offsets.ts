export const MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY = "context-matrix-group-label-offsets";

export interface MatrixGroupLabelOffsetEntry {
  readonly groupId: string;
  readonly x: number;
  readonly y: number;
}

export function loadMatrixGroupLabelOffsets(): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  if (typeof window === "undefined") {
    return new Map();
  }
  const raw = window.localStorage.getItem(MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY);
  if (!raw) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Map();
    }
    return new Map(
      parsed
        .filter((entry): entry is MatrixGroupLabelOffsetEntry =>
          Boolean(
            entry &&
              typeof entry === "object" &&
              typeof (entry as MatrixGroupLabelOffsetEntry).groupId === "string" &&
              Number.isFinite((entry as MatrixGroupLabelOffsetEntry).x) &&
              Number.isFinite((entry as MatrixGroupLabelOffsetEntry).y),
          ),
        )
        .map((entry) => [entry.groupId, { x: entry.x, y: entry.y }]),
    );
  } catch {
    return new Map();
  }
}

export function saveMatrixGroupLabelOffsets(
  groups: ReadonlyMap<string, { readonly labelOffset?: { readonly x: number; readonly y: number } }> | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const entries = [...(groups ?? new Map()).entries()]
    .filter((entry): entry is [string, { readonly labelOffset: { readonly x: number; readonly y: number } }] =>
      Boolean(entry[1].labelOffset),
    )
    .map(([groupId, group]) => ({
      groupId,
      x: group.labelOffset.x,
      y: group.labelOffset.y,
    }));
  if (entries.length === 0) {
    window.localStorage.removeItem(MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY, JSON.stringify(entries));
}
