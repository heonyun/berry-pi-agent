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

Every **inline review comment** on the PR must appear in the disposition table with an explicit decision before merge. CI green alone is not sufficient.

| Bucket | Action |
| --- | --- |
| `actionable now` | Fix in this PR; cite evidence in commit message |
| `stale / already addressed` | Reply with file:line + test name; no code change |
| `heuristic / outside diff` | Downgrade to residual risk unless diff contradicts |
| `not actionable by code` | Document in PR comment; skip implementation |

## Reporting format (required)

Use a **per-comment disposition table** in the repo worklog and PR triage comment. One row per inline comment and per non-empty review body.

| # | Reviewer | Path | Finding | Decision | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | gemini-code-assist[bot] | `path:line` | … | adopt | `309ca952` + test name |

| Decision | Meaning |
| --- | --- |
| `adopt` | Fixed on head SHA (commit SHA in Evidence) |
| `dismiss` | Invalid against current code (cite file:line) |
| `defer` | Valid; **open GitHub issue** and put `#N` in Evidence — worklog alone is not enough |
| `stale` | Superseded by later commit on head SHA |
| `no_signal` | Reviewer produced no comment (quota error, empty body) |

**Do not** merge or hand off with summary-only prose (“addressed some reviews”, “CI green”). **Do not** use disclaimers that leave reviewer coverage unclear.

Scaffold before triage:

```powershell
pwsh scripts/Get-PrReviewDisposition.ps1 -PrNumber <N> -Markdown -OutputPath .orchestrator/runs/pr-<N>/disposition-scaffold.md
```

## Reporting format (mandatory before merge)

Every reviewer source gets an explicit row. **Do not** merge or hand off with summary-only prose.

### Per-reviewer disposition table

Use this in the repo worklog (`## Review disposition`) and/or PR triage comment:

| Reviewer | Source | Finding | Decision | Evidence |
| --- | --- | --- | --- | --- |
| `gemini-code-assist[bot]` | inline `path:line` | one-line summary | `adopt` \| `dismiss` \| `defer` \| `stale` | commit SHA, `path:line`, or test name |
| `coderabbitai[bot]` | inline / nitpick | … | … | … |
| `github-actions` (DeepSeek) | PR comment P1… | … | … | … |
| `chatgpt-codex-connector` | review skipped | no findings | `no_signal` | usage-limit message URL |

**Decision meanings:** `adopt` = fixed in this PR · `dismiss` = false positive · `defer` = follow-up issue · `stale` = N/A or already on head SHA.

### Merge summary (user-facing)

State only facts in tables or bullets:

1. **Merged:** PR URL, squash SHA, issue closed.
2. **Review disposition:** full table (one row per finding).
3. **Verification:** command + pass/fail.

**Forbidden in handoff text** (invites wrong inference):

- “CI green so merged” without the disposition table.
- “Not all inline comments were reviewed” without naming each reviewer’s outcome.
- “CodeRabbit had no blocking findings” when inline rows are still empty.
- Equating check status with review body (`DeepSeek status pass` ≠ no P1 in body).

### Scaffold command

```powershell
pwsh scripts/Get-PrReviewDisposition.ps1 -PrNumber <N> -Repo heonyun/berry-pi-agent
```

Fill `Decision` and `Evidence` for every row before squash merge.

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

## DeepSeek PR review (automated)

Workflow behavior for `deepseek-pr-review` on berry-pi-agent PRs. Codex reconciles bot output with CI and local verification.

- **Advisory only** — `Conclusion: fail` is not a merge gate.
- **One comment per PR** — workflow upserts the latest bot comment and skips duplicate runs for the same head SHA (use `@deepseek-review` to force re-run).
- **Context injection** — Context Canvas PRs receive domain invariants (for example `MatrixGroup.source` is `"auto"` only) and test-file mock excerpts so reviewers do not confuse test-only UI with production UI.
- **CI-aware triage** — when `build-check-test` passed, unverified test-failure `fail` is downgraded to `hold` with an automated note.
- **CodeRabbit** — treat rate-limit / draft-skip as weak evidence; do not block merge on comment alone.

Per-finding triage steps: see **DeepSeek-specific triage** above and [docs/GITHUB_AGENT_OUTPUT.md](../../docs/GITHUB_AGENT_OUTPUT.md).

## Re-review comment pattern

Required when requesting `@deepseek-review` (see `docs/GITHUB_AGENT_COMMANDS.md`):

- Resolved finding list + commit SHA + `Please re-check: <paths>`

## Output

- PR comment: triage summary + verification commands + head SHA
- Optional: `.orchestrator/runs/pr-<PR>/read-next.md` handoff ([template](./read-next.template.md))
- Worklog entry when merge completes or a round closes

## Merge gate

See `docs/PR_REVIEW_DEPLOY_LOOP.md` — merge only when:

1. **Every inline PR comment** has `adopt` | `dismiss` | `defer` | `stale` | `no_signal` in the worklog disposition table.
2. All `adopt` items are on head SHA.
3. CI green.
4. No unresolved P0/P1 with current-code evidence.
