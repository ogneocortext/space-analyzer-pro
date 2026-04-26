# Analyze Program Files Directory - Safe Analysis Only
Write-Host "=== PROGRAM FILES ANALYSIS ===" -ForegroundColor Yellow
Write-Host "Target: C:\Program Files" -ForegroundColor White
Write-Host "This is a critical system directory - analysis only, no automatic deletion" -ForegroundColor Red

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some directories may be inaccessible." -ForegroundColor Yellow
}

# Get total size first
Write-Host "`nCalculating total Program Files size..." -ForegroundColor White
try {
    $totalSize = (Get-ChildItem "C:\Program Files" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Host "Total Program Files size: $([math]::Round($totalSize/1GB,2)) GB" -ForegroundColor Green
} catch {
    Write-Host "Could not calculate total size (access denied)" -ForegroundColor Yellow
}

# Find large directories (>500MB)
Write-Host "`n=== LARGE DIRECTORIES ANALYSIS ===" -ForegroundColor Cyan
$largeDirs = Get-ChildItem "C:\Program Files" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        if ($size -gt 500MB) {
            [PSCustomObject]@{
                Name = $_.Name
                Path = $_.FullName
                Size = $size
                SizeMB = [math]::Round($size/1MB,2)
                SizeGB = [math]::Round($size/1GB,2)
            }
        }
    } catch {
        Write-Host "Cannot access: $($_.FullName)" -ForegroundColor Yellow
    }
} | Sort-Object Size -Descending

if ($largeDirs.Count -gt 0) {
    Write-Host "Large directories found:" -ForegroundColor White
    foreach ($dir in $largeDirs) {
        Write-Host "  $($dir.Name): $($dir.SizeGB) GB ($($dir.SizeMB) MB)" -ForegroundColor Cyan
    }
} else {
    Write-Host "No directories larger than 500MB found" -ForegroundColor Green
}

# Find uninstallers and temporary files
Write-Host "`n=== SAFE CLEANUP OPPORTUNITIES ===" -ForegroundColor Green
Write-Host "Looking for uninstallers and temporary files..." -ForegroundColor White

$uninstallers = @()
$tempFiles = @()
$oldVersions = @()

# Search for uninstallers
Get-ChildItem "C:\Program Files" -Recurse -Filter "uninstall*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Length -gt 1MB) {
        $uninstallers += [PSCustomObject]@{
            Name = $_.Name
            Path = $_.FullName
            Size = $_.Length
            SizeMB = [math]::Round($_.Length/1MB,2)
        }
    }
}

# Search for temporary files
Get-ChildItem "C:\Program Files" -Recurse -Include "*.tmp","*.temp","*.bak","*.old" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Length -gt 10MB) {
        $tempFiles += [PSCustomObject]@{
            Name = $_.Name
            Path = $_.FullName
            Size = $_.Length
            SizeMB = [math]::Round($_.Length/1MB,2)
        }
    }
}

# Look for old version directories
Get-ChildItem "C:\Program Files" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -match "\d+\.\d+" -or $_.Name -match "v\d+" -or $_.Name -match "old|legacy|backup") {
        try {
            $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($size -gt 100MB) {
                $oldVersions += [PSCustomObject]@{
                    Name = $_.Name
                    Path = $_.FullName
                    Size = $size
                    SizeMB = [math]::Round($size/1MB,2)
                    SizeGB = [math]::Round($size/1GB,2)
                }
            }
        } catch {
            # Skip if can't access
        }
    }
}

# Display findings
if ($uninstallers.Count -gt 0) {
    Write-Host "`nLarge uninstallers found:" -ForegroundColor Yellow
    foreach ($uninstaller in $uninstallers | Sort-Object Size -Descending) {
        Write-Host "  $($uninstaller.Name): $($uninstaller.SizeMB) MB" -ForegroundColor White
        Write-Host "    Path: $($uninstaller.Path)" -ForegroundColor Gray
    }
}

if ($tempFiles.Count -gt 0) {
    Write-Host "`nLarge temporary files found:" -ForegroundColor Yellow
    foreach ($temp in $tempFiles | Sort-Object Size -Descending) {
        Write-Host "  $($temp.Name): $($temp.SizeMB) MB" -ForegroundColor White
        Write-Host "    Path: $($temp.Path)" -ForegroundColor Gray
    }
}

if ($oldVersions.Count -gt 0) {
    Write-Host "`nPotential old version directories:" -ForegroundColor Yellow
    foreach ($old in $oldVersions | Sort-Object Size -Descending) {
        Write-Host "  $($old.Name): $($old.SizeGB) GB ($($old.SizeMB) MB)" -ForegroundColor White
        Write-Host "    Path: $($old.Path)" -ForegroundColor Gray
    }
}

# Calculate potential cleanup space
$potentialSpace = 0
$uninstallers | ForEach-Object { $potentialSpace += $_.Size }
$tempFiles | ForEach-Object { $potentialSpace += $_.Size }
$oldVersions | ForEach-Object { $potentialSpace += $_.Size }

Write-Host "`n=== POTENTIAL SPACE RECOVERY ===" -ForegroundColor Yellow
Write-Host "Uninstallers: $($uninstallers.Count) files, $([math]::Round(($uninstallers | Measure-Object -Property Size -Sum).Sum/1MB,2)) MB" -ForegroundColor White
Write-Host "Temporary files: $($tempFiles.Count) files, $([math]::Round(($tempFiles | Measure-Object -Property Size -Sum).Sum/1MB,2)) MB" -ForegroundColor White
Write-Host "Old versions: $($oldVersions.Count) directories, $([math]::Round(($oldVersions | Measure-Object -Property Size -Sum).Sum/1MB,2)) MB" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "Total potential recovery: $([math]::Round($potentialSpace/1MB,2)) MB ($([math]::Round($potentialSpace/1GB,2)) GB)" -ForegroundColor Green

Write-Host "`n=== SAFETY RECOMMENDATIONS ===" -ForegroundColor Red
Write-Host "1. NEVER delete files from Program Files without confirmation" -ForegroundColor White
Write-Host "2. Always use Windows Apps & Features to uninstall properly" -ForegroundColor White
Write-Host "3. Temporary files are generally safe to delete" -ForegroundColor White
Write-Host "4. Old versions should be verified before removal" -ForegroundColor White
Write-Host "5. Create a System Restore point before major changes" -ForegroundColor White

Write-Host "`nAnalysis complete. Review the findings above before taking any action." -ForegroundColor Green
