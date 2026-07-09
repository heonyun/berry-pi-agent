# Gate: when implement_failure_count >= 2, require a filled failure-advisory brief.
# Below threshold: skipped=true exit 0.

param(
    [Parameter(Mandatory = $true)]
    [int]$IssueNumber,

    [string]$Repo = 'heonyun/berry-pi-agent',
    [string]$Path = '',
    [int]$FailureCount = -1,
    [int]$MinAttempts = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "Requires PowerShell 7+ (pwsh)."
}

$scriptDir = $PSScriptRoot
$repoRoot = (git -C (Join-Path $scriptDir '..') rev-parse --show-toplevel 2>$null)
if ([string]::IsNullOrWhiteSpace($repoRoot)) { $repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path }
else { $repoRoot = $repoRoot.Trim() }

. (Join-Path $scriptDir 'lib/FailureAdvisoryBrief.ps1')
. (Join-Path $scriptDir 'lib/ProcessMode.ps1')

$count = $FailureCount
if ($count -lt 0) {
    $count = 0
    $signalsPath = Join-Path $repoRoot ".orchestrator/runs/issue-$IssueNumber/signals.json"
    $signals = Get-SignalsObject -SignalsPath $signalsPath
    if ($null -ne $signals -and $null -ne $signals.implement_failure_count) {
        $count = [int]$signals.implement_failure_count
    }
    $null = Get-Command gh -ErrorAction Stop
    $issueJson = gh issue view $IssueNumber --repo $Repo --json body,comments | ConvertFrom-Json
    foreach ($comment in @($issueJson.comments)) {
        if ([string]$comment.body -match 'pi-agent:implement-failure-count:(\d+)') {
            $c = [int]$Matches[1]
            if ($c -gt $count) { $count = $c }
        }
    }
    if ([string]$issueJson.body -match 'implement_failure_count\s*\|\s*(\d+)') {
        $bodyCount = [int]$Matches[1]
        if ($bodyCount -gt $count) { $count = $bodyCount }
    }
}

$briefPath = if (-not [string]::IsNullOrWhiteSpace($Path)) {
    $Path
} else {
    Get-DefaultFailureAdvisoryBriefPath -RepoRoot $repoRoot -IssueNumber $IssueNumber
}

Write-Output "issue=$IssueNumber"
Write-Output "implement_failure_count=$count"
Write-Output "brief_path=$briefPath"

if ($count -lt 2) {
    Write-Output 'skipped=true'
    Write-Output 'reason=failure_count_below_2'
    Write-Output 'failure_advisory_required=false'
    exit 0
}

Write-Output 'failure_advisory_required=true'
$result = Test-FailureAdvisoryBriefFile -Path $briefPath -MinAttempts $MinAttempts
Write-Output "pass=$($result.Pass)"
Write-Output "attempt_count=$($result.AttemptCount)"
foreach ($err in $result.Errors) {
    Write-Output "error=$err"
}
if (-not $result.Pass) {
    exit 1
}
exit 0
