# Repository Conventions

Read this document only when its subject is relevant to the active task.

## Runtime

All repository orchestration scripts require PowerShell 7+ (`pwsh`). New script entrypoints must fail fast on unsupported PowerShell versions.

## Local Verification

For code changes, prefer:

```powershell
npm test
npm run build
npm run typecheck
```

Add `npm run lint` for product-facing behavior, broad refactors, or lint-sensitive files. Follow a task record's phase gate when it specifies narrower or additional evidence.

## Worklogs

- **Obsidian DailyNote** is the primary worklog (`DailyNote/YYYY-MM-DD.md` in vault `heon24`). Follow vault `업무일지 기록 규칙.md`.
- **Public repo policy**: do not commit internal worklogs, handoff notes, raw review artifacts, or harness-evaluation notes to this public repository.
- **Local detail**: keep detailed engineering records in Obsidian or local-only ignored paths such as `doc/working-log/`, `doc/handoff/`, `.orchestrator/`, `qwen-runs/`, and `cursor-runs/`.
- **GitHub-facing summary**: keep only concise PR descriptions, review replies, and verification summaries needed for public collaboration.
- Agents: load `worklog-writer` skill and `AGENTS.md` worklog route before writing either layer, then keep detailed records local unless the user explicitly approves publishing a sanitized document.

## Cross-Platform Path Tests

For Context Canvas markdown bundle paths:

- Do not mock global `path.sep` or replace `path.win32` in integration tests.
- Test normalization helpers directly, such as `normalizeBundleRelativePath()`.
- Use `it.runIf(process.platform === "win32")` for OS-specific filesystem behavior.

## Fork GitHub CLI

This workspace targets `heonyun/berry-pi-agent`, not the default upstream repository (`earendil-works/pi`).

### Fork PR guardrail

- Always use `gh pr create --repo heonyun/berry-pi-agent` — never rely on the default upstream repo.
- Never open PRs against `earendil-works/pi` from this fork workflow.
- `gh pr view`, `gh pr list`, and `gh pr create` should pass `--repo heonyun/berry-pi-agent` unless the user explicitly asks for upstream.
- Set the local default once per clone: `gh repo set-default heonyun/berry-pi-agent` (gh config, not git config).

### Script wrapper

```powershell
pwsh -NoProfile -File scripts/gh-fork.ps1 pr list --state open
```

PR loop scripts must not assume upstream when resolving PR numbers.
