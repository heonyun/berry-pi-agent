# Context Canvas — agent comment conventions

Agents: see [AGENTS.md](./AGENTS.md) for when to load this file.

**Canonical (repo-wide):** [doc/orchestrator/agent-code-comments.md](../../doc/orchestrator/agent-code-comments.md)

Read this when editing non-obvious behavior in `apps/context-canvas/`. Follow the canonical doc for rules and tags; examples below are context-canvas specific.

## Examples

```ts
/** ASSUMPTION: MVP single-parent lineage only; multi-parent deferred issue-44. */
/** FIXME: detach threshold is tentative UX — RELATED: issue-45 */
/** DO-NOT: remove event.repeat guard — keyboard repeat would double-delete. */
// INVARIANT: an async reference run must not overwrite a later user edit.
// CONTRACT: only a bare "=" opens reference picking; typed formulas execute elsewhere.
```

## Where other context lives

| Kind | Location |
| --- | --- |
| Work instructions | Obsidian `Projects/berry-pi-agent/tasks/<task>/00-index.md` or `doc/orchestrator/task-record-template/` |
| Worker disposition | Obsidian `tasks/<task>/20-build/worker-ticket-*-disposition.md` — see [worker-tickets.md](../../../doc/orchestrator/worker-tickets.md) |
| Architecture | `doc/working-log/` when needed |
| harness_flow | `doc/orchestrator/harness-flow.md` |
| Tag lint | `pwsh scripts/Test-AgentCommentTags.ps1 -IssueNumber <N>` |
