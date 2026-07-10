# Matrix session observability (drill_down)

Issue: (pending) — dev-only logging for manual Matrix testing.

## Event schema

```ts
type MatrixSessionEventKind =
  | "shortcut"
  | "run_start"
  | "run_end"
  | "status"
  | "edit_commit"
  | "export"
  | "error";

type MatrixSessionEvent = {
  ts: string; // ISO
  kind: MatrixSessionEventKind;
  detail: Record<string, unknown>;
};
```

Storage: `localStorage` key `context-matrix-session-log`, ring buffer max **300** entries.

## Enable flags

| Flag | Where | Default |
| --- | --- | --- |
| `import.meta.env.DEV` | client | session log on in dev |
| `VITE_CONTEXT_CANVAS_DEBUG_LOG=0` | client | force off |
| `CONTEXT_CANVAS_REQUEST_LOG=1` | server | request log on |
| `CONTEXT_CANVAS_REQUEST_LOG=0` | server | off |

## Hook points

| Location | Events |
| --- | --- |
| `MatrixCanvas.tsx` `setStatus` wrapper | `status` |
| `MatrixCanvas.tsx` run paths | `run_start`, `run_end` (outcome, trigger, error) |
| `MatrixCanvas.tsx` `matrix-commit-run` listener | `shortcut` |
| `MatrixCanvas.tsx` keydown blocked path | `shortcut` with `blockedReason` |
| `MatrixGrid.tsx` commit / commit-then-run | `edit_commit`, `shortcut` |
| `export-matrix-bundle.ts` schedule | `export` success/failure |
| `matrix-shortcut.ts` | no direct log — callers pass blocked reason |

## History entry extensions (AC-2)

```ts
outcome?: "success" | "failure" | "blocked";
errorMessage?: string;
trigger?: "button" | "shortcut_below" | "shortcut_right" | "cell_reference";
```

Backward compatible: missing `outcome` treated as `success`.

## Server request log (AC-3)

Per request when `CONTEXT_CANVAS_REQUEST_LOG=1`:

```
[context-canvas] reqId=<8hex> POST /api/matrix-run 200 842ms target=C6:C6 promptLen=12
```

Never log: API keys, full prompt text, cell bodies.

`dev.mjs` sets `CONTEXT_CANVAS_REQUEST_LOG=1` and tees server stdout to `.orchestrator/context-canvas-dev/api.log`.

## Sensitive data policy

- Session log: truncate strings > 200 chars
- No `DEEPSEEK_API_KEY` or `CONTEXT_CANVAS_TOKEN` in any log field

## Manual verification

1. `npm run dev` in context-canvas
2. Trigger blocked shortcut → check `context-matrix-session-log`
3. Failed run (empty prompt) → history shows `outcome: failure`
4. Check `.orchestrator/context-canvas-dev/api.log` for request lines
