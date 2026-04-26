# Simple Migration to Native Media AI Studio
Write-Host "=== MIGRATING TO NATIVE MEDIA AI STUDIO ===" -ForegroundColor Yellow

$unifiedPath = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools"
$nativeStudioPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"

Write-Host "Starting migration..." -ForegroundColor White

# Create unified components directory
$unifiedComponentsPath = Join-Path $nativeStudioPath "unified-components"
if (-not (Test-Path $unifiedComponentsPath)) {
    New-Item -Path $unifiedComponentsPath -ItemType Directory -Force
    Write-Host "Created unified components directory" -ForegroundColor Green
}

# Migrate Audio Sync components
$audioSyncSource = Join-Path $unifiedPath "Music Sync 2 Video App"
$audioSyncTarget = Join-Path $unifiedComponentsPath "audio-sync"

if (Test-Path $audioSyncSource) {
    New-Item -Path $audioSyncTarget -ItemType Directory -Force
    Write-Host "Migrating Audio Sync components..." -ForegroundColor Cyan
    
    # Copy Python files
    $pythonFiles = Get-ChildItem $audioSyncSource -Filter "*.py" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $pythonFiles | Select-Object -First 10) {
        Copy-Item $file.FullName $audioSyncTarget -Force
        Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
    }
}

# Migrate Unified Processor components
$unifiedSource = Join-Path $unifiedPath "Simplified Media Generator"
$unifiedTarget = Join-Path $unifiedComponentsPath "unified-processor"

if (Test-Path $unifiedSource) {
    New-Item -Path $unifiedTarget -ItemType Directory -Force
    Write-Host "Migrating Unified Processor components..." -ForegroundColor Cyan
    
    # Copy Python files
    $pythonFiles = Get-ChildItem $unifiedSource -Filter "*.py" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $pythonFiles | Select-Object -First 10) {
        Copy-Item $file.FullName $unifiedTarget -Force
        Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
    }
}

# Migrate Shared Backend
$backendSource = Join-Path $unifiedPath "Shared Backend"
$backendTarget = Join-Path $unifiedComponentsPath "shared-backend"

if (Test-Path $backendSource) {
    New-Item -Path $backendTarget -ItemType Directory -Force
    Write-Host "Migrating Shared Backend components..." -ForegroundColor Cyan
    
    # Copy backend files
    $backendFiles = Get-ChildItem $backendSource -Filter "*.py" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $backendFiles | Select-Object -First 15) {
        $relativePath = $file.FullName.Replace($backendSource, "")
        $targetFile = Join-Path $backendTarget $relativePath
        $targetDir = Split-Path $targetFile -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -Path $targetDir -ItemType Directory -Force
        }
        Copy-Item $file.FullName $targetFile -Force
        Write-Host "  Copied: $relativePath" -ForegroundColor Gray
    }
}

# Migrate Frontend components
$frontendSource = Join-Path $unifiedPath "Unified Frontend"
$frontendTarget = Join-Path $unifiedComponentsPath "unified-frontend"

if (Test-Path $frontendSource) {
    New-Item -Path $frontendTarget -ItemType Directory -Force
    Write-Host "Migrating Frontend components..." -ForegroundColor Cyan
    
    # Copy React components
    $reactFiles = Get-ChildItem $frontendSource -Filter "*.tsx" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $reactFiles | Select-Object -First 10) {
        $relativePath = $file.FullName.Replace($frontendSource, "")
        $targetFile = Join-Path $frontendTarget $relativePath
        $targetDir = Split-Path $targetFile -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -Path $targetDir -ItemType Directory -Force
        }
        Copy-Item $file.FullName $targetFile -Force
        Write-Host "  Copied: $relativePath" -ForegroundColor Gray
    }
}

# Migrate configuration
$configSource = Join-Path $unifiedPath "Shared Dependencies"
$configTarget = Join-Path $unifiedComponentsPath "configuration"

if (Test-Path $configSource) {
    New-Item -Path $configTarget -ItemType Directory -Force
    Write-Host "Migrating Configuration..." -ForegroundColor Cyan
    
    # Copy config files
    $configFiles = Get-ChildItem $configSource -Filter "*.json" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $configFiles) {
        Copy-Item $file.FullName $configTarget -Force
        Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
    }
}

# Create integration script
$integrationScript = @"
# Integration Script for Native Media AI Studio
Write-Host "=== INTEGRATING UNIFIED COMPONENTS ===" -ForegroundColor Yellow

\$nativeStudioPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"
\$unifiedComponents = Join-Path \$nativeStudioPath "unified-components"

Write-Host "Integration will be done manually by updating Native Studio configuration" -ForegroundColor White
Write-Host "Components are available at: \$unifiedComponents" -ForegroundColor Green
"@

Set-Content -Path (Join-Path $unifiedComponentsPath "integrate.ps1") -Value $integrationScript -Encoding UTF8

Write-Host "`nMigration completed successfully!" -ForegroundColor Green
Write-Host "Components migrated to: $unifiedComponentsPath" -ForegroundColor White
Write-Host "Ready for integration into Native Media AI Studio" -ForegroundColor Yellow
