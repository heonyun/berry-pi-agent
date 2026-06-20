---
title: Local-only harness cleanup (revert PR #33 remote files)
type: engineering-worklog
status: done
project: pi-agent
area: harness
tags:
  - harness
  - git-exclude
summary: Remove gh-fork.ps1, GhForkCommon.ps1, and PR_REVIEW_DEPLOY_LOOP.md from fork remote; keep on workstation via .git/info/exclude.
date: 2026-06-20
updated: 2026-06-20
author: cursor-agent
canonical_repo: heonyun/berry-pi-agent
---

## TL;DR

PR #33 merged harness helpers onto `berry-pi-agent` remote. That conflicted with `.git/info/exclude` intent (local orchestration only). This change removes those paths from git tracking while keeping copies on disk.

## Removed from remote

| Path | Reason |
| --- | --- |
| `scripts/gh-fork.ps1` | Codex workstation helper; not used by CI |
| `scripts/GhForkCommon.ps1` | Same |
| `docs/PR_REVIEW_DEPLOY_LOOP.md` | Local PR loop runbook |

## Kept on remote

- `.github/scripts/*` — GitHub Actions execution surface
- `docs/GITHUB_AGENT_COMMANDS.md` — bot/handoff (gh-fork section reverted)

## Local usage

```powershell
pwsh -NoProfile -File scripts/gh-fork.ps1 issue list --state open
```

Paths are listed in `.git/info/exclude` (not committed).

## Context

Parent Context Canvas track (#22) is closed. Open follow-ups: #6 (architecture review), #10 (Pi session policy).
