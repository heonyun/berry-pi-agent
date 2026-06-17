# GitHub Agent Output Format

All automated agent comments on issues and pull requests use this structure.

## Required sections

```md
## Conclusion
pass | hold | fail

## Summary
Short overview of the result.

## Findings
1. First finding
2. Second finding

## Suggested next steps
Actionable follow-ups for humans or agents.

## Commands to rerun
`npm test` or other concrete commands, or `none`.
```

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
| `deepseek-pr-review` | `pass`, `hold`, or `fail` | Strict diff review. Prefer file/line findings with severity; `pass` only when no actionable findings remain. |
| `ci-failure-explain` | `fail` | CI already failed |

## Issue assistant expectations

`deepseek-issue-assistant` should not act as a cheerleader or summary bot.
Its useful output is a pre-implementation review:

- implementation readiness: `Ready now`, `Needs design decision`, `Needs prototype`, or `Too ambiguous`,
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

Treat generic praise, broad style advice, and unsupported package-manager
commands as low-value output.

## Language

Prefer concise Korean when the issue or PR body is mostly Korean. Otherwise use English.

## How agents should parse comments

1. Skip the footer and `<!-- pi-agent:workflow:... -->` marker when summarizing for handoff.
2. Map `Conclusion: fail` or `hold` to triage priority; do not treat as merge authority.
3. Copy `Commands to rerun` into local verification steps when present.
4. Do not quote entire bot comments into `.orchestrator/` raw artifacts; summarize Findings and next steps only.

## Related docs

- [GITHUB_AGENT_COMMANDS.md](GITHUB_AGENT_COMMANDS.md) — triggers and mentions
- [../.github/AGENT_LABELS.md](../.github/AGENT_LABELS.md) — label contract
