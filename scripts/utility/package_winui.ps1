param(
    [string]$Version = "4.0.0"
)

$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
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
