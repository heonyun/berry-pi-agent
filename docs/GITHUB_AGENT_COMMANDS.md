# GitHub Agent Commands

Triggers for automated GitHub workflows in **berry-pi-agent only** (`heonyun/berry-pi-agent`).

## Repository scope (important)

| Repository | Agent workflows | What happens on new issues |
| --- | --- | --- |
| `heonyun/berry-pi-agent` | `deepseek-issue-assistant`, `deepseek-pr-review`, `ci-failure-explain` | Trusted author → DeepSeek planning comment; `@deepseek` follow-ups |
| `earendil-works/pi` (upstream) | **None** for pi-agent | `issue-gate` may **auto-close** with a static template (no DeepSeek, no LLM cost) |

Antigravity, Codex, and other delegators must open pi-agent issues/PRs on **`heonyun/berry-pi-agent`**, not upstream. If an issue lands on the wrong repo, copy or recreate it on berry-pi-agent (example: upstream `#5800` → berry-pi-agent `#6`).

Do not interpret upstream auto-close text as a DeepSeek refusal. It is maintainer gate policy, not an AI review result.

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
| Issue opened/reopened (trusted author or Antigravity marker) | `deepseek-issue-assistant` | Post pre-implementation review comment |
| `/deepseek ...` on issue comment | `deepseek-issue-assistant` | Follow-up pre-implementation review reply without mentioning an external account |
| `@deepseek ...` or `@github-actions ...` on issue comment | `deepseek-issue-assistant` | Backward-compatible follow-up trigger |
| Manual `workflow_dispatch` with issue number | `deepseek-issue-assistant` | Pre-implementation review comment on demand |
| PR opened/reopened/synchronize (same-repo) | `deepseek-pr-review` | Post strict diff review comment |
| `@deepseek-review ...` on PR comment | `deepseek-pr-review` | Strict diff review with extra context |
| CI Verify failure on PR | `ci-failure-explain` | Post failure analysis comment |
| `lgtm` / `lgtmi` on issue comment (maintainer) | `approve-contributor` | Update contributor approval |

## Trust rules

- Issue/PR comment triggers require `author_association` of `OWNER`, `MEMBER`, or `COLLABORATOR`.
- Prefer `/deepseek ...` for issue follow-ups. It avoids notifying or linking an unrelated GitHub account.
- `@github-actions ...` is a repository-local alias for the DeepSeek issue assistant. GitHub Actions itself is not a conversational bot; replies are still posted by `github-actions[bot]`.
- Automatic issue planning also runs when the issue body contains `<!-- pi-agent:created-by:antigravity -->` (Antigravity-delegated issues, including bot-opened issues).
- Ineligible issues are skipped **silently** (no DeepSeek call, no decline comment).
- PR review and CI explain run only for same-repository PR heads (not fork PRs).
- Bot comments and comments containing `<!-- pi-agent:workflow:` are ignored to prevent loops.

## Output format

See [GITHUB_AGENT_OUTPUT.md](GITHUB_AGENT_OUTPUT.md).

For issue comments, expect the bot to challenge readiness rather than approve
the idea. Useful output should call out missing design decisions, likely
file/function areas, implementation risks, and verification gaps. A shallow
summary or generic `pass` is not sufficient implementation guidance.

For PR comments, expect the bot to review the diff rather than summarize the
PR. Useful output should include severity, affected file/line or hunk, concrete
fix direction, and verification commands grounded in repository scripts. Generic
praise, broad style notes, or invented package-manager commands are low-value.

## Request templates (improve bot output)

Structured mentions help the bot cite files, scope work, and avoid truncation noise.

### New issue body (Harness block — matches `.github/ISSUE_TEMPLATE/agent-task.yml`)

```md
## Goal
One sentence outcome.

## Affected
- apps/context-canvas/src/server/index.ts

## Harness
| Field | Value |
| --- | --- |
| harness_flow | plan |
| task_class | standard |
| next_action | Open PR with skeleton |
| drill_down | doc/working-log/YYYY-MM-DD-topic.md |

## Repro / expected vs actual
(steps or symptoms)

## Out of scope
(unrelated areas)

## Verification
- [ ] npm run test --workspace=@berry-pi/context-canvas
```

Trusted authors and Antigravity-marked issues receive automatic planning review on open.

### Issue follow-up (`/deepseek` preferred)

```md
/deepseek
- Goal: smallest safe fix for provider error surfacing
- Affected: apps/context-canvas/src/web/App.tsx
- Already tried: setAnswerText in catch block (PR #30)
- Review focus: tests | workflow | correctness
- Out of scope: GitHub agent scripts
```

`/deepseek` avoids notifying unrelated accounts. `@deepseek` and `@github-actions` remain supported aliases.

### PR description (Harness block — matches `.github/pull_request_template.md`)

```md
## Summary
(bullets)

## Test plan
- [x] npm run test --workspace=@berry-pi/context-canvas (76 passed)

## Harness
| Field | Value |
| --- | --- |
| harness_flow | review |
| task_class | standard |
| head_sha | abc1234 |
| next_action | Merge after CI green |
| drill_down | .orchestrator/runs/pr-N/read-next.md |

## Risk areas
- SSE error path when stopReason=error

## Not in this PR
- docs-only harness changes (separate PR)
```

### PR re-review request (required pattern)

```md
@deepseek-review
Addressed in <commit-sha>:
- P1 async assertion → findByText / waitFor
Still open: none
Please re-check: apps/context-canvas/src/web/App.test.tsx only
```

Include commit SHA and resolved finding list so stale comments are not repeated.

## Labels

See [../.github/AGENT_LABELS.md](../.github/AGENT_LABELS.md).

## DeepSeek context caching

DeepSeek [context caching](https://api-docs.deepseek.com/guides/kv_cache) is automatic. No workflow or API flag is required. Billing uses `prompt_cache_hit_tokens` (cheaper) and `prompt_cache_miss_tokens` (full input rate) in each `chat/completions` response.

### What to expect

| Pattern | Typical cache behavior |
| --- | --- |
| First call for a workflow type | **All miss** — prefix is not persisted yet |
| Later issue/PR/CI calls of the **same workflow** | **Partial hit** on the stable `system` prompt (~700 tokens) |
| Each unique issue body or PR diff | **Miss** — variable user content diverges early in the prefix |
| PR `synchronize` with changed diff | Most input tokens miss again |
| Low traffic (hours between runs) | Cache may expire before reuse |

For GitHub Actions review bots, **high miss ratio is normal**. Most tokens are unique issue/PR/diff content. The goal of prompt layout is to keep review instructions in the stable `system` message so repeat runs within the same workflow can reuse that prefix.

### Prompt layout (berry-pi-agent)

Scripts in `.github/scripts/` build messages as:

- `system`: persona + review instructions + output section template (stable per workflow)
- `user`: repository metadata, issue/PR body, diff, or CI logs (variable)

Do not put timestamps, run IDs, or other volatile values in `system`. Those belong in `user` only.

### Observability

After each DeepSeek call, workflows log a line like:

```text
DeepSeek usage: cache_hit=704 cache_miss=4120 prompt=4824 completion=260
```

Check this in the GitHub Actions step log when validating cache behavior. The DeepSeek usage dashboard aggregates the same `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` fields.

### Local cache check

Optional manual verification (requires `DEEPSEEK_API_KEY`):

```bash
.github/scripts/test-deepseek-cache.sh
```

This sends two identical minimal requests and expects `cache_hit > 0` on the second response.
