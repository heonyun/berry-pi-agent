# GitHub Agent Labels

Labels applied by automated workflows. GitHub creates missing labels on first use when the workflow has `issues: write`.

| Label | Color (suggested) | Applied by | Removed by |
| --- | --- | --- | --- |
| `agent:planned` | `#0E8A16` | `deepseek-issue-assistant` after a successful planning comment | Manual (v1) |
| `agent:reviewed` | `#1D76DB` | `deepseek-pr-review` after a successful review comment | Re-applied on each new review |
| `ci:failed` | `#D93F0B` | `ci-failure-explain` after a CI failure analysis comment | `ci-failure-explain` cleanup job when CI succeeds |

## Semantics

- `agent:planned` — an automated planning comment was posted on the issue.
- `agent:reviewed` — an automated PR review comment was posted.
- `ci:failed` — the latest CI run for the PR failed and an explanation comment was posted.

Labels are a visibility aid. The source of truth for status remains issue/PR comments, check runs, and merge gates.
