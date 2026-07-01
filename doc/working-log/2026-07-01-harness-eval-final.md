---
title: "Harness eval pilot — final worklog (2026-07-01)"
type: worklog
status: completed
project:
  - berry-pi-agent
area:
  - harness
  - context-matrix
tags:
  - harness
  - plan-router
  - eval
keywords:
  - harness eval
  - plan-method-router
  - feature-shaping-complex
  - implementation-spec-standard
summary: "Closes harness eval pilot loop: eval case specs tracked in doc/orchestrator, Context Matrix user-action BDD probe drove #71–#75 fixes, E2E baseline 16/16 on main."
date: 2026-07-01
updated: 2026-07-01
author: cursor-agent
canonical_repo: heonyun/berry-pi-agent
---

## TL;DR

Harness eval pilot artifacts are **documented** under `doc/orchestrator/` (plan router protocol + two eval case summaries). Live validation used the **Context Matrix user-action BDD probe** (2026-07-01): baseline E2E green, three issues opened, three product PRs merged (#74–#76). **main** @ `0b6495bf` with **16/16** Playwright tests.

## Eval cases (repo mirrors)

| Case ID | harness_flow | task_class | plan_intent | Doc |
| --- | --- | --- | --- | --- |
| `feature-shaping-complex` | plan | complex | B (FeatureShaping) | [harness-eval-feature-shaping-complex.md](../orchestrator/harness-eval-feature-shaping-complex.md) |
| `implementation-spec-standard` | plan | standard | C (ImplementationSpec) | [harness-eval-implementation-spec-standard.md](../orchestrator/harness-eval-implementation-spec-standard.md) |

Local JSON eval payloads remain on workstation: `.orchestrator/harness-pilot/eval-cases/*.eval_case.json`.

Protocol: [harness-pilot-plan-router-protocol.md](../orchestrator/harness-pilot-plan-router-protocol.md).

## Live probe outcomes (Context Matrix)

| Issue | Type | Probe | Resolution |
| --- | --- | --- | --- |
| [#72](https://github.com/heonyun/berry-pi-agent/issues/72) | bug | layout click interception | PR [#74](https://github.com/heonyun/berry-pi-agent/pull/74) merged |
| [#73](https://github.com/heonyun/berry-pi-agent/issues/73) | enhancement | F2 edit | PR [#75](https://github.com/heonyun/berry-pi-agent/pull/75) merged |
| [#71](https://github.com/heonyun/berry-pi-agent/issues/71) | enhancement | row/column header select | PR [#76](https://github.com/heonyun/berry-pi-agent/pull/76) merged |

Evidence: `doc/working-log/2026-07-01-context-matrix-user-action-probe-handoff.md` (if present locally).

## Pass rubric — pilot verdict

| Criterion | Result |
| --- | --- |
| Plan router docs link eval cases → protocol | **Pass** (repo mirrors committed in docs PR) |
| Implement-phase complex task (Context Matrix) ships with harness block | **Pass** (MVP + follow-up PRs) |
| Review loop (DeepSeek + CI) on product PRs | **Pass** (#74–#76) |
| User-action BDD → tracked issues → E2E regression | **Pass** |
| Worker ticket / Qwen delegation on every sub-step | **Partial** — Qwen diff-review tool-call budget drift on small PRs; orchestrator manual triage |

## Remaining harness work (defer)

- Promote plan-method-router from `promotion-pending` after more recorded pilots.
- Qwen `MaxToolCalls=0` read-only review: document expected tool-call drift vs true failures.
- Optional: file issues for DeepSeek P2 suggestions on #76 (config memoization, assert `addContext` enabled).

## Related Files

- `doc/orchestrator/harness-pilot-plan-router-protocol.md`
- `doc/orchestrator/harness-eval-feature-shaping-complex.md`
- `doc/orchestrator/harness-eval-implementation-spec-standard.md`
- `doc/context-matrix/user-action-bdd-playwright-e2e-plan.md`
- `doc/context-matrix/playwright-real-user-flow-e2e-proposal.md`
