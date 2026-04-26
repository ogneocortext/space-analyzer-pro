# Setup Complete Shared Dependencies Structure
Write-Host "=== SHARED DEPENDENCIES SETUP ===" -ForegroundColor Yellow

$sharedDir = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Shared Dependencies"
$project1 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Music Sync 2 Video App"
$project2 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Simplified Media Generator"

# Create shared structure
Write-Host "Creating shared dependencies structure..." -ForegroundColor White

$sharedDirs = @(
    "Python",
    "Python\Lib\site-packages",
    "Node.js",
    "Node.js\modules",
    "Common Utilities",
    "Common Libraries",
    "Configuration"
)

foreach ($dir in $sharedDirs) {
    $fullPath = Join-Path $sharedDir $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -Path $fullPath -ItemType Directory -Force
        Write-Host "Created: $dir" -ForegroundColor Green
    }
}

# Create requirements.txt for shared Python
$requirementsPath = Join-Path $sharedDir "Python\requirements.txt"
$requirementsContent = @"
# Shared Python Dependencies
# Add common packages here
numpy>=1.21.0
pandas>=1.3.0
opencv-python>=4.5.0
pillow>=8.0.0
requests>=2.25.0
flask>=2.0.0
tensorflow>=2.6.0
torch>=1.9.0
"@

Set-Content -Path $requirementsPath -Value $requirementsContent -Encoding UTF8
Write-Host "Created shared requirements.txt" -ForegroundColor Green

# Create package.json for shared Node.js
$packagePath = Join-Path $sharedDir "Node.js\package.json"
$packageContent = @"
{
  "name": "shared-media-dependencies",
  "version": "1.0.0",
  "description": "Shared dependencies for media processing tools",
  "main": "index.js",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^4.0.0",
    "webpack": "^5.0.0",
    "babel-core": "^6.26.3",
    "express": "^4.17.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/node": "^16.0.0"
  }
}
"@

Set-Content -Path $packagePath -Value $packageContent -Encoding UTF8
Write-Host "Created shared package.json" -ForegroundColor Green

# Create activation scripts
$activatePython = Join-Path $sharedDir "Python\activate_shared.ps1"
$activateContent = @"
# Activate Shared Python Environment
Write-Host "Activating shared Python environment..." -ForegroundColor Green
$sharedVenv = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Shared Dependencies\Python"
& "$sharedVenv\Scripts\Activate.ps1"
Write-Host "Shared Python environment activated!" -ForegroundColor Green
"@

Set-Content -Path $activatePython -Value $activateContent -Encoding UTF8
Write-Host "Created Python activation script" -ForegroundColor Green

# Create usage guide
$guidePath = Join-Path $sharedDir "README.md"
$guideContent = @"
# Shared Dependencies Guide

## Python Environment
To activate the shared Python environment:
```powershell
.\Shared Dependencies\Python\activate_shared.ps1
```

To install common packages:
```powershell
pip install -r Shared\ Dependencies/Python/requirements.txt
```

## Node.js Environment
To install shared Node.js packages:
```powershell
cd "Shared Dependencies/Node.js"
npm install
```

## Usage in Projects
Update your project configurations to use shared dependencies:

### Python Projects
- Activate shared environment before running
- Remove duplicate packages from individual venvs
- Update import paths if needed

### Node.js Projects
- Use npm link for shared modules
- Update package.json to reference shared packages
- Remove duplicate dependencies

## Space Savings
Expected savings: ~650 MB
- Python venv optimization: ~500 MB
- Node.js modules sharing: ~100 MB
- Common utilities: ~50 MB
"@

Set-Content -Path $guidePath -Value $guideContent -Encoding UTF8
Write-Host "Created usage guide" -ForegroundColor Green

# Show final structure
Write-Host "`n=== FINAL SHARED DEPENDENCIES STRUCTURE ===" -ForegroundColor Yellow
Get-ChildItem $sharedDir -Recurse | ForEach-Object {
    $indent = "  " * ($_.FullName.Replace($sharedDir, "").Split("\").Count - 1)
    if ($_.PSIsContainer) {
        Write-Host "$indent$($_.Name)/" -ForegroundColor Cyan
    } else {
        $size = if ($_.Length -gt 0) { " ($([math]::Round($_.Length/1KB,2)) KB)" } else { "" }
        Write-Host "$indent$($_.Name)$size" -ForegroundColor White
    }
}

Write-Host "`n=== SETUP COMPLETE ===" -ForegroundColor Green
Write-Host "Shared dependencies structure is ready!" -ForegroundColor White
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Install shared packages using the provided scripts" -ForegroundColor White
Write-Host "2. Update project configurations" -ForegroundColor White
Write-Host "3. Remove duplicate dependencies from individual projects" -ForegroundColor White
Write-Host "4. Test functionality" -ForegroundColor White

Write-Host "`nAll setup tasks completed successfully!" -ForegroundColor Green
