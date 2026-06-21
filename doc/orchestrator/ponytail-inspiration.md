# Ponytail inspiration (no `pi install` required)

[Ponytail](https://github.com/DietrichGebert/ponytail) is a **minimalism skill** for coding agents (YAGNI ladder, `ponytail-review` for over-engineering). This doc captures **inspiration only** for the berry-pi-agent orchestrator/worker workflow.

## Is this the same Pi as our product?

| | **This repo (`berry-pi-agent`)** | **Ponytail `pi install`** |
| --- | --- | --- |
| What it is | Fork of [earendil-works/pi](https://github.com/earendil-works/pi) — `@earendil-works/pi-coding-agent` CLI + agent runtime in `packages/` | Third-party **skill package** installed into the Pi coding-agent via `pi install git:github.com/DietrichGebert/ponytail` |
| Relationship | Ponytail targets the **same Pi CLI ecosystem** our monorepo builds | Not part of our fork; optional add-on |
| Our app | `context-canvas` depends on `@earendil-works/pi-coding-agent` as a library | Unrelated to Cursor/Qwen orchestrator unless you run `pi` interactively |

**Answer:** Same **Pi product family**, different **layer**. Ponytail is an optional skill; our orchestrator stack is Cursor + Qwen worker + GitHub Actions.

## Is `pi` CLI mandatory for our methodology?

**No.**

| Component | Needs global `pi` CLI? |
| --- | --- |
| Orchestrator (Cursor) | No |
| Qwen worker tickets (`Invoke-QwenWorkerTicket.ps1`) | No |
| Harness pilot (`scripts/harness/*`) | No |
| PR loop / DeepSeek review | No |
| Running Pi coding-agent from source | Optional — `./pi-test.sh` from repo root (no global install) |
| Ponytail via `pi install` | Only if you want the **packaged** skill inside Pi sessions |

Our methodology lives in `AGENTS.md`, `doc/orchestrator/*`, `QWEN.md`, and local scripts — not in Pi package manager.

## Inspiration-only adoption (current)

Applied **without** `pi install`:

1. **Implementation worker** system prompt includes the lite ladder below (`scripts/QwenWorkerCommon.ps1`, local).
2. **Orchestrator** keeps `INVARIANT` / `WHY` / `RELATED` comments and disposition — ponytail does not replace those.
3. **Optional later:** `ponytail-review` pass after Qwen diff-review for delete-list only.

### Lite ladder (worker implementation)

```
1. Does this need to exist? (YAGNI — ticket scope only)
2. Stdlib / platform / existing deps first
3. Shortest diff that meets acceptance criteria
4. Never cut: trust boundaries, data-loss guards, security, a11y, ticket-required tests
5. Intentional shortcut → ponytail: comment with ceiling + upgrade path
```

### Not adopted (yet)

- Root `AGENTS.md` replacement with ponytail always-on rules
- Global Cursor `.cursor/rules/ponytail.mdc`
- `pi install` package (blocked only by convenience — `pi` not on PATH; use `./pi-test.sh -e git:...` to trial)

## Trial without global `pi` (optional)

From repo root after `npm run build`:

```bash
./pi-test.sh -e git:github.com/DietrichGebert/ponytail
```

Project-local install:

```bash
./pi-test.sh install -l git:github.com/DietrichGebert/ponytail
```

Compare a small edit session with/without the extension; harness scorecard optional.

## Related

- Worker checklist: [worker-implementation-checklist.md](./worker-implementation-checklist.md)
- Harness eval case (local): `.orchestrator/harness-pilot/eval-cases/orchestrator-worker-implementation.eval_case.json`
