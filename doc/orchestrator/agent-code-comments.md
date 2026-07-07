# Agent code comments (canonical)

**Role:** repo-wide tagged comment conventions for orchestrator, workers, and implementers. Applies to `apps/`, `scripts/`, `outputs/` (berry-owned). Excludes upstream `packages/` pi-monorepo unless explicitly in scope.

App-specific examples: [apps/context-canvas/COMMENT_CONVENTIONS.md](../../apps/context-canvas/COMMENT_CONVENTIONS.md).

Lint (M+ implement exit): `pwsh scripts/Test-AgentCommentTags.ps1 -IssueNumber <N>`

## Rules

1. No WHAT comments (do not restate the code).
2. Use tags only where behavior is easy to break.
3. `TODO:` must include task id (`T-xxx` or `issue-N`) and removal condition.
4. `FIXME:` must include `RELATED:` or `issue-N`.
5. Link tests and issues with `RELATED:`.
6. Update comments when behavior changes (stale comments are active bugs).
7. Prefer 0–2 tags per file; use tests when possible.

## Tags

| Tag | Use |
| --- | --- |
| `WHY:` | Non-obvious design reason |
| `INVARIANT:` | Must not break |
| `CONTRACT:` | Input/output/call rules |
| `RISK:` | Dangerous to change |
| `TODO:` | Remaining work (task id + exit condition) |
| `FIXME:` | Known defect or temporary workaround (`RELATED:` required) |
| `ASSUMPTION:` | Current MVP/defer assumption |
| `DO-NOT:` | Do not refactor/remove (behavior ban + reason) |
| `RELATED:` | Issue / PR / test file + test name |

## When to use which tag

| Situation | Recommended tag |
| --- | --- |
| Framework API workaround or overlay | `WHY:` + `CONTRACT:` |
| Keyboard / IME / event guard | `DO-NOT:` or `INVARIANT:` |
| Silent skip / no-throw | `INVARIANT:` |
| MVP assumption, remove later | `ASSUMPTION:` + `RELATED: issue-N` |
| Known bug, temporary | `FIXME:` + `RELATED:` |
| Remaining work | `TODO: issue-N — removal when …` |
| Regression test link | `RELATED: path + describe/it name` |

## Syntax (equivalent meaning)

| Style | Example |
| --- | --- |
| Line comment (TS/PS) | `// INVARIANT: async run must not overwrite later edits.` |
| Block (TS) | `/** WHY: Glide has no onRowResizeEnd. */` |
| PowerShell | `# CONTRACT: only runs when -PostComment is set.` |

## Anti-patterns

- Tag spam (more than ~2 tags per file without strong reason)
- Both `DO-NOT:` and `INVARIANT:` for the same constraint — pick one
- WHAT comments that restate the next line
- `TODO:` / `FIXME:` without issue linkage

## Worker boilerplate

Paste from [templates/worker-comment-tags.md](./templates/worker-comment-tags.md) into implementation worker tickets.

## Related

- [worker-implementation-checklist.md](./worker-implementation-checklist.md)
- [harness-flow.md](./harness-flow.md) § implement exit
- `scripts/Test-AgentCommentTags.ps1`
