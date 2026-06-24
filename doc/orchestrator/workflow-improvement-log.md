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

## Status values

| Status | Meaning |
| --- | --- |
| `candidate_only` | Observed once; not a rule yet |
| `eval_added` | Repro case filed |
| `promoted` | Merged into docs or scripts |
| `rejected` | Not worth carrying |
