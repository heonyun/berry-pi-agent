---
title: "PR #111 review harness evaluation"
type: worklog
status: completed
project:
  - berry-pi-agent
area:
  - context-canvas
  - workflow-process
tags:
  - worklog
  - pr-loop
  - deepseek
  - qwen
  - cursor
  - github-actions-review
keywords:
  - PR-111
  - issue-96
  - DeepSeek
  - Qwen
  - Cursor-CLI
  - tool-call-drift
  - review-evaluation
summary: "Evaluated PR #111 review signals and recorded harness improvements after merging issue #96."
date: 2026-07-02
updated: 2026-07-02
author: codex
canonical_repo: heonyun/berry-pi-agent
---

# PR #111 review harness evaluation

## TL;DR

- PR #111 merged after local verification, DeepSeek subagent triage, GitHub Actions DeepSeek review, CodeRabbit, and CI.
- Qwen local diff review failed twice with `FatalBudgetExceededError` because the model attempted one tool call under `--max-tool-calls 0`; this should be recorded as `INCONCLUSIVE`, not thrown as an opaque script failure.
- GitHub Actions DeepSeek review produced one useful finding (wire `columnWidths` was not rehydrated on the server) but also one false P1 (`dispatch` mistaken for React `useReducer` dispatch).
- Final GitHub Actions DeepSeek review returned `Conclusion pass`; CodeRabbit and `build-check-test` passed.

## Review Signals

| Signal | Result | Codex disposition |
| --- | --- | --- |
| CodeRabbit initial review | 2 actionable, 3 nitpicks | Adopted exact localStorage assertion, manifest width clamp, malformed storage tests; left empty `columnWidths` omission as intentional optional field behavior |
| Local DeepSeek subagent | Pass, no blockers | Used as fast sidecar triage after proxy restart |
| Qwen local diff review | Failed twice with tool-call budget drift | Treated as harness failure, not code signal; followed user rule and asked Cursor CLI |
| Cursor CLI fallback | Pass, no blockers | Advisory only; Codex had already verified files/tests |
| GitHub Actions DeepSeek after first push | Check success but comment `Conclusion fail` | Triaged manually; P1 false positive, P2 valid, P3 non-blocking |
| GitHub Actions DeepSeek after P2 fix | Pass | Accepted; later non-blocking negative localStorage column suggestion was implemented |
| Final PR checks | `build-check-test`, DeepSeek `review`, CodeRabbit all pass | Merge gate satisfied |

## Adopted Fixes

- `load.ts`: clamp imported manifest widths with `clampMatrixColumnWidth`.
- `matrix-grid-helpers.ts`: parse localStorage and assert exact stored width instead of raw string matching.
- `server/matrix-bundle.ts`: rehydrate wire-format `columnWidths` to numeric `Map` before sidecar projection.
- `matrix-column-widths.ts`: ignore negative localStorage column indexes.
- Tests: added server wire round-trip, export wire serialization, invalid manifest width, malformed storage, and negative localStorage column coverage.
- Comment convention: added `CONTRACT:` / `RELATED:` at the wire Map normalization boundary.

## GitHub Actions Review Evaluation

### Useful

- The DeepSeek GitHub Actions review caught a real integration gap: browser wire transport serialized `columnWidths` as a plain object, but server normalization did not rehydrate it to `Map<number, number>`.
- The follow-up DeepSeek review correctly identified negative localStorage column indexes as non-blocking hardening.

### Noisy

- The first DeepSeek review marked `MatrixCanvas` `dispatch` as P1 by assuming it was React `useReducer` dispatch. In this codebase it is a custom callback returning `applyMatrixCommand` result, so the finding was false.
- One run had check status success while the comment body said `Conclusion fail`, which forced manual interpretation of status vs content.
- CodeRabbit entered rate-limit / long pending states during repeated push cycles, so it should not be the sole final gate.

## Harness Improvement Proposals

1. **Qwen diff review script should downgrade tool-call drift to an artifacted `INCONCLUSIVE`.**
   - Current behavior: `FatalBudgetExceededError` prevents a normal `final.md` result.
   - Desired behavior: write final verdict `INCONCLUSIVE (tool-call drift)`, include raw error, and exit 0 or a distinct non-blocking code that the PR loop can classify.

2. **GitHub Actions review comment schema should align conclusion and check state.**
   - If the comment says `Conclusion fail`, the check should not be plain success unless the workflow explicitly means "review executed successfully".
   - If execution success and review verdict are separate, publish both fields: `execution_status` and `review_verdict`.

3. **Require structured evidence lines in automated review findings.**
   - The workflow already warned that findings lacked explicit `- Evidence:` lines.
   - Make this a prompt/schema requirement so triage can classify `actionable / stale / not-actionable` faster.

4. **Prefer DeepSeek subagent mini-tickets for quick sidecar triage.**
   - They were faster and easier to classify than failed Qwen runs.
   - Keep Cursor CLI as the user-specified fallback after two repeated failures.

5. **Record review-service limits as first-class PR-loop facts.**
   - CodeRabbit rate limits should be recorded as `external pending/rate-limited`, not as a code blocker when CI and another review gate pass.

## Next Actions

1. Patch `scripts/Invoke-QwenDiffReview.ps1` to persist `INCONCLUSIVE` on `FatalBudgetExceededError`.
2. Add a PR-loop summary field for `review_verdict` separate from GitHub Actions execution status.
3. For I05 #97, use DeepSeek subagent mini-ticket first, then GitHub Actions review after push.

## Related Files

- `QWEN.md`
- `doc/orchestrator/subagent-mini-ticket.md`
- `scripts/Invoke-QwenDiffReview.ps1`
- `doc/working-log/2026-07-02-matrix-ux-i04-handoff.md`
- https://github.com/heonyun/berry-pi-agent/pull/111
