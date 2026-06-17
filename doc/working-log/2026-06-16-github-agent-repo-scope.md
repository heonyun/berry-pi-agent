---
title: GitHub Agent Repo Scope Clarification
type: engineering-worklog
status: done
project: pi-agent
area: github-actions
tags:
  - github-actions
  - antigravity
  - issue-gate
summary: Root cause of missing DeepSeek review was Antigravity opening an issue on earendil-works/pi; upstream issue-gate auto-close is not DeepSeek.
date: 2026-06-16
updated: 2026-06-16
author: cursor-agent
canonical_repo: heonyun/berry-pi-agent
---

## TL;DR

Antigravity opened **Architecture Review & Proposal: Context-Canvas** on `earendil-works/pi#5800`. Upstream `issue-gate` auto-closed it with a static comment (no LLM). The correct ledger is `heonyun/berry-pi-agent#6`, which already received DeepSeek planning.

## Root cause

| Item | Upstream (wrong) | Fork (correct) |
| --- | --- | --- |
| Issue | [earendil-works/pi#5800](https://github.com/earendil-works/pi/issues/5800) | [heonyun/berry-pi-agent#6](https://github.com/heonyun/berry-pi-agent/issues/6) |
| Bot response | `issue-gate` auto-close template | `deepseek-issue-assistant` planning comment |
| DeepSeek tokens | **No** | **Yes** (intended) |

The upstream comment ("auto-closed… will not be reopened or receive a reply") is **not** a DeepSeek decline. No `<!-- pi-agent:workflow:` marker.

## Actions taken

1. Pushed `ece38325` — GitHub agent hardening (loop guards, output format, CI explain, silent skip, `workflow_dispatch`).
2. Confirmed berry-pi-agent `#5` and `#6` already have planning comments.
3. Documented repository scope in `docs/GITHUB_AGENT_COMMANDS.md`.

## Decisions

- Keep silent skip for ineligible issues (no decline comment, no token waste).
- Antigravity marker bypass remains useful on berry-pi-agent only; it does not fix wrong-repo submissions.
- Delegators must target `heonyun/berry-pi-agent` for agent automation.

## Next actions

- When delegating GitHub chores to Antigravity, include explicit repo `heonyun/berry-pi-agent`.
- Implement context-canvas work from `#5` / `#6` on branch `codex/storage-markdown-projection`.
