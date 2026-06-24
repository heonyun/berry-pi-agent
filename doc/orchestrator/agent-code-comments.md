# Agent code comments

Summary of orchestrator comment conventions. Canonical copy: `apps/context-canvas/COMMENT_CONVENTIONS.md`.

## Rules

1. No WHAT comments.
2. Use tags only where behavior is easy to break.
3. `TODO:` must include task id (`T-xxx` or `issue-N`) and removal condition.
4. Link tests and issues with `RELATED:`.
5. Update comments when behavior changes.

## Tags

| Tag | Use |
| --- | --- |
| `WHY:` | Non-obvious design reason |
| `INVARIANT:` | Must not break |
| `CONTRACT:` | Input/output/call rules |
| `RISK:` | Dangerous to change |
| `FIXME:` | Known defect or temporary workaround (`RELATED:` required) |
| `ASSUMPTION:` | Current MVP/defer assumption |
| `DO-NOT:` | Do not refactor/remove (behavior ban + reason) |
| `TODO:` | Remaining work (task id + exit condition) |
| `RELATED:` | Issue / PR / test file + test name |

## Anti-patterns

- Tag spam (prefer 0–2 per file; use tests when possible)
- Both `DO-NOT:` and `INVARIANT:` for the same fact — pick one
- WHAT comments that restate the code
