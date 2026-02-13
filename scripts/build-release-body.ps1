param(
    [string]$OutputDir = "dist/edge-packages",
    [int]$ProgressEntries = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $repoRoot "manifest.json"
$progressPath = Join-Path $repoRoot "PROGRESS.md"
$resolvedOutputDir = Join-Path $repoRoot $OutputDir
$checksumsPath = Join-Path $resolvedOutputDir "checksums.txt"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "manifest.json not found at repository root."
}
if (-not (Test-Path -LiteralPath $checksumsPath)) {
    throw "checksums.txt not found. Run package-edge.ps1 first."
}
if (-not (Test-Path -LiteralPath $progressPath)) {
    throw "PROGRESS.md not found at repository root."
}

$manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "manifest.json is missing a valid version value."
}

$shaLines = Get-Content -Path $checksumsPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$progressLines = Get-Content -Path $progressPath |
    Where-Object { $_ -match "^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+-\s+" }

$recentProgress = @()
if ($progressLines.Count -gt 0) {
    $take = [Math]::Min($ProgressEntries, $progressLines.Count)
    $recentProgress = $progressLines | Select-Object -Last $take
}

$sha = [string]$env:GITHUB_SHA
$shortSha = if ([string]::IsNullOrWhiteSpace($sha)) { "local" } else { $sha.Substring(0, 7) }
$runNumber = [string]$env:GITHUB_RUN_NUMBER
if ([string]::IsNullOrWhiteSpace($runNumber)) {
    $runNumber = "local"
}

$bodyLines = @(
    "# Edge extension build metadata",
    "",
    "- Manifest version: v$version",
    "- Commit: $shortSha",
    "- Run: $runNumber",
    "- Built (UTC): $(Get-Date -AsUTC -Format "yyyy-MM-dd HH:mm:ss")",
    "",
    "## SHA-256 checksums",
    "",
    '```text'
)

$bodyLines += $shaLines
$bodyLines += @(
    '```',
    "",
    "## Recent progress",
    ""
)

if ($recentProgress.Count -eq 0) {
    $bodyLines += '- No timestamped progress entries were found in `PROGRESS.md`.'
}
else {
    $bodyLines += $recentProgress | ForEach-Object { "- $_" }
}

$releaseBodyPath = Join-Path $resolvedOutputDir "release-body.md"
Set-Content -Path $releaseBodyPath -Value (($bodyLines -join "`n") + "`n") -Encoding utf8

if (-not [string]::IsNullOrWhiteSpace([string]$env:GITHUB_OUTPUT)) {
    Add-Content -Path $env:GITHUB_OUTPUT -Value "manifest_version=$version"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "short_sha=$shortSha"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "release_body_path=$releaseBodyPath"
}

Write-Host "Release body generated at $releaseBodyPath"
