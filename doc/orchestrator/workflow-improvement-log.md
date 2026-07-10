# Workflow improvement log

Candidate-only record. Do not promote to `AGENTS.md` until repeated evidence or an eval case proves usefulness.

## How to use

1. Add a row with `status: candidate_only`.
2. Link incident worklog or PR.
3. Add eval case when reproducible (`harness-eval-cases.md`).
4. Promote to docs/scripts only after 2+ incidents or one high-cost miss.

## Candidates

| id | date | status | symptom | proposed fix | evidence |
| --- | --- | --- | --- | --- | --- |
| harness-pilot-repo-scout-forbidden | 2026-06-24 | eval_added | `Invoke-HarnessPilotRun` blocked `repo-scout` | Default `ForbiddenModes` = `implementation-worker` only | 2026-06-24-pilot-standard-scout helped |
| harness-flow-global-candidate | 2026-06-24 | candidate_only | Pilot batch 3/3 helped | Promote `harness_flow` breadcrumbs after one real PR round | harness-pilot-recorded-2026-06-24.md |
| matrix-comment-conventions-gate | 2026-06-28 | promoted | Matrix implement missed tagged comments on fragile hunks | Worker checklist §2a: read `COMMENT_CONVENTIONS.md`; tag non-obvious hunks only | worker-implementation-checklist.md §2a |
| deepseek-pr-review-quality | 2026-07-04 | promoted | False positives, comment spam, fail vs CI mismatch | Domain invariants + test harness context + CI downgrade + upsert/skip duplicate head | pr-review-triage.md § DeepSeek PR review |
| pr-inline-disposition-required | 2026-07-04 | promoted | Merge without per-inline-comment disposition; ambiguous handoff | `Get-PrReviewDisposition.ps1` + mandatory worklog table + harness/PR loop merge gate | PR #132, pr-review-triage.md |
| phase-exit-peer-review-pepr | 2026-07-05 | promoted | Codex long-session drift; weak plan/implement handoff | PEPR router + lint + contract gate | doc/orchestrator/phase-peer-review.md |
| issue-agent-prompts | 2026-07-05 | promoted | Agents code before triaging review; improvised peer prompts | Reviewer → peer-review-request template | doc/orchestrator/templates/peer-review-request.md |
| pepr-output-lint | 2026-07-05 | candidate_only | Form-only peer output accepted | Test-PeerReviewOutput hard_fail in PEPR router | scripts/Test-PeerReviewOutput.ps1 |
| issue-process-modes | 2026-07-05 | candidate_only | One-size harness for all issue sizes | XS–XL mapping runbook + Test-ProcessModeGating.ps1 | doc/orchestrator/issue-process-modes.md |
| process-mode-escalation | 2026-07-05 | candidate_only | Repeated implement failures; under-scoped issues | failure>=3 auto + peer recommend_escalate_to | scripts/Invoke-ProcessModeEscalation.ps1 |
| issue-review-reception | 2026-07-05 | candidate_only | BLOCKER findings ignored at implement entry | adopt/dismiss table before implement | doc/orchestrator/templates/issue-review-reception.md |
| phase-index-navigation | 2026-07-05 | candidate_only | Flat orchestrator folder; weak phase signal | plan/implement/review/shared draft indexes | doc/working-log/2026-07-05-orchestrator-phase-index-proposal.md |
| agent-comment-tags-lint | 2026-07-05 | candidate_only | Tag conventions honor-system only; workers skip INVARIANT on fragile hunks | Test-AgentCommentTags M+ hard_fail + worker boilerplate | scripts/Test-AgentCommentTags.ps1 |
| harness-improvement-roadmap-v1 | 2026-07-05 | candidate_only | Solo mature but bypass/routing/signals gaps; agy vs Cursor ordering | Merged ranks 1–4 adopt_now per Codex shrink review | doc/orchestrator/harness-improvement-roadmap.md |
| horizon-control-plane-v0 | 2026-07-07 | candidate_only | Harness docs as context dump; weak git/evaluator trace | Project Pack = Issue mapping; anti-bloat; RejectLog; git log as supplementary memory | doc/working-log/2026-07-07-horizon-harness-integration.md |
| git-agent-memory-doc | 2026-07-07 | candidate_only | Git-as-memory guidance scattered | Tracked one-pager docs/GIT_AGENT_MEMORY.md | docs/GIT_AGENT_MEMORY.md |
| git-memory-enforceability-hold | 2026-07-07 | **deferred** | Git/harness rules honor-system; clone lacks local gates | Ideas only: exit wrapper, signals sync, session wrapper, AGENTS route, evidence lint — see GIT_AGENT_MEMORY § Deferred | docs/GIT_AGENT_MEMORY.md, harness-improvement-roadmap.md |
| codex-cursor-cli-handroll | 2026-07-08 | candidate_only | Codex raw `cursor-agent` + short wait → false incomplete; retry `output.json` had valid result | Mandate `Invoke-CursorDiffReview.ps1` / `Invoke-CursorPlanPeerReview.ps1`; 10m timeout; CURSOR.md § Codex scripts | issue-135 cursor-runs, CURSOR.md |
| advisory-brief-before-tool-review | 2026-07-09 | candidate_only | agy/Cursor reviewed different effective contexts on non-issue questions | Shared `.orchestrator/runs/advisory/.../brief.md`; issue-first for M+ product | 2026-07-09-harness-advisory-friction.md, templates/advisory-brief.md |
| agy-suggest-after-deepseek-hold | 2026-07-09 | promoted | `Test-AgyIssueReviewSuggested` True after DeepSeek hold but agy never run (#140) | Plan PEPR Cursor pre-step runs `Invoke-AgyIssueReview`; Codex chain already starts with agy | Invoke-HarnessPhasePeerReview.ps1, 2026-07-09-agy-cursor-advisory-improvement.md |
| cursor-pepr-output-lint | 2026-07-09 | promoted | `Invoke-CursorPlanPeerReview` writes `success=true` on non-schema `final.md` | `Test-PeerReviewOutputText` before success; fail wrapper on lint fail | Invoke-CursorPlanPeerReview.ps1, Invoke-CodexPeerReview.ps1 |
| failure-advisory-brief-gate | 2026-07-09 | promoted | failure_count>=2 allowed free-form agy/Cursor questions or skipped advisory | Required failure-advisory-brief + Test-FailureAdvisoryBrief; wrappers -BriefPath | templates/failure-advisory-brief.md, Test-FailureAdvisoryBrief.ps1 |
| issue-writer-contract-gate | 2026-07-09 | promoted | New Issue Writer path honor-system; agents skip Agent Task / incomplete Harness | AGENTS plan entry + Test-IssueContractGate required fields (Harness trio, Goal/Problem, Verification; M+/L+) | issue-agent-prompts.md § Writer, PeerReviewSchema Test-IssueContractFromBody |

## Status values

| Status | Meaning |
| --- | --- |
| `candidate_only` | Observed once; not a rule yet |
| `deferred` | Idea recorded; explicit hold — no implementation until user/pilot |
| `eval_added` | Repro case filed |
| `promoted` | Merged into docs or scripts |
| `rejected` | Not worth carrying |
