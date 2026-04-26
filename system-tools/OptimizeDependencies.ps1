# Optimize Shared Dependencies
Write-Host "=== OPTIMIZING SHARED DEPENDENCIES ===" -ForegroundColor Yellow

$project1 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Music Sync 2 Video App"
$project2 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Simplified Media Generator"
$sharedDir = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Shared Dependencies"

Write-Host "Analyzing dependencies in both projects..." -ForegroundColor White

# Analyze Python dependencies
Write-Host "`n=== PYTHON DEPENDENCIES ANALYSIS ===" -ForegroundColor Cyan

$venv1 = Join-Path $project1 "venv"
$venv2 = Join-Path $project2 "venv"

if (Test-Path $venv1) {
    try {
        $size1 = (Get-ChildItem $venv1 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Project 1 venv: $([math]::Round($size1/1MB,2)) MB" -ForegroundColor White
        
        # Check common packages
        $sitePackages1 = Join-Path $venv1 "Lib\site-packages"
        if (Test-Path $sitePackages1) {
            $packages1 = Get-ChildItem $sitePackages1 -Directory -ErrorAction SilentlyContinue | Select-Object -First 10
            Write-Host "  Key packages in Project 1:" -ForegroundColor Gray
            foreach ($pkg in $packages1) {
                $pkgSize = (Get-ChildItem $pkg.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                if ($pkgSize -gt 10MB) {
                    Write-Host "    $($pkg.Name): $([math]::Round($pkgSize/1MB,2)) MB" -ForegroundColor Gray
                }
            }
        }
    } catch {
        Write-Host "Cannot analyze Project 1 venv" -ForegroundColor Yellow
    }
}

if (Test-Path $venv2) {
    try {
        $size2 = (Get-ChildItem $venv2 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Project 2 venv: $([math]::Round($size2/1MB,2)) MB" -ForegroundColor White
        
        # Check common packages
        $sitePackages2 = Join-Path $venv2 "Lib\site-packages"
        if (Test-Path $sitePackages2) {
            $packages2 = Get-ChildItem $sitePackages2 -Directory -ErrorAction SilentlyContinue | Select-Object -First 10
            Write-Host "  Key packages in Project 2:" -ForegroundColor Gray
            foreach ($pkg in $packages2) {
                $pkgSize = (Get-ChildItem $pkg.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                if ($pkgSize -gt 10MB) {
                    Write-Host "    $($pkg.Name): $([math]::Round($pkgSize/1MB,2)) MB" -ForegroundColor Gray
                }
            }
        }
    } catch {
        Write-Host "Cannot analyze Project 2 venv" -ForegroundColor Yellow
    }
}

# Analyze Node.js dependencies
Write-Host "`n=== NODE.JS DEPENDENCIES ANALYSIS ===" -ForegroundColor Cyan

$node1 = Join-Path $project1 "node_modules"
$node2 = Join-Path $project2 "node_modules"

if (Test-Path $node1) {
    try {
        $size1 = (Get-ChildItem $node1 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Project 1 node_modules: $([math]::Round($size1/1MB,2)) MB" -ForegroundColor White
    } catch {
        Write-Host "Cannot analyze Project 1 node_modules" -ForegroundColor Yellow
    }
}

if (Test-Path $node2) {
    try {
        $size2 = (Get-ChildItem $node2 -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Project 2 node_modules: $([math]::Round($size2/1MB,2)) MB" -ForegroundColor White
    } catch {
        Write-Host "Cannot analyze Project 2 node_modules" -ForegroundColor Yellow
    }
}

# Create shared Python environment
Write-Host "`n=== CREATING SHARED PYTHON ENVIRONMENT ===" -ForegroundColor Green
$sharedVenv = Join-Path $sharedDir "Python"

if (-not (Test-Path $sharedVenv)) {
    Write-Host "Creating shared Python virtual environment..." -ForegroundColor White
    try {
        python -m venv $sharedVenv
        Write-Host "✓ Shared Python venv created" -ForegroundColor Green
    } catch {
        Write-Host "Error creating shared Python venv: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Shared Python venv already exists" -ForegroundColor Yellow
}

# Create shared Node.js environment
Write-Host "`n=== CREATING SHARED NODE.JS ENVIRONMENT ===" -ForegroundColor Green
$sharedNode = Join-Path $sharedDir "Node.js"

if (-not (Test-Path $sharedNode)) {
    Write-Host "Creating shared Node.js modules directory..." -ForegroundColor White
    try {
        New-Item -Path $sharedNode -ItemType Directory -Force
        Write-Host "✓ Shared Node.js directory created" -ForegroundColor Green
    } catch {
        Write-Host "Error creating shared Node.js directory: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Shared Node.js directory already exists" -ForegroundColor Yellow
}

Write-Host "`n=== OPTIMIZATION RECOMMENDATIONS ===" -ForegroundColor Yellow
Write-Host "1. Install common packages to shared Python environment" -ForegroundColor White
Write-Host "2. Use npm link or yarn workspaces for Node.js" -ForegroundColor White
Write-Host "3. Update project configurations to use shared paths" -ForegroundColor White
Write-Host "4. Remove duplicate dependencies from individual projects" -ForegroundColor White

Write-Host "`nDependency optimization setup complete!" -ForegroundColor Green
