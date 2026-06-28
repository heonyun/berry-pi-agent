---
title: DeepSeek PR review quality evaluation (GitHub Actions)
type: worklog
status: done
project: berry-pi-agent
area: orchestrator
tags: [deepseek, github-actions, pr-review, evaluation]
keywords: [deepseek-pr-review, signal-noise, triage, agent-lib]
summary: "Evaluated DeepSeek PR review bot on merged matrix PRs #54–#58; high signal on real bugs, minor format noise; added pass+findings post-process guard."
date: 2026-06-28
updated: 2026-06-28
author: cursor-agent
canonical_repo: heonyun/berry-pi-agent
---

## TL;DR

DeepSeek `deepseek-pr-review` workflow is **worth keeping**: recent matrix PRs (#54, #56, #58) surfaced real P1/P2 bugs that were adopted before merge. Main gaps are **output-schema drift** (`pass` with numbered findings), **invented rerun commands**, and **verbose summaries** — not systematic false positives. Applied a minimal `agent_post_process_review_comment` guard; larger items deferred as follow-ups (do not block Phase 4b).

## Scope

- Workflow: `.github/workflows/deepseek-pr-review.yml` → `.github/scripts/deepseek-pr-comment.sh` + `agent-lib.sh`
- Evidence: merged PRs #54, #56, #58; `.orchestrator/runs/pr-58/read-next.md`; workflow run logs (token usage)
- Out of scope: Phase 4b implementation, merge actions

## Sample review outcomes

| PR | Runs | First conclusion | Findings | After fix | Verdict |
| --- | --- | --- | --- | --- | --- |
| #54 Phase 2 | 2 | `hold` | 2× P1 (diff): `frontmatter?.trim()`, double patch filter | `pass`, 0 findings | **High signal** — both P1s were real |
| #56 Phase 3 | 2 | `fail` | P1 (diff): frontmatter textarea bound to read-only `domainCell` | `pass`, 0 findings | **High signal** — real UI bug |
| #58 Phase 4a | 2 | `pass` | 4× P2/P3 (diff/heuristic) despite `pass` | `pass`, 0 findings + 4 optional next steps | **Mixed** — findings valid; `pass` label wrong |

PR #58 round-1 fixes adopted 7 items (Gemini + DeepSeek); DeepSeek alone contributed coord validation, `bundleRoot` leak, rollback, and test gaps — all reasonable.

## Assessment

### Signal / noise

| Dimension | Rating | Notes |
| --- | --- | --- |
| Real bug detection | **Strong** | P1 runtime/correctness on #54–#56; security-ish P3 on #58 (`bundleRoot`) |
| False positives (stale/heuristic) | **Low–moderate** | Post–PR #37 grounding helps; heuristic missing-test P2/P3 is noisy but `blocker:no` |
| Re-review hygiene | **Good** | `@deepseek-review` after fixes → `pass` / no repeated stale P1s on head |
| Format compliance | **Moderate** | #58: `pass` + 4 numbered findings violates `docs/GITHUB_AGENT_OUTPUT.md` |
| Command quality | **Weak** | e.g. `npx vitest run --workspace=...` — prefer `npm test --workspace=@berry-pi/context-canvas` |

### Latency and cost (workflow logs, 2026-06-28)

| Metric | Typical range |
| --- | --- |
| Wall time (review job) | 47s – 1m 24s |
| Prompt tokens | ~13k – 20k (mostly cache miss on diff) |
| Completion tokens | ~2k – 5.6k |
| Cache hit | ~1k tokens (stable system prefix only) |

High miss ratio is expected per `docs/GITHUB_AGENT_COMMANDS.md` (unique diff per run). Cost is acceptable for complex PRs; avoid duplicate manual `@deepseek-review` without new commits.

### Workflow / prompt gaps

1. **`pass` + Findings mismatch** — triage must read findings even when conclusion says pass (#58). **Fixed** in `agent_post_process_review_comment` + prompt line.
2. **Conclusion inconsistency** — #54 used `hold` for P1 blockers, #56 used `fail` (both valid for triage; `fail` is clearer).
3. **Surrounding context limits** — 4 files × 25 lines may miss guards outside first hunk (known since PR #37; triage doc covers).
4. **No automated metrics export** — usage logged to Actions only; no repo-local rollup (optional script follow-up).
5. **`cancel-in-progress: false`** — intentional to finish in-flight reviews; acceptable.

## Changes made (this session)

1. **`agent-lib.sh`**: post-process note when `Conclusion: pass` but numbered Findings exist; prompt clarifies empty Findings on `pass`.
2. **This worklog** — evaluation record and follow-up backlog.

## Recommended next steps (non-blocking)

| Priority | Item | Effort |
| --- | --- | --- |
| P2 | Add shell unit tests for `agent_extract_conclusion` / `agent_post_process_review_comment` | Small |
| P2 | Post-process downgrade: if `pass` + only `blocker:no` findings → prepend note linking to triage table | Done (note only) |
| P3 | Script `scripts/Get-DeepSeekReviewMetrics.ps1` to scrape last N workflow runs for token rollup | Small |
| P3 | Enforce re-review comment template from `docs/GITHUB_AGENT_COMMANDS.md` in PR loop checklist | Docs only |
| Defer | Raise `SURROUNDING_CONTEXT_MAX_FILES` for >8-file matrix PRs | Measure on Phase 4b PR |
| Defer | A/B Qwen diff gate vs DeepSeek on same SHA | Harness eval, not production swap |

## Verification

```text
# Reviewed workflow runs (heonyun/berry-pi-agent)
gh run list --workflow deepseek-pr-review.yml --limit 15
gh api repos/heonyun/berry-pi-agent/issues/{54,56,58}/comments  # DeepSeek bodies

# Post-process change: manual smoke (no CI test yet)
# agent_post_process_review_comment with pass + numbered findings → Review note banner
```

## Related files

- `.github/workflows/deepseek-pr-review.yml`
- `.github/scripts/deepseek-pr-comment.sh`
- `.github/scripts/agent-lib.sh`
- `docs/GITHUB_AGENT_OUTPUT.md`
- `doc/orchestrator/pr-review-triage.md`
- `.orchestrator/runs/pr-58/read-next.md`
