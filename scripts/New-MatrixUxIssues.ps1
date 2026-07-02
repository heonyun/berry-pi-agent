# Create Matrix UX GitHub issues (I01-I14) on heonyun/berry-pi-agent
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Repo = "heonyun/berry-pi-agent"

function New-MatrixIssue {
    param(
        [string]$Title,
        [string]$Body,
        [string[]]$Labels = @("agent:planned", "enhancement")
    )
    $labelArgs = $Labels | ForEach-Object { "--label"; $_ }
    $url = gh issue create --repo $Repo --title $Title --body $Body @labelArgs
    if ($url -match '/issues/(\d+)') {
        return [int]$Matches[1]
    }
    throw "Failed to parse issue number from: $url"
}

$issues = @(
    @{
        Id = "I01"
        Title = "Matrix: fix Korean IME first character as English in cell edit"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/web/ImeTextarea.tsx"
            "apps/context-canvas/src/web/MatrixDetailPane.tsx"
        )
        Goal = "Fix Korean IME so the first composed character is not seeded as a Latin key (e.g. gㅜ후, dㅗ디) when editing matrix cells."
        Depends = ""
        OutOfScope = "Full Windows IME e2e; group label inputs; composer prompt."
        AC = @(
            "editOnType or provideEditor does not seed Latin char before compositionstart"
            "Matrix detail pane textarea uses ImeTextarea or equivalent guard"
            "At least one unit or e2e regression for cell edit path"
        )
        Repro = "Windows Korean keyboard: type in matrix cell via edit-on-type; first char may appear as English physical key."
    }
    @{
        Id = "I02"
        Title = "Matrix: investigate Ctrl+Enter shortcut not producing AI response"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixCanvas.tsx"
            "apps/context-canvas/src/web/MatrixComposer.tsx"
            "apps/context-canvas/src/web/run-matrix.ts"
        )
        Goal = "Reproduce and fix user-reported case where Ctrl+Enter does not run AI despite visible selection and prompt."
        Depends = ""
        OutOfScope = "Ctrl+Shift+Tab new binding; reversing #78 shortcut directions."
        AC = @(
            "Document preconditions: composer prompt required, not editing .gdg-input"
            "Fix confirmed repro or document expected behavior in status message"
            "Playwright or manual repro steps recorded in issue/PR"
        )
        Repro = "User manual test: shortcut did not produce AI answer."
    }
    @{
        Id = "I03"
        Title = "Matrix: rename group labels on double-click"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/web/MatrixCanvas.tsx"
            "apps/context-canvas/e2e/matrix-grid.spec.ts"
        )
        Goal = "Rename group labels on double-click; single-click selects/drags only (align with column header pattern)."
        Depends = ""
        OutOfScope = "Label drag offset (separate issue)."
        AC = @(
            "Single click on group label does not open inline editor"
            "Double-click opens inline rename"
            "E2E updated from single-click rename spec"
        )
        Repro = ""
    }
    @{
        Id = "I04"
        Title = "Matrix: drag-resize column widths"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/shared/domain.ts"
            "apps/context-canvas/src/storage/matrix/"
        )
        Goal = "Allow drag-resizing column widths in the matrix grid with persistence across reload."
        Depends = ""
        OutOfScope = "Row height (I05); auto-fit; wrap text."
        AC = @(
            "Header boundary drag changes column width"
            "Widths persist in matrix sidecar/document"
            "Unit or e2e covers resize + reload"
        )
        Repro = "Column width hardcoded to 120px; no onColumnResize wired."
    }
    @{
        Id = "I05"
        Title = "Matrix: drag-resize row heights"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/shared/domain.ts"
            "apps/context-canvas/src/storage/matrix/"
        )
        Goal = "Allow drag-resizing row heights with persistence."
        Depends = "Depends on column resize issue (I04) for shared Sheet layout model."
        OutOfScope = "Auto-fit row height from content."
        AC = @(
            "Row boundary drag changes height with minimum height"
            "Heights persist across reload"
            "Regression test for resize path"
        )
        Repro = ""
    }
    @{
        Id = "I06"
        Title = "Matrix: group boundaries with corner-dot affordances"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/web/styles.css"
        )
        Goal = "Show auto-detected groups with corner-dot boundary affordances (mockup: pill label + softer group outline)."
        Depends = ""
        OutOfScope = "Full grid corner-dot layout (I07)."
        AC = @(
            "Each visible group shows corner dots at bbox corners"
            "Existing pill label and Groups nav unchanged"
            "No regression to selection or label edit"
        )
        Repro = ""
    }
    @{
        Id = "I07"
        Title = "Matrix: corner-dot cell grid instead of rigid lines"
        TaskClass = "complex"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/adapters/matrix-glide.ts"
            "apps/context-canvas/src/web/styles.css"
            "apps/context-canvas/e2e/matrix-grid.spec.ts"
        )
        Goal = "Replace rigid Excel-like grid lines with corner-dot cell UI."
        Depends = ""
        OutOfScope = "Group label drag; formula engine."
        AC = @(
            "Grid lines minimized; corner dots visible per cell"
            "Selection, edit, clipboard e2e still pass"
            "Visual matches design direction in user mockup"
        )
        Repro = ""
    }
    @{
        Id = "I08"
        Title = "Matrix: draggable group label position (offset persist)"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/shared/domain.ts"
            "apps/context-canvas/src/core/matrix-reducer.ts"
        )
        Goal = "Drag group label pill to adjust display offset; persist on document."
        Depends = ""
        OutOfScope = "Stable group ID / named references (I09)."
        AC = @(
            "Label drag updates stored labelOffset"
            "Offset survives reload"
            "Single-click does not start rename (pairs with I03)"
        )
        Repro = ""
    }
    @{
        Id = "I09"
        Title = "Matrix: stable group IDs and label-based lookup"
        TaskClass = "complex"
        Affected = @(
            "apps/context-canvas/src/shared/domain.ts"
            "apps/context-canvas/src/shared/matrix-groups.ts"
            "apps/context-canvas/src/core/matrix-reducer.ts"
            "apps/context-canvas/src/storage/matrix/"
        )
        Goal = "Replace range-derived group IDs with stable IDs; resolve groups by label name when bbox changes."
        Depends = "Depends on I08 (label drag) for consistent label UX."
        OutOfScope = "Cell = formula (I11)."
        AC = @(
            "Group keeps stable id when cells grow/shrink within same semantic group"
            "Label rename updates lookup key with collision guard"
            "Projection/sidecar stores stable ids"
        )
        Repro = ""
    }
    @{
        Id = "I10"
        Title = "Matrix: context chips resolve groups by label name"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixCanvas.tsx"
            "apps/context-canvas/src/shared/compile-matrix-range-context.ts"
        )
        Goal = "+ Context and compile path resolve latest group range by label name."
        Depends = "Depends on I09 stable group IDs and label lookup."
        OutOfScope = "Cell = reference UI."
        AC = @(
            "Context chip added from group uses label-resolved range"
            "compileMatrixRangeContext includes group metadata on label match"
            "Unit tests for range drift after cell edit"
        )
        Repro = ""
    }
    @{
        Id = "I11"
        Title = 'Matrix: cell "=" reference edit mode (range pick + label insert)'
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/web/MatrixCanvas.tsx"
        )
        Goal = 'Typing "=" in a cell enters reference edit mode: type range, mouse-select range, or click group label to insert reference.'
        Depends = "Depends on I09 for =GroupLabel references."
        OutOfScope = "AI execution (I12)."
        AC = @(
            "= prefix detected on cell edit"
            "Mouse range pick inserts A1:B2 style reference"
            "Group label click inserts label reference token"
        )
        Repro = ""
    }
    @{
        Id = "I12"
        Title = 'Matrix: cell "=" triggers AI and writes answer in same cell'
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixGrid.tsx"
            "apps/context-canvas/src/web/MatrixCanvas.tsx"
            "apps/context-canvas/src/web/run-matrix.ts"
        )
        Goal = "On commit, = reference triggers /api/matrix-run and writes AI answer into the same cell."
        Depends = "Depends on I11 reference edit mode."
        OutOfScope = "General spreadsheet formula engine."
        AC = @(
            "Enter/blur on =cell runs matrix AI with referenced range as context"
            "Result body written to same cell"
            "Loading and error states visible"
        )
        Repro = ""
    }
    @{
        Id = "I13"
        Title = "Matrix: save document snapshot on each AI run"
        TaskClass = "complex"
        Affected = @(
            "apps/context-canvas/src/shared/domain.ts"
            "apps/context-canvas/src/core/matrix-reducer.ts"
            "apps/context-canvas/src/storage/matrix/history.ts"
        )
        Goal = "Persist full document snapshot (cells, groups) on each matrix AI run in history entry."
        Depends = ""
        OutOfScope = "Restore UI (I14)."
        AC = @(
            "Each run stores snapshot metadata with size limit documented"
            "Snapshot includes cells map and groups"
            "Unit test for snapshot round-trip serialize"
        )
        Repro = ""
    }
    @{
        Id = "I14"
        Title = "Matrix: restore full snapshot when history entry is selected"
        TaskClass = "standard"
        Affected = @(
            "apps/context-canvas/src/web/MatrixCanvas.tsx"
            "apps/context-canvas/src/web/MatrixHistoryNav.tsx"
            "apps/context-canvas/e2e/real-user-flow.spec.ts"
        )
        Goal = "Clicking history entry restores grid document to that snapshot; provide exit-restore UX."
        Depends = "Depends on I13 snapshot storage."
        OutOfScope = "Auto-run from history."
        AC = @(
            "History click restores cells and groups"
            "Selection/scroll moves to target/context ranges when present"
            "Return to current document affordance exists"
        )
        Repro = "Today: history opens read-only detail pane only."
    }
)

$created = @{}
foreach ($item in $issues) {
    $affected = ($item.Affected | ForEach-Object { "- $_" }) -join "`n"
    $ac = ($item.AC | ForEach-Object { "- [ ] $_" }) -join "`n"
    $verify = @(
        "- [ ] npm run test --workspace=@berry-pi/context-canvas"
        "- [ ] npm run typecheck --workspace=@berry-pi/context-canvas"
    ) -join "`n"
    $repro = if ($item.Repro) { "## Repro / expected vs actual`n$($item.Repro)" } else { "" }
    $depends = if ($item.Depends) { "## Dependencies`n$($item.Depends)" } else { "" }

    $body = @"
## Goal
$($item.Goal)

## Affected
$affected

## Harness
| Field | Value |
| --- | --- |
| harness_flow | plan |
| task_class | $($item.TaskClass) |
| next_action | Implement in focused PR with tests |
| drill_down | doc/working-log/2026-07-02-matrix-ux-issue-triage.md |

$repro

$depends

## Out of scope
$($item.OutOfScope)

## Acceptance criteria
$ac

## Verification
$verify
"@

    $num = New-MatrixIssue -Title $item.Title -Body $body
    $created[$item.Id] = $num
    Write-Output "$($item.Id) -> #$num"
    Start-Sleep -Seconds 2
}

# Post depends comments
$depMap = @{
    I05 = @($created.I04)
    I09 = @($created.I08)
    I10 = @($created.I09)
    I11 = @($created.I09)
    I12 = @($created.I11)
    I14 = @($created.I13)
}
foreach ($key in $depMap.Keys) {
    $deps = $depMap[$key] | ForEach-Object { "#$_" }
    if ($created.ContainsKey($key)) {
        gh issue comment $($created[$key]) --repo $Repo --body "Depends on: $($deps -join ', ')"
    }
}

$created | ConvertTo-Json | Set-Content -Path (Join-Path $PSScriptRoot "..\doc\working-log\.matrix-ux-issue-ids.json") -Encoding UTF8
Write-Output "DONE"
