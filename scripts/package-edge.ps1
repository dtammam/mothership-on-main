param(
    [string]$OutputDir = "dist/edge-packages",
    [string]$QaSuffix = " QA"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Copy-PackageContent {
    param(
        [string]$SourceRoot,
        [string]$DestinationRoot
    )

    $itemsToPackage = @(
        "manifest.json",
        "index.html",
        "config.json",
        "css",
        "js",
        "images",
        "LICENSE",
        "NOTICE",
        "PRIVACY.md"
    )

    foreach ($item in $itemsToPackage) {
        $sourcePath = Join-Path $SourceRoot $item
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Required package item not found: $item"
        }

        Copy-Item -LiteralPath $sourcePath -Destination $DestinationRoot -Recurse -Force
    }
}

function Get-ChecksumLine {
    param(
        [string]$ZipPath
    )

    $hash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $zipName = Split-Path -Path $ZipPath -Leaf
    return "$hash  $zipName"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $repoRoot "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "manifest.json not found at repository root."
}

$manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
$extensionName = [string]$manifest.name
$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($extensionName)) {
    throw "manifest.json is missing a valid name value."
}
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "manifest.json is missing a valid version value."
}

$slug = $extensionName.ToLowerInvariant()
$slug = ($slug -replace "[^a-z0-9]+", "-").Trim("-")
if ([string]::IsNullOrWhiteSpace($slug)) {
    $slug = "edge-extension"
}

$resolvedOutputDir = Join-Path $repoRoot $OutputDir
New-Item -Path $resolvedOutputDir -ItemType Directory -Force | Out-Null

$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("edge-package-" + [Guid]::NewGuid().ToString("N"))
$prodStage = Join-Path $stagingRoot "prod"
$qaStage = Join-Path $stagingRoot "qa"
New-Item -Path $prodStage -ItemType Directory -Force | Out-Null
New-Item -Path $qaStage -ItemType Directory -Force | Out-Null

try {
    Copy-PackageContent -SourceRoot $repoRoot -DestinationRoot $prodStage
    Copy-PackageContent -SourceRoot $repoRoot -DestinationRoot $qaStage

    $qaManifestPath = Join-Path $qaStage "manifest.json"
    $qaManifest = Get-Content -Path $qaManifestPath -Raw | ConvertFrom-Json
    $qaName = [string]$qaManifest.name
    if (-not $qaName.EndsWith($QaSuffix)) {
        $qaManifest.name = "$qaName$QaSuffix"
    }
    $qaManifest | ConvertTo-Json -Depth 20 | Set-Content -Path $qaManifestPath -Encoding utf8

    $prodZipPath = Join-Path $resolvedOutputDir "$slug-$version-prod.zip"
    $qaZipPath = Join-Path $resolvedOutputDir "$slug-$version-qa.zip"
    $prodShaPath = "$prodZipPath.sha256"
    $qaShaPath = "$qaZipPath.sha256"

    if (Test-Path -LiteralPath $prodZipPath) {
        Remove-Item -LiteralPath $prodZipPath -Force
    }
    if (Test-Path -LiteralPath $qaZipPath) {
        Remove-Item -LiteralPath $qaZipPath -Force
    }
    if (Test-Path -LiteralPath $prodShaPath) {
        Remove-Item -LiteralPath $prodShaPath -Force
    }
    if (Test-Path -LiteralPath $qaShaPath) {
        Remove-Item -LiteralPath $qaShaPath -Force
    }

    Compress-Archive -Path (Join-Path $prodStage "*") -DestinationPath $prodZipPath -CompressionLevel Optimal
    Compress-Archive -Path (Join-Path $qaStage "*") -DestinationPath $qaZipPath -CompressionLevel Optimal

    $hashLines = @()
    $hashLines += Get-ChecksumLine -ZipPath $qaZipPath
    $hashLines += Get-ChecksumLine -ZipPath $prodZipPath
    Set-Content -Path (Join-Path $resolvedOutputDir "checksums.txt") -Value (($hashLines -join "`n") + "`n") -Encoding ascii

    Write-Host "Created packages:"
    Write-Host "  $qaZipPath"
    Write-Host "  $prodZipPath"
    Write-Host "Checksums written to:"
    Write-Host "  $(Join-Path $resolvedOutputDir "checksums.txt")"
}
finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}
