$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "RepoScriptRuntime.ps1")

function Get-BerryPiAgentForkRepo {
    return "heonyun/berry-pi-agent"
}

function Invoke-GhFork {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$GhArgs
    )

    Assert-RepoPowerShellVersion

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw "gh CLI is not available on PATH."
    }

    $repo = Get-BerryPiAgentForkRepo
    $previousRepo = $env:GH_REPO
    $env:GH_REPO = $repo
    try {
        & gh @GhArgs
        exit $LASTEXITCODE
    } finally {
        if ($null -eq $previousRepo) {
            Remove-Item Env:GH_REPO -ErrorAction SilentlyContinue
        } else {
            $env:GH_REPO = $previousRepo
        }
    }
}
