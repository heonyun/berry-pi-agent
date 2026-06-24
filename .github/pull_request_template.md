## Summary

<!-- What changed and why (bullets) -->

## Test plan

- [ ] npm run test --workspace=@berry-pi/context-canvas
- [ ] npm run typecheck --workspace=@berry-pi/context-canvas
- [ ] npm run build --workspace=@berry-pi/context-canvas

## Harness

| Field | Value |
| --- | --- |
| harness_flow | review |
| task_class | standard |
| head_sha | <!-- fill after push --> |
| next_action | <!-- one line for next agent --> |
| drill_down | <!-- e.g. .orchestrator/runs/pr-N/read-next.md --> |

### Session checklist (before merge)

- [ ] Task class matches diff risk (`docs/TASK_CLASSIFIER.md`)
- [ ] `complex` → post-implementation Qwen Diff Review once
- [ ] All actionable review items addressed or triaged
- [ ] CI green

## Risk areas

<!-- User-facing, auth, DB, deploy — or "none" -->

## Not in this PR

<!-- Unrelated work kept out -->
