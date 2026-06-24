# Context Canvas — agent comment conventions

Agents: see [AGENTS.md](./AGENTS.md) for when to load this file.

Read this when editing non-obvious behavior in `apps/context-canvas/`. Tracked mirror: `doc/orchestrator/agent-code-comments.md`.

## Rules

1. No WHAT comments.
2. Use `WHY:` / `INVARIANT:` / `RISK:` / `CONTRACT:` / `RELATED:` only where behavior is easy to break.
3. `TODO:` must include task id (`T-xxx` or `issue-N`) and removal condition.
4. Link regression tests with `RELATED:` (file + test name).
5. Update comments when behavior changes (stale comments are active bugs).

## Tags

| Tag | Use |
| --- | --- |
| `WHY:` | Non-obvious design reason |
| `INVARIANT:` | Must not break |
| `CONTRACT:` | Input/output/call rules |
| `RISK:` | Dangerous to change |
| `FIXME:` | Known defect; requires `RELATED: issue-N` or ticket id |
| `ASSUMPTION:` | MVP/defer assumption; delete or promote to `INVARIANT:` when verified |
| `DO-NOT:` | Refactor temptation; action ban + reason (use instead of duplicate `INVARIANT:`) |
| `TODO:` | Remaining work (task id + exit condition) |
| `RELATED:` | Test file + `describe`/`it` name, or issue/PR |

## Examples

```ts
/** ASSUMPTION: MVP single-parent lineage only; multi-parent deferred issue-44. */
/** FIXME: detach threshold is tentative UX — RELATED: issue-45 */
/** DO-NOT: remove event.repeat guard — keyboard repeat would double-delete. */
```

## Anti-patterns

- More than ~2 tags per file when a test would suffice
- `DO-NOT:` and `INVARIANT:` for the same constraint

## Where other context lives

| Kind | Location |
| --- | --- |
| Work instructions | Obsidian `Projects/berry-pi-agent/tasks/<task>/00-index.md` or `doc/orchestrator/task-record-template/` |
| Worker disposition | `.../worker-ticket-*-disposition.md` |
| Architecture | `doc/working-log/` when needed |
| harness_flow | `doc/orchestrator/harness-flow.md` |
