# Directory Merge Implementation Plan
Write-Host "=== DIRECTORY MERGE IMPLEMENTATION ===" -ForegroundColor Yellow

$parentDir = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools"
$dir1 = "E:\Self Built Web and Web and Mobile Apps\Music Sync 2 Video App"
$dir2 = "E:\Self Built Web and Web and Mobile Apps\Simplified Media Generator"

Write-Host "This script will create the merge structure" -ForegroundColor White
Write-Host "Parent directory: $parentDir" -ForegroundColor Cyan

# Create parent directory
if (-not (Test-Path $parentDir)) {
    Write-Host "Creating parent directory..." -ForegroundColor Green
    New-Item -Path $parentDir -ItemType Directory -Force
    Write-Host "✓ Parent directory created" -ForegroundColor Green
} else {
    Write-Host "Parent directory already exists" -ForegroundColor Yellow
}

# Create subdirectories
$subdirs = @("Music Sync 2 Video App", "Simplified Media Generator", "Shared Dependencies", "Common Utilities")
foreach ($subdir in $subdirs) {
    $subPath = Join-Path $parentDir $subdir
    if (-not (Test-Path $subPath)) {
        Write-Host "Creating subdirectory: $subdir" -ForegroundColor Green
        New-Item -Path $subPath -ItemType Directory -Force
    }
}

Write-Host "`n=== MERGE STRUCTURE READY ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Move projects to new structure" -ForegroundColor Yellow
Write-Host "2. Optimize shared dependencies" -ForegroundColor Yellow
Write-Host "3. Update any configuration paths" -ForegroundColor Yellow

Write-Host "`nStructure created successfully!" -ForegroundColor Green
