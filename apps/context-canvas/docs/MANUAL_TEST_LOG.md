# Manual Matrix test log handoff

Use this when manual testing finds problems and you need to attach evidence to a GitHub issue (for example [#142](https://github.com/heonyun/berry-pi-agent/issues/142)).

## What gets logged automatically (dev)

| Source | Location | Contents |
| --- | --- | --- |
| Browser session log | `localStorage` key `context-matrix-session-log` | shortcut, run_start/end, status, edit_commit, export |
| Run history | `localStorage` key `context-matrix-history` | success, failure, and blocked runs |
| API server | `.orchestrator/context-canvas-dev/api.log` | request method/path/status/duration (no prompt bodies) |

Dev server (`npm run dev`) enables session logging and `CONTEXT_CANVAS_REQUEST_LOG=1` by default.

Disable client logging: set `VITE_CONTEXT_CANVAS_DEBUG_LOG=0` in `.env.local`.

## After reproducing a problem

1. In the Matrix left nav, click **Copy session log** (dev only).
2. In DevTools → Application → Local Storage, copy `context-matrix-history` if needed.
3. From repo root, attach the tail of the API log:

```powershell
Get-Content .orchestrator/context-canvas-dev/api.log -Tail 80
```

4. Note the time range, steps you took, and what you expected vs what happened.

## Minimum issue comment template

```md
## Repro time
2026-07-10 16:23 KST

## Steps
1. Typed in C5, Ctrl+Enter while editor open
2. ...

## Expected
Run applies to C6

## Actual
Status: "Finish cell edit before Ctrl+Enter"

## Session log (last events)
(paste JSON from Copy session log)

## API log tail
(paste api.log tail)
```

## Related

- Drill-down plan: `docs/superpowers/plans/2026-07-10-matrix-session-observability.md`
- Keyboard smoke: `docs/MANUAL_KEYBOARD_SMOKE.md` (if present)
