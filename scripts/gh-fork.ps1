param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GhArgs
)

. (Join-Path $PSScriptRoot "GhForkCommon.ps1")
Invoke-GhFork @GhArgs
