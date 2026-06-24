# read-next.md template

Copy to `.orchestrator/runs/pr-<PR>/read-next.md` (local). Tracked mirror for handoff shape.

## Breadcrumbs

```yaml
harness_flow: review
task_class: pr-loop-only
head_sha: <commit-sha>
next_action: <one line — e.g. merge after CI green>
drill_down: doc/orchestrator/pr-review-triage.md
```

## PR

| Field | Value |
| --- | --- |
| PR | #<N> |
| Branch | `<branch>` |
| Round | `<N>` |

## Triage summary

| # | Severity | Finding | Decision | Evidence |
| --- | --- | --- | --- | --- |
| 1 | P1 | … | dismiss / defer / adopt / stale | `path:line` or test name |

Decision enum: `adopt` | `dismiss` | `defer` | `stale`

### Round outcome

- `outcome`: `code_change` | `no_code_change`
- `head_sha`: `<sha>` (unchanged if no_code_change)

## Verification

```text
npm run test --workspace=@berry-pi/context-canvas
```

## Read order

1. This file
2. `run-summary.md`
3. `round-<N>/github-brief.md`
4. Raw artifacts only when `drill_if_needed` or blocker requires

## Open blockers

- None | list
