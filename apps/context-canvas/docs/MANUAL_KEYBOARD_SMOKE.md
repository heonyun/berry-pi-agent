# Manual keyboard smoke — Delete confirm flow

Automated coverage: `src/web/App.test.tsx` (87 tests). Run once after keyboard behavior changes.

## Setup

```powershell
npm run dev --workspace @berry/context-canvas
```

Open the app; ensure focus is on the canvas (not a text field).

## Checklist

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Select a single node | Node highlighted |
| 2 | Press `Delete` once | Delete affordance armed; node **not** deleted |
| 3 | Press `Delete` again (same selection) | Node deleted; selection moves |
| 4 | Select node, arm with `Delete`, press `Escape` | Arm cleared; node remains |
| 5 | After step 4, press `Delete` twice | First arms, second deletes (not instant delete) |
| 6 | Select node A, arm, click node B | Arm cleared (re-select) |
| 7 | Hold `Delete` (key repeat) | No double-fire from repeat events |

## Sign-off

Record date, browser, and result in the PR Test plan or worklog when this checklist is run manually.
