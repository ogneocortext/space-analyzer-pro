# Simple Project Move
Write-Host "=== MOVING PROJECTS ===" -ForegroundColor Yellow

$source1 = "E:\Self Built Web and Web and Mobile Apps\Music Sync 2 Video App"
$source2 = "E:\Self Built Web and Web and Mobile Apps\Simplified Media Generator"
$target1 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Music Sync 2 Video App"
$target2 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Simplified Media Generator"

Write-Host "Moving Music Sync 2 Video App..." -ForegroundColor Cyan
if (Test-Path $source1) {
    try {
        Move-Item $source1 $target1 -Force
        Write-Host "Music Sync 2 Video App moved successfully" -ForegroundColor Green
    } catch {
        Write-Host "Error moving Music Sync 2 Video App: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Source directory not found: $source1" -ForegroundColor Red
}

Write-Host "Moving Simplified Media Generator..." -ForegroundColor Cyan
if (Test-Path $source2) {
    try {
        Move-Item $source2 $target2 -Force
        Write-Host "Simplified Media Generator moved successfully" -ForegroundColor Green
    } catch {
        Write-Host "Error moving Simplified Media Generator: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Source directory not found: $source2" -ForegroundColor Red
}

Write-Host "Move operation complete!" -ForegroundColor Green
