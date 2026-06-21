# PR review triage (orchestrator)

Tracked mirror of `.orchestrator/templates/pr-review-triage.md`. Edit the template first; copy here when publishing process docs.

Use when an open PR receives automated or human review comments. Codex owns final classification.

## Inputs

- PR number and head SHA
- New review sources since last triage round:
  - inline review comments
  - top-level PR comments (including `deepseek-pr-review`, CodeRabbit)
  - CI check results
- Local verification output (`npm test`, `npm run build`, `npm run typecheck`)

## Classify each finding

| Bucket | Action |
| --- | --- |
| `actionable now` | Fix in this PR; cite evidence in commit message |
| `stale / already addressed` | Reply with file:line + test name; no code change |
| `heuristic / outside diff` | Downgrade to residual risk unless diff contradicts |
| `not actionable by code` | Document in PR comment; skip implementation |

## DeepSeek-specific triage

1. Read **current** diff and **Surrounding file context** before accepting P0/P1.
2. Keyboard handlers: check `event.repeat`, Escape, and helper bodies (`setSingleSelection`, etc.) outside the changed hunk.
3. If PR Test plan claims tests passed and CI is green, do not treat missing-test findings as blockers without diff evidence.
4. Post a short triage comment listing adopted vs rejected findings with one-line evidence each.

## Output

- PR comment: triage summary + verification commands + head SHA
- Optional: `.orchestrator/runs/pr-<PR>/read-next.md` handoff for next agent
- Worklog entry when merge completes or a round closes

## Merge gate

See `docs/PR_REVIEW_DEPLOY_LOOP.md` — all `actionable now` items addressed, CI green, no unresolved P0/P1 with current-code evidence.
