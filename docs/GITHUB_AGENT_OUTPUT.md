# GitHub Agent Output Format

All automated agent comments on issues and pull requests use this structure.

## Required sections

```md
## Conclusion
pass | hold | hold (truncated) | fail

## Summary
Short overview of the result.

## Findings
1. [P1][evidence:diff|issue|heuristic][blocker:yes|no] Short title
   - Evidence: `path:line` — "quoted fragment or diff hunk"
   - Why: impact in one sentence
   - Fix: concrete direction

## Suggested next steps
Actionable follow-ups for humans or agents (include non-blocking residual risks here).

## Commands to rerun
`npm test` or other concrete commands, or `none`.
```

### Conclusion semantics

| Value | Meaning | Merge gate |
| --- | --- | --- |
| `pass` | No actionable blocker findings | Non-blocking |
| `hold` | P1+ finding with evidence, or verification gap | Codex triage; may block |
| `hold (truncated)` | Diff coverage incomplete; findings may depend on unseen hunks | **Non-blocking by default** |
| `fail` | P0 or proven correctness/security regression with diff evidence | Codex triage; likely block |

Scripts may prepend an automated **Review note** when output violates these rules (for example `fail` on a truncated diff, or `hold` with zero numbered findings).

### Findings schema

Each actionable finding should include:

- **Severity**: `P0`–`P3`
- **Evidence type**: `diff` (hunk in PR), `issue` (quoted issue text), or `heuristic` (inferred; down-rank)
- **Blocker**: `yes` only for merge-blocking items; `no` for P2/P3 follow-ups
- **Evidence line**: required for `evidence:diff` and `evidence:issue`

Findings with `evidence:heuristic` or missing `- Evidence:` lines are **needs-verification** hints, not merge authority.

## Footer (appended by scripts, not the model)

Scripts append a machine-readable marker and human-readable attribution:

```md
---
<!-- pi-agent:workflow:<WORKFLOW_ID> -->
_Automated note via DeepSeek (<model>) · workflow: <WORKFLOW_ID>_
```

The HTML comment marker is used for loop prevention and workflow identification. Do not trigger workflows on comments that contain `<!-- pi-agent:workflow:`.

## Workflow-specific defaults

| Workflow | Typical Conclusion | Notes |
| --- | --- | --- |
| `deepseek-issue-assistant` | `hold` or `pass` | Pre-implementation review only; no code changes. Prefer `hold` when design choices, prototypes, incorrect assumptions, or verification gaps remain. |
| `deepseek-pr-review` | `pass`, `hold`, `hold (truncated)`, or `fail` | Strict diff review. Use `hold (truncated)` when diff input was cut; never `fail` on unseen hunks. |
| `ci-failure-explain` | `fail` | CI already failed |

## Issue assistant expectations

`deepseek-issue-assistant` should not act as a cheerleader or summary bot.
Its useful output is a pre-implementation review:

- implementation readiness: `Ready now`, `Needs design decision`, `Needs prototype`, or `Too ambiguous`,
- P0/P1/P2/P3 severity for actionable findings (not high/medium/low),
- file/function areas likely affected,
- incorrect assumptions or missing design decisions,
- event-flow, state-management, workflow, or testing risks,
- smallest safe first patch or prototype,
- concrete verification commands only when supported by repository context.

Treat `Conclusion: pass` on issue planning comments as a weak signal. Codex
still owns final implementation and verification decisions.

## PR review expectations

`deepseek-pr-review` should focus on actionable diff findings, not summaries.
Useful PR review output includes:

- severity for each actionable finding (`P0`, `P1`, `P2`, or `P3`),
- affected file and line or hunk when available,
- why the diff creates a bug, regression, security/privacy issue, workflow
  reliability problem, or missing-test risk,
- concrete fix direction,
- clear separation between diff-grounded facts and context that still needs
  verification,
- verification commands only when supported by repository scripts or PR
  context.

When the diff is truncated, the user prompt lists changed files and coverage
limits. Findings must cite hunks present in the Diff section. Unseen paths
belong under Suggested next steps, not as blocker Findings.

Treat generic praise, broad style advice, and unsupported package-manager
commands as low-value output.

## Language

Prefer concise Korean when the issue or PR body is mostly Korean. Otherwise use English.

## How agents should parse comments

1. Skip the footer and `<!-- pi-agent:workflow:... -->` marker when summarizing for handoff.
2. Read automated **Review note** banners first; they downgrade or flag low-evidence output.
3. Map `Conclusion: fail` or `hold` to triage priority; treat `hold (truncated)` as non-blocking unless Codex confirms a cited hunk.
4. Down-rank findings with `evidence:heuristic` or missing `- Evidence:` lines.
5. Copy `Commands to rerun` into local verification steps when present.
6. Do not quote entire bot comments into `.orchestrator/` raw artifacts; summarize Findings and next steps only.

## Related docs

- [GITHUB_AGENT_COMMANDS.md](GITHUB_AGENT_COMMANDS.md) — triggers, mentions, request templates
- [../.github/AGENT_LABELS.md](../.github/AGENT_LABELS.md) — label contract
