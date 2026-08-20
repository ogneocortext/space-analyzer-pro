#Requires -Version 7
param(
    # Optional override. When omitted, the version is read from the repository's
    # Cargo.toml (the canonical Rust release version) so the packaged filename
    # never drifts from the build. Pass -Version explicitly to override.
    [string]$Version
)

$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')

if ([string]::IsNullOrWhiteSpace($Version)) {
    $toml = Join-Path $repo 'Cargo.toml'
    $inPackage = $false
    foreach ($line in (Get-Content $toml)) {
        if ($line -match '^\[package\]') { $inPackage = $true; continue }
        if ($line -match '^\[.+\]') { $inPackage = $false; continue }
        if ($inPackage -and $line -match '^\s*version\s*=\s*"([^"]+)"') {
            $Version = $Matches[1]
            break
        }
    }
    if ([string]::IsNullOrWhiteSpace($Version)) {
        throw "Could not find a [package] version in '$toml'."
    }
}
$src  = Join-Path $repo 'gui-winui\SpaceAnalyzer\bin\x64\Release\net10.0-windows10.0.22621.0'
$dist = Join-Path $repo 'dist'
$zip  = Join-Path $dist "space-analyzer-winui-$Version-windows-x64.zip"

if (-not (Test-Path $src)) {
    throw "Build output not found at '$src'. Run 'just build-winui' (Release) first."
}

if (-not (Test-Path $dist)) {
    New-Item -ItemType Directory -Path $dist | Out-Null
}

if (Test-Path $zip) {
    Remove-Item $zip
}

Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip

$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Package: $zip ($sizeMB MB)"
