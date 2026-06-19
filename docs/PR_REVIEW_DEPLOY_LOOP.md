# PR Review Deploy Loop

This runbook handles an existing PR from review response through final merge gate for the heonyun/berry-pi-agent fork of earendil-works/pi. Deployment verification is included as a placeholder gate and must be specialized once the fork has a real deploy target.

## Use Conditions

- A working branch already has an open PR.
- Review comments must be read, classified, and selectively addressed.
- CI is available through GitHub Actions or an equivalent check system.

## Task Class

Before starting the PR loop, classify the work with `docs/TASK_CLASSIFIER.md` as `pr-loop-only` or `complex`. Docs-only PRs can skip heavy Reasonix use.

## PR Scope Before Open

One PR should have one primary goal.

| Split recommended | Include | Exclude |
| --- | --- | --- |
| workflow-docs PR | agent runbooks, task classifier, PR loop docs | product feature diff |
| infra-scripts PR | PR loop scripts, harness utilities | app route or UX changes |
| product-feature PR | `src/*`, `tests/*`, UI/app behavior | raw run artifacts |
| review-response only | fixes for review feedback | unrelated new feature work |

Before opening a product PR, run:

```powershell
npm test
npm run build
npm run typecheck
```

Add `npm run lint` for product-facing behavior, broad refactors, or lint-sensitive files.

## Principles

- Reuse the existing PR for the current branch.
- Use `scripts/gh-fork.ps1` (sets `GH_REPO=heonyun/berry-pi-agent`) for fork issue/PR/check commands; do not rely on the default `gh` repo (`earendil-works/pi`).
- Prefer activity-aware wait tooling over blind sleeps when scripts are available.
- Classify review items as:
  - `actionable now`
  - `stale/already addressed`
  - `not actionable by code`
- Fix only `actionable now` items.
- Reasonix triage is filter + hint. Codex owns final classification.
- Use one commit per review round unless the user asks otherwise.

## Review Loop

1. Confirm the current PR number and branch.
2. Read `.orchestrator/runs/pr-<PR>/read-next.md` first if it exists.
3. Triage review comments with Reasonix or Codex manual classification.
4. Optionally run Qwen Diff Review against the PR head diff. Use Reasonix Diff Review only for fallback, A/B comparison, or Reasonix-specific evaluation.
5. Read new review sources:
   - PR reviews
   - inline review comments
   - top-level PR comments
   - automated workflow comments (`deepseek-pr-review`, `ci-failure-explain`; see `docs/GITHUB_AGENT_OUTPUT.md`)
   - concrete automated review findings
6. Implement only currently actionable fixes.
7. Run local verification:

```powershell
npm test
npm run build
npm run typecheck
npm run lint
```

8. Commit and push the review-response batch.
9. Request re-review with a short PR comment containing:
   - reviewer mention if appropriate,
   - commit SHA,
   - addressed item summary,
   - verification commands and results.
10. Wait for new activity or record timeout.
11. Repeat until the PR reaches the final gate.

## Merge Conditions

Squash merge only when all conditions are true:

1. CI is green.
2. PR loop classification is `READY_FOR_CODEX_FINAL_GATE` or equivalent manual evidence exists.
3. `run-summary.md` shows `evidence_all_done: true` when actionable items existed.
4. No new actionable review remains after activity-aware wait or manual review.
5. `complex` PRs have one post-implementation Diff Review.
6. `goal.md` done-when checklist is satisfied when PR loop artifacts are used.

If the loop reaches `MAX_ROUNDS_REACHED`, do not merge automatically. Codex must narrow scope, escalate, or reclassify manually.

## Deployment Gate

Deployment verification must be customized once the hosting target is known.

Minimum default after merge:

1. Record merge commit SHA.
2. Confirm main-branch CI is green for that SHA.
3. Confirm deploy workflow exists or explicitly record that deployment is not configured.
4. If deploy exists, verify release packaging, upload, service start, and a basic health check.

## Smoke Test

For user-facing changes, run the most direct smoke test available. If an authenticated browser session, seed data, or external service is unavailable, record why the smoke test was not run and what evidence substitutes for it.

