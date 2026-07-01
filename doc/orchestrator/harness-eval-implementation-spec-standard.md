# Harness eval case: implementation-spec-standard

Tracked summary for local `.orchestrator/harness-pilot/eval-cases/implementation-spec-standard.eval_case.json` (workstation).

| Field | Value |
| --- | --- |
| id | `implementation-spec-standard` |
| harness_flow | `plan` |
| task_class | `standard` |
| plan_intent | C (ImplementationSpec) |
| complexity | M |
| methods | BDD/Gherkin, Spec Compressor |
| forbidden | implementation-worker during plan phase |

**Sample task**: Add confirm dialog on Delete key in context-canvas — behavior clear, AC needed.

**Pass rubric**

- Worker ticket ≤80 lines
- Gherkin AC present and testable
- `drill_down` points to compressed spec
- No OST/DD/JTBD raw paste

Protocol: [harness-pilot-plan-router-protocol.md](./harness-pilot-plan-router-protocol.md).
