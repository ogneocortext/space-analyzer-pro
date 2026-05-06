# Run this script as Administrator in PowerShell to fix the 'cmd.exe not recognized' error
# This issue affects VS Code and tools that inherit a broken environment

Write-Host "🔧 Fixing ComSpec and System PATH..." -ForegroundColor Cyan
Write-Host ""

# 1. Fix ComSpec - tells Windows where cmd.exe is
$comspec = [Environment]::GetEnvironmentVariable('ComSpec', 'Machine')
if ($comspec -ne 'C:\Windows\System32\cmd.exe') {
    Write-Host "❌ ComSpec is wrong or missing. Current value: '$comspec'" -ForegroundColor Red
    [Environment]::SetEnvironmentVariable('ComSpec', 'C:\Windows\System32\cmd.exe', 'Machine')
    Write-Host "✅ Fixed ComSpec to C:\Windows\System32\cmd.exe" -ForegroundColor Green
} else {
    Write-Host "✅ ComSpec is already correct" -ForegroundColor Green
}

# 2. Ensure C:\Windows\System32 is in system PATH
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$needsSystem32 = $currentPath -notlike '*C:\Windows\System32*'
$needsWindows = $currentPath -notlike '*C:\Windows*'

if ($needsSystem32 -or $needsWindows) {
    Write-Host "❌ PATH is missing critical directories" -ForegroundColor Red
    
    $additions = @()
    if ($needsSystem32) { $additions += 'C:\Windows\System32' }
    if ($needsWindows) { $additions += 'C:\Windows' }
    
    $newPath = $currentPath + ';' + ($additions -join ';')
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')
    Write-Host "✅ Added to PATH: $($additions -join ', ')" -ForegroundColor Green
} else {
    Write-Host "✅ PATH already contains C:\Windows\System32 and C:\Windows" -ForegroundColor Green
}

# 3. Also fix User PATH
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -and $userPath -notlike '*C:\Windows\System32*') {
    $newUserPath = $userPath + ';C:\Windows\System32'
    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
    Write-Host "✅ Added C:\Windows\System32 to User PATH" -ForegroundColor Green
}

# 4. Set for current session too
$env:ComSpec = 'C:\Windows\System32\cmd.exe'
$env:Path = 'C:\Windows\System32;C:\Windows;' + $env:Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "✅ All fixes applied!" -ForegroundColor Green
Write-Host "⚠️  You MUST restart VS Code for changes to take effect" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "After restarting VS Code:" -ForegroundColor Cyan
Write-Host "  The 'cmd.exe not recognized' error should be resolved" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verification steps after restart:" -ForegroundColor Cyan
Write-Host "  node --check server/routes/analysis.js" -ForegroundColor Gray
Write-Host "  node --version" -ForegroundColor Gray

# Keep window open if running from explorer
if ($host.Name -eq 'ConsoleHost') {
    Read-Host "Press Enter to exit"
}