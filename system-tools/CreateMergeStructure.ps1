# Create Directory Merge Structure
Write-Host "=== CREATING MERGE STRUCTURE ===" -ForegroundColor Yellow

$parentDir = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools"

Write-Host "Creating parent directory..." -ForegroundColor White
if (-not (Test-Path $parentDir)) {
    New-Item -Path $parentDir -ItemType Directory -Force
    Write-Host "Parent directory created" -ForegroundColor Green
}

$subdirs = @("Music Sync 2 Video App", "Simplified Media Generator", "Shared Dependencies", "Common Utilities")

foreach ($subdir in $subdirs) {
    $subPath = Join-Path $parentDir $subdir
    if (-not (Test-Path $subPath)) {
        New-Item -Path $subPath -ItemType Directory -Force
        Write-Host "Created: $subdir" -ForegroundColor Green
    }
}

Write-Host "Merge structure created successfully" -ForegroundColor Green
Write-Host "Ready to move projects into new structure" -ForegroundColor Yellow
