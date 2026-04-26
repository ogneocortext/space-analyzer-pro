# Move Projects to New Merge Structure
Write-Host "=== MOVING PROJECTS TO MERGE STRUCTURE ===" -ForegroundColor Yellow

$sourceDir1 = "E:\Self Built Web and Web and Mobile Apps\Music Sync 2 Video App"
$sourceDir2 = "E:\Self Built Web and Web and Mobile Apps\Simplified Media Generator"
$targetParent = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools"
$targetDir1 = Join-Path $targetParent "Music Sync 2 Video App"
$targetDir2 = Join-Path $targetParent "Simplified Media Generator"

Write-Host "Source directories:" -ForegroundColor White
Write-Host "  Music Sync 2 Video App: $sourceDir1" -ForegroundColor Cyan
Write-Host "  Simplified Media Generator: $sourceDir2" -ForegroundColor Cyan
Write-Host "Target directories:" -ForegroundColor White
Write-Host "  Music Sync 2 Video App: $targetDir1" -ForegroundColor Cyan
Write-Host "  Simplified Media Generator: $targetDir2" -ForegroundColor Cyan

# Check if source directories exist
if (-not (Test-Path $sourceDir1)) {
    Write-Host "ERROR: Source directory 1 not found: $sourceDir1" -ForegroundColor Red
    return
}
if (-not (Test-Path $sourceDir2)) {
    Write-Host "ERROR: Source directory 2 not found: $sourceDir2" -ForegroundColor Red
    return
}

# Check if target directories are empty
$target1Content = Get-ChildItem $targetDir1 -ErrorAction SilentlyContinue
$target2Content = Get-ChildItem $targetDir2 -ErrorAction SilentlyContinue

if ($target1Content -or $target2Content) {
    Write-Host "WARNING: Target directories are not empty!" -ForegroundColor Yellow
    $confirm = Read-Host "Continue anyway? This may overwrite existing files (y/n)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Operation cancelled." -ForegroundColor Yellow
        return
    }
}

Write-Host "`nStarting move operation..." -ForegroundColor Green

# Move first project
Write-Host "`nMoving Music Sync 2 Video App..." -ForegroundColor Cyan
try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Use Robocopy for reliable move
    $robocopyResult = robocopy $sourceDir1 $targetDir1 /MOVE /E /COPYALL /R:3 /W:5
    
    $stopwatch.Stop()
    
    if ($LASTEXITCODE -lt 8) {
        Write-Host "✓ Music Sync 2 Video App moved successfully" -ForegroundColor Green
        Write-Host "  Time taken: $($stopwatch.Elapsed.TotalSeconds) seconds" -ForegroundColor White
        
        # Verify move
        if (Test-Path $targetDir1) {
            $movedSize = (Get-ChildItem $targetDir1 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "  Verified size: $([math]::Round($movedSize/1MB,2)) MB" -ForegroundColor White
        }
    } else {
        Write-Host "✗ Move failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Error details: $robocopyResult" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error moving Music Sync 2 Video App: $($_.Exception.Message)" -ForegroundColor Red
}

# Move second project
Write-Host "`nMoving Simplified Media Generator..." -ForegroundColor Cyan
try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Use Robocopy for reliable move
    $robocopyResult = robocopy $sourceDir2 $targetDir2 /MOVE /E /COPYALL /R:3 /W:5
    
    $stopwatch.Stop()
    
    if ($LASTEXITCODE -lt 8) {
        Write-Host "✓ Simplified Media Generator moved successfully" -ForegroundColor Green
        Write-Host "  Time taken: $($stopwatch.Elapsed.TotalSeconds) seconds" -ForegroundColor White
        
        # Verify move
        if (Test-Path $targetDir2) {
            $movedSize = (Get-ChildItem $targetDir2 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "  Verified size: $([math]::Round($movedSize/1MB,2)) MB" -ForegroundColor White
        }
    } else {
        Write-Host "✗ Move failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Error details: $robocopyResult" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error moving Simplified Media Generator: $($_.Exception.Message)" -ForegroundColor Red
}

# Check if source directories are now empty
Write-Host "`nChecking source directories..." -ForegroundColor Cyan
$source1Content = Get-ChildItem $sourceDir1 -ErrorAction SilentlyContinue
$source2Content = Get-ChildItem $sourceDir2 -ErrorAction SilentlyContinue

if (-not $source1Content) {
    Write-Host "✓ Source directory 1 is empty (can be removed)" -ForegroundColor Green
    try {
        Remove-Item $sourceDir1 -Force
        Write-Host "✓ Source directory 1 removed" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove source directory 1: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ Source directory 1 still contains files" -ForegroundColor Yellow
}

if (-not $source2Content) {
    Write-Host "✓ Source directory 2 is empty (can be removed)" -ForegroundColor Green
    try {
        Remove-Item $sourceDir2 -Force
        Write-Host "✓ Source directory 2 removed" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove source directory 2: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ Source directory 2 still contains files" -ForegroundColor Yellow
}

# Show final structure
Write-Host "`n=== FINAL STRUCTURE ===" -ForegroundColor Yellow
Get-ChildItem $targetParent | ForEach-Object {
    try {
        $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "$($_.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
    } catch {
        Write-Host "$($_.Name): Cannot calculate size" -ForegroundColor Yellow
    }
}

Write-Host "`nMove operation complete!" -ForegroundColor Green
Write-Host "Projects are now in the merged structure." -ForegroundColor Yellow
