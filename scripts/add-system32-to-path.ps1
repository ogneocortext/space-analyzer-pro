# Add System32 to PATH via PowerShell
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*C:\Windows\System32*") {
    $newPath = "$currentPath;C:\Windows\System32"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    Write-Host "Added C:\Windows\System32 to system PATH" -ForegroundColor Green
    Write-Host "Restart your terminal/IDE for changes to take effect" -ForegroundColor Yellow
} else {
    Write-Host "C:\Windows\System32 already in PATH" -ForegroundColor Cyan
}