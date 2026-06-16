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
| `deepseek-issue-assistant` | `hold` or `pass` | Planning only; no code changes |
| `deepseek-pr-review` | `pass`, `hold`, or `fail` | Based on review severity |
| `ci-failure-explain` | `fail` | CI already failed |

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
