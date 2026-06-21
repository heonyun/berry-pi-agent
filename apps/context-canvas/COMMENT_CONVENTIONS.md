# Context Canvas — agent comment conventions

Read this when editing non-obvious behavior in `apps/context-canvas/`. Full templates live workstation-local under `.orchestrator/templates/agent-code-comments.md`.

## Rules

1. No WHAT comments.
2. Use `WHY:` / `INVARIANT:` / `RISK:` / `CONTRACT:` / `RELATED:` only where behavior is easy to break.
3. `TODO:` must include task id and removal condition.
4. Link regression tests with `RELATED:` (file + test name).
5. Update comments when behavior changes.

## Tags

| Tag | Use |
| --- | --- |
| `WHY:` | Non-obvious design reason |
| `INVARIANT:` | Must not break |
| `CONTRACT:` | Input/output/call rules |
| `RISK:` | Dangerous to change |
| `RELATED:` | Test file or issue/PR |
| `TODO:` | Remaining work (task id + exit condition) |

## Where other context lives

| Kind | Location |
| --- | --- |
| Work instructions | Obsidian `Projects/berry-pi-agent/tasks/<task>/00-index.md` |
| Worker disposition | `.../worker-ticket-*-disposition.md` |
| Architecture | `doc/working-log/` when needed |
