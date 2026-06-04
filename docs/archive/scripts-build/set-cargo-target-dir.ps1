param(
    [string]$TargetDir = "$env:LOCALAPPDATA\\SpaceAnalyzerPro\\cargo-target"
)

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    throw "TargetDir is empty. Set -TargetDir or LOCALAPPDATA."
}

Write-Host "[+] Using CARGO_TARGET_DIR=$TargetDir"
$env:CARGO_TARGET_DIR = $TargetDir

Write-Host ""
Write-Host "To make this permanent for your user profile (PowerShell):"
Write-Host "  setx CARGO_TARGET_DIR `"$TargetDir`""

