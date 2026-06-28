#Requires -Version 7.0
<#
.SYNOPSIS
  Smoke-test DeepSeek V4 thinking mode for PR and issue GitHub Action scripts.

.DESCRIPTION
  Loads DEEPSEEK_API_KEY from apps/context-canvas/.env.local when not already set.
  Builds payloads via agent_deepseek_write_payload (same as deepseek-*-comment.sh).
  Does not print secrets. Skips with exit 0 when no API key is available.

.PARAMETER Mode
  pr | issue | all — which script path to exercise (default: all).
#>
[CmdletBinding()]
param(
    [ValidateSet('pr', 'issue', 'all')]
    [string]$Mode = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-DotEnvFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $eq = $trimmed.IndexOf('=')
        if ($eq -lt 1) { continue }
        $key = $trimmed.Substring(0, $eq).Trim()
        if (-not $key -or [Environment]::GetEnvironmentVariable($key)) { continue }
        $value = $trimmed.Substring($eq + 1).Trim()
        $comment = $value.IndexOf(' #')
        if ($comment -ge 0 -and -not ($value.StartsWith('"') -or $value.StartsWith("'"))) {
            $value = $value.Substring(0, $comment).Trim()
        }
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value)
    }
}

function Get-GitBashPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'Git\bin\bash.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function New-DeepSeekPayloadInPowerShell {
    param(
        [string]$ScriptMode,
        [string]$Model,
        [string]$Effort
    )

    $temperature = if ($ScriptMode -eq 'issue') { 0.3 } else { 0.2 }
    $system = if ($ScriptMode -eq 'issue') {
        'You are a pre-implementation review assistant. Reply briefly.'
    } else {
        'You are a strict diff review assistant. Reply briefly.'
    }
    $user = 'Reply with exactly: ok'

    $effortNorm = $Effort.ToLowerInvariant()
    if ($effortNorm -in @('off', 'disabled', 'none', 'false', '0')) {
        return (@{
            model        = $Model
            stream       = $false
            thinking     = @{ type = 'disabled' }
            temperature  = $temperature
            messages     = @(
                @{ role = 'system'; content = $system },
                @{ role = 'user'; content = $user }
            )
        } | ConvertTo-Json -Depth 5 -Compress)
    }

    $reasoningEffort = if ($effortNorm -in @('max', 'xhigh')) { 'max' } else { 'high' }
    return (@{
        model            = $Model
        stream           = $false
        thinking         = @{ type = 'enabled' }
        reasoning_effort = $reasoningEffort
        messages         = @(
            @{ role = 'system'; content = $system },
            @{ role = 'user'; content = $user }
        )
    } | ConvertTo-Json -Depth 5 -Compress)
}

function New-DeepSeekPayloadViaAgentLib {
    param(
        [string]$ScriptMode,
        [string]$Model,
        [string]$Effort
    )

    $repoRoot = Split-Path -Parent $PSScriptRoot
    $agentLib = Join-Path $repoRoot '.github/scripts/agent-lib.sh'
    if (-not (Test-Path -LiteralPath $agentLib)) {
        throw "Missing agent-lib.sh at $agentLib"
    }

    $temperature = if ($ScriptMode -eq 'issue') { '0.3' } else { '0.2' }
    $system = if ($ScriptMode -eq 'issue') {
        'You are a pre-implementation review assistant. Reply briefly.'
    } else {
        'You are a strict diff review assistant. Reply briefly.'
    }
    $user = 'Reply with exactly: ok'

    $gitBash = Get-GitBashPath
    $jq = Get-Command jq -ErrorAction SilentlyContinue
    if (-not $gitBash -or -not $jq) {
        Write-Host 'NOTE: using PowerShell payload mirror (Git Bash+jq unavailable)'
        return New-DeepSeekPayloadInPowerShell -ScriptMode $ScriptMode -Model $Model -Effort $Effort
    }

    $payloadFile = [System.IO.Path]::GetTempFileName()
    try {
        $escapedPayload = $payloadFile -replace "'", "'\''"
        $escapedSystem = $system -replace "'", "'\''"
        $escapedUser = $user -replace "'", "'\''"
        $bashScript = @"
set -euo pipefail
source '$($agentLib -replace "'", "'\''")'
export DEEPSEEK_REASONING_EFFORT='$($Effort -replace "'", "'\''")'
agent_deepseek_write_payload '$escapedPayload' '$($Model -replace "'", "'\''")' '$escapedSystem' '$escapedUser' '$temperature'
"@
        $bashScript | & $gitBash -s
        Get-Content -LiteralPath $payloadFile -Raw
    }
    finally {
        Remove-Item -LiteralPath $payloadFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-DeepSeekReasoningMode {
    param(
        [string]$ScriptMode,
        [string]$ApiKey,
        [string]$Model,
        [string]$Effort
    )

    Write-Host ""
    Write-Host "=== Mode: $ScriptMode ==="

    $payloadJson = New-DeepSeekPayloadViaAgentLib -ScriptMode $ScriptMode -Model $Model -Effort $Effort
    $payload = $payloadJson | ConvertFrom-Json

    if ($payload.thinking.type -ne 'enabled') {
        throw "[$ScriptMode] expected thinking.type=enabled, got $($payload.thinking.type)"
    }
    if ($payload.reasoning_effort -ne $Effort) {
        throw "[$ScriptMode] expected reasoning_effort=$Effort, got $($payload.reasoning_effort)"
    }

    Write-Host "POST https://api.deepseek.com/chat/completions (model=$Model reasoning_effort=$($payload.reasoning_effort))"

    $response = Invoke-RestMethod `
        -Method Post `
        -Uri 'https://api.deepseek.com/chat/completions' `
        -Headers @{
            Authorization  = "Bearer $ApiKey"
            'Content-Type' = 'application/json'
        } `
        -Body $payloadJson

    $reasoningTokens = $response.usage.completion_tokens_details.reasoning_tokens
    $reasoningContent = $response.choices[0].message.reasoning_content
    $content = $response.choices[0].message.content

    Write-Host "content: $content"
    Write-Host "reasoning_tokens: $reasoningTokens"
    if ($reasoningContent) {
        $preview = if ($reasoningContent.Length -gt 80) { $reasoningContent.Substring(0, 80) + '…' } else { $reasoningContent }
        Write-Host "reasoning_content preview: $preview"
    }

    $hasReasoning = ($null -ne $reasoningTokens -and $reasoningTokens -gt 0) -or [bool]$reasoningContent
    if (-not $hasReasoning) {
        throw "[$ScriptMode] expected reasoning_tokens > 0 or reasoning_content in response"
    }

    Write-Host "PASS: DeepSeek reasoning mode ($ScriptMode)"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$envLocal = Join-Path $repoRoot 'apps/context-canvas/.env.local'
Import-DotEnvFile -Path $envLocal

$apiKey = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY')
if (-not $apiKey) {
    Write-Host 'SKIP: DEEPSEEK_API_KEY not set (set in shell or apps/context-canvas/.env.local)'
    exit 0
}

$model = if ($env:DEEPSEEK_MODEL) { $env:DEEPSEEK_MODEL } else { 'deepseek-v4-flash' }
$effort = if ($env:DEEPSEEK_REASONING_EFFORT) { $env:DEEPSEEK_REASONING_EFFORT.ToLowerInvariant() } else { 'high' }
if ($effort -in @('off', 'disabled', 'none', 'false', '0')) {
    Write-Host "SKIP: DEEPSEEK_REASONING_EFFORT=$effort disables thinking; set high or max for this test"
    exit 0
}
if ($effort -in @('max', 'xhigh')) { $effort = 'max' }
elseif ($effort -notin @('high', 'max')) { $effort = 'high' }

$modes = switch ($Mode) {
    'pr' { @('pr') }
    'issue' { @('issue') }
    default { @('pr', 'issue') }
}

foreach ($scriptMode in $modes) {
    Test-DeepSeekReasoningMode -ScriptMode $scriptMode -ApiKey $apiKey -Model $model -Effort $effort
}

Write-Host ''
Write-Host "PASS: all requested modes ($Mode)"
