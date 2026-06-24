# PR review triage (orchestrator)

Tracked mirror of `.orchestrator/templates/pr-review-triage.md`. Edit the template first; copy here when publishing process docs.

Use when an open PR receives automated or human review comments. Codex owns final classification.

`harness_flow` for triage work is **`review`**. See [harness-flow.md](./harness-flow.md).

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

## Finding disposition table

Record every numbered finding (template: [read-next.template.md](./read-next.template.md)):

| # | Severity | Finding | Decision | Evidence |
| --- | --- | --- | --- | --- |
| 1 | P1 | … | adopt \| dismiss \| defer \| stale | `path:line` or test name |

| Decision | Meaning |
| --- | --- |
| `adopt` | Fix in this PR (maps to actionable now) |
| `dismiss` | Not valid against current code |
| `defer` | Post-MVP or needs separate issue |
| `stale` | Already fixed or never applied to head SHA |

### Round outcome

- `outcome: code_change` — head SHA changes after fixes
- `outcome: no_code_change` — triage only; record head SHA unchanged

## hold (truncated) {#truncated}

When DeepSeek (or other bot) returns `Conclusion: hold (truncated)`:

1. **Default non-blocking** per `docs/GITHUB_AGENT_OUTPUT.md`.
2. No cited diff hunk → **defer** (no code change).
3. Keyboard/guard/heuristic claims → read **Surrounding file context** or full file before adopt/dismiss.
4. End round with disposition table + `outcome: no_code_change` + head SHA when no adopt items.

### Triage decision flow

```
New finding
  → Conclusion hold (truncated)? → default non-blocking; still verify cited hunks
  → Evidence line present? → no: defer or heuristic downgrade
  → Compare to head SHA code → mismatch: stale/dismiss; match: adopt
```

## DeepSeek-specific triage

1. Read **current** diff and **Surrounding file context** before accepting P0/P1.
2. Keyboard handlers: check `event.repeat`, Escape, and helper bodies (`setSingleSelection`, etc.) outside the changed hunk.
3. If PR Test plan claims tests passed and CI is green, do not treat missing-test findings as blockers without diff evidence.
4. Post a short triage comment listing adopted vs rejected findings with one-line evidence each.

## Re-review comment pattern

Required when requesting `@deepseek-review` (see `docs/GITHUB_AGENT_COMMANDS.md`):

- Resolved finding list + commit SHA + `Please re-check: <paths>`

## Output

- PR comment: triage summary + verification commands + head SHA
- Optional: `.orchestrator/runs/pr-<PR>/read-next.md` handoff ([template](./read-next.template.md))
- Worklog entry when merge completes or a round closes

## Merge gate

See `docs/PR_REVIEW_DEPLOY_LOOP.md` — all `actionable now` items addressed, CI green, no unresolved P0/P1 with current-code evidence.
