# Harness eval case: feature-shaping-complex

Tracked summary for local `.orchestrator/harness-pilot/eval-cases/feature-shaping-complex.eval_case.json` (workstation).

| Field | Value |
| --- | --- |
| id | `feature-shaping-complex` |
| harness_flow | `plan` |
| task_class | `standard` or `complex` |
| plan_intent | B (FeatureShaping) |
| complexity | L |
| methods | Shape Up Lite, EventStorming Lite, Premortem, Spec Compressor |
| forbidden | implementation-worker during plan phase |

**Sample task**: New canvas node type with sync/export — scope creep risk, multiple state transitions.

**Pass rubric**

- Must / Should / Out of scope explicit
- EventStorming Lite: must/must-not events listed
- Premortem: 3 concrete failures (not generic)
- Spec Compressor output ready for implement

Protocol: [harness-pilot-plan-router-protocol.md](./harness-pilot-plan-router-protocol.md).
