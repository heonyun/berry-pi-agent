# Orchestrator report format (2×2)

Purpose: reduce user cognitive load. Every orchestrator turn ends with this block **after** any detail the user asked for.

## Matrix

|  | **내 결정 필요** | **처리 완료 (FYI)** |
| --- | --- | --- |
| **막힘 / 리스크** | **Q1 결정** | **Q2 알림** |
| **진행·완료** | **Q3 승인** | **Q4 요약** |

### Quadrant rules

| Quadrant | Max items | Content |
| --- | --- | --- |
| **Q1 결정** | 1–2 | Blocker + one concrete question (yes/no or A/B). Nothing else. |
| **Q2 알림** | 0–2 | Risk you are handling; user does not need to act now. |
| **Q3 승인** | 0–1 | Merge, deploy, scope expansion — needs explicit OK. |
| **Q4 요약** | 3–5 bullets | What changed, verification one-liner, drill-down path. |

### Writing rules

1. **Q4 only** for status the user did not ask about; move depth to worklog / `read-next.md`.
2. If a cell is empty, write `—` (do not omit the row).
3. Links beat prose: PR URL, task id, `file:line`, test name.
4. Korean for user-facing text unless the PR/issue is English-only.

## Example (PR merge round)

|  | **내 결정 필요** | **처리 완료 (FYI)** |
| --- | --- | --- |
| **막힘 / 리스크** | — | DeepSeek false positive on #36 was stale; grounding merged in #37. |
| **진행·완료** | — | **#38** merged (`61a7061b`); `App.test.tsx` 24 passed. Worklog: `doc/working-log/2026-06-21-process-improvements-1-8.md`. |

## Handoff hook

When a harness or PR-loop run exists, add one line under Q4:

`Harness run: .orchestrator/harness-pilot/runs/<id>/read-next.md`

## Anti-patterns

- Long narrative before the matrix
- Multiple questions in Q1
- Repeating Q4 content in Q2
- Raw logs or full disposition tables in chat (link instead)
