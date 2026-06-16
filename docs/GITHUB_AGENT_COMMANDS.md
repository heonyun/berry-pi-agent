# GitHub Agent Commands

Triggers for automated GitHub workflows in berry-pi-agent.

## For agents (handoff)

| Layer | Role |
| --- | --- |
| **GitHub Issue/PR** | Public collaboration ledger for humans and Codex |
| **Actions bots** | Low-cost plan/review/CI-explain comments only; no code commits |
| **`.orchestrator/`** | Local raw handoff; not pushed by default |
| **Codex** | Parses bot output, implements fixes, commits, merge |

When reading bot comments, use the five sections in `GITHUB_AGENT_OUTPUT.md`. Treat `Conclusion` and `Findings` as hints. Prefer `Commands to rerun` for local verification. Ignore comments with `<!-- pi-agent:workflow:` when deciding whether to post a new mention — those are bot output, not user requests.

Labels (`agent:planned`, `agent:reviewed`, `ci:failed`) are visibility hints. See `.github/AGENT_LABELS.md`.

Reasonix, Qwen, and Cursor workers must not post `@deepseek*` mentions or run `gh` mutations. Codex owns GitHub side effects.

## Triggers

| Trigger | Workflow | Action |
| --- | --- | --- |
| Issue opened/reopened (trusted author or Antigravity marker) | `deepseek-issue-assistant` | Post planning comment |
| `@deepseek ...` on issue comment | `deepseek-issue-assistant` | Follow-up planning reply |
| Manual `workflow_dispatch` with issue number | `deepseek-issue-assistant` | Planning comment on demand |
| PR opened/reopened/synchronize (same-repo) | `deepseek-pr-review` | Post review comment |
| `@deepseek-review ...` on PR comment | `deepseek-pr-review` | Review with extra context |
| CI Verify failure on PR | `ci-failure-explain` | Post failure analysis comment |
| `lgtm` / `lgtmi` on issue comment (maintainer) | `approve-contributor` | Update contributor approval |

## Trust rules

- Issue/PR comment triggers require `author_association` of `OWNER`, `MEMBER`, or `COLLABORATOR`.
- Automatic issue planning also runs when the issue body contains `<!-- pi-agent:created-by:antigravity -->` (Antigravity-delegated issues, including bot-opened issues).
- Ineligible issues are skipped **silently** (no DeepSeek call, no decline comment).
- PR review and CI explain run only for same-repository PR heads (not fork PRs).
- Bot comments and comments containing `<!-- pi-agent:workflow:` are ignored to prevent loops.

## Output format

See [GITHUB_AGENT_OUTPUT.md](GITHUB_AGENT_OUTPUT.md).

## Labels

See [../.github/AGENT_LABELS.md](../.github/AGENT_LABELS.md).
