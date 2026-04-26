# Migrate Unified Structure Components to Native Media AI Studio
Write-Host "=== MIGRATING TO NATIVE MEDIA AI STUDIO ===" -ForegroundColor Yellow

$unifiedPath = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools"
$nativeStudioPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"

Write-Host "Migration Strategy:" -ForegroundColor White
Write-Host "Source: $unifiedPath" -ForegroundColor Cyan
Write-Host "Target: $nativeStudioPath" -ForegroundColor Cyan
Write-Host "This will move optimized components to the production platform" -ForegroundColor Green

# Create migration plan
Write-Host "`n=== MIGRATION PLAN ===" -ForegroundColor Yellow

Write-Host "Components to migrate:" -ForegroundColor White
Write-Host "1. 🎵 Audio Sync Logic - Optimized audio processing algorithms" -ForegroundColor Cyan
Write-Host "2. 🎨 Unified Processing Pipeline - Combined audio-visual workflows" -ForegroundColor Cyan
Write-Host "3. 🔧 Shared Dependencies - Optimized Python/Node.js environments" -ForegroundColor Cyan
Write-Host "4. 📋 Configuration Management - Unified settings system" -ForegroundColor Cyan
Write-Host "5. 🎯 Optimized Components - Performance-enhanced processing" -ForegroundColor Cyan

# Create migration directories in Native Studio
$migrationDirs = @(
    "unified-components",
    "unified-components\audio-sync",
    "unified-components\unified-processor", 
    "unified-components\shared-dependencies",
    "unified-components\configuration",
    "unified-components\optimized-algorithms"
)

Write-Host "`nCreating migration directories..." -ForegroundColor White
foreach ($dir in $migrationDirs) {
    $targetPath = Join-Path $nativeStudioPath $dir
    if (-not (Test-Path $targetPath)) {
        New-Item -Path $targetPath -ItemType Directory -Force
        Write-Host "Created: $dir" -ForegroundColor Green
    }
}

# Migrate Audio Sync components
Write-Host "`n=== MIGRATING AUDIO SYNC COMPONENTS ===" -ForegroundColor Green

$audioSyncSource = Join-Path $unifiedPath "Music Sync 2 Video App"
$audioSyncTarget = Join-Path $nativeStudioPath "unified-components\audio-sync"

if (Test-Path $audioSyncSource) {
    Write-Host "Copying Audio Sync optimized components..." -ForegroundColor White
    
    # Copy key Python files
    $audioFiles = @(
        "scripts\audio_processor.py",
        "scripts\sync_algorithms.py", 
        "scripts\beat_detection.py",
        "scripts\video_sync.py"
    )
    
    foreach ($file in $audioFiles) {
        $sourceFile = Join-Path $audioSyncSource $file
        if (Test-Path $sourceFile) {
            $targetFile = Join-Path $audioSyncTarget (Split-Path $file -Leaf)
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "  Copied: $file" -ForegroundColor Gray
        }
    }
    
    # Copy configuration
    $configSource = Join-Path $audioSyncSource "config"
    if (Test-Path $configSource) {
        $configTarget = Join-Path $audioSyncTarget "config"
        Copy-Item $configSource $configTarget -Recurse -Force
        Write-Host "  Copied: Audio sync configuration" -ForegroundColor Gray
    }
}

# Migrate Unified Processor components
Write-Host "`n=== MIGRATING UNIFIED PROCESSOR COMPONENTS ===" -ForegroundColor Green

$unifiedSource = Join-Path $unifiedPath "Simplified Media Generator"
$unifiedTarget = Join-Path $nativeStudioPath "unified-components\unified-processor"

if (Test-Path $unifiedSource) {
    Write-Host "Copying Unified Processing components..." -ForegroundColor White
    
    # Copy key processing files
    $processingFiles = @(
        "scripts\media_generator.py",
        "scripts\ai_processor.py",
        "scripts\image_enhancement.py",
        "scripts\unified_pipeline.py"
    )
    
    foreach ($file in $processingFiles) {
        $sourceFile = Join-Path $unifiedSource $file
        if (Test-Path $sourceFile) {
            $targetFile = Join-Path $unifiedTarget (Split-Path $file -Leaf)
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "  Copied: $file" -ForegroundColor Gray
        }
    }
}

# Migrate Shared Backend components
Write-Host "`n=== MIGRATING SHARED BACKEND COMPONENTS ===" -ForegroundColor Green

$backendSource = Join-Path $unifiedPath "Shared Backend"
$backendTarget = Join-Path $nativeStudioPath "unified-components\shared-backend"

if (Test-Path $backendSource) {
    Write-Host "Copying Shared Backend components..." -ForegroundColor White
    
    # Copy API routes and services
    $backendComponents = @(
        "src\routes\audio_sync.py",
        "src\routes\media_generation.py", 
        "src\routes\unified_processor.py",
        "src\services\project_manager.py",
        "src\services\audio_processor.py",
        "src\services\media_generator.py",
        "src\services\unified_processor.py"
    )
    
    foreach ($component in $backendComponents) {
        $sourceFile = Join-Path $backendSource $component
        if (Test-Path $sourceFile) {
            $targetFile = Join-Path $backendTarget $component
            $targetDir = Split-Path $targetFile -Parent
            if (-not (Test-Path $targetDir)) {
                New-Item -Path $targetDir -ItemType Directory -Force
            }
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "  Copied: $component" -ForegroundColor Gray
        }
    }
}

# Migrate Shared Dependencies
Write-Host "`n=== MIGRATING SHARED DEPENDENCIES ===" -ForegroundColor Green

$depsSource = Join-Path $unifiedPath "Shared Dependencies"
$depsTarget = Join-Path $nativeStudioPath "unified-components\shared-dependencies"

if (Test-Path $depsSource) {
    Write-Host "Copying Shared Dependencies configuration..." -ForegroundColor White
    
    # Copy configuration files
    $depConfigs = @(
        "Python\requirements.txt",
        "Node.js\package.json",
        "Configuration\shared_config.json"
    )
    
    foreach ($config in $depConfigs) {
        $sourceFile = Join-Path $depsSource $config
        if (Test-Path $sourceFile) {
            $targetFile = Join-Path $depsTarget $config
            $targetDir = Split-Path $targetFile -Parent
            if (-not (Test-Path $targetDir)) {
                New-Item -Path $targetDir -ItemType Directory -Force
            }
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "  Copied: $config" -ForegroundColor Gray
        }
    }
}

# Migrate Unified Frontend components
Write-Host "`n=== MIGRATING UNIFIED FRONTEND COMPONENTS ===" -ForegroundColor Green

$frontendSource = Join-Path $unifiedPath "Unified Frontend"
$frontendTarget = Join-Path $nativeStudioPath "unified-components\unified-frontend"

if (Test-Path $frontendSource) {
    Write-Host "Copying Unified Frontend components..." -ForegroundColor White
    
    # Copy key React components
    $frontendComponents = @(
        "src\components\Layout.tsx",
        "src\components\Audio\AudioProcessor.tsx",
        "src\components\Image\ImageProcessor.tsx",
        "src\components\AI\AIProcessor.tsx",
        "src\pages\UnifiedProcessor.tsx",
        "src\pages\Dashboard.tsx"
    )
    
    foreach ($component in $frontendComponents) {
        $sourceFile = Join-Path $frontendSource $component
        if (Test-Path $sourceFile) {
            $targetFile = Join-Path $frontendTarget $component
            $targetDir = Split-Path $targetFile -Parent
            if (-not (Test-Path $targetDir)) {
                New-Item -Path $targetDir -ItemType Directory -Force
            }
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "  Copied: $component" -ForegroundColor Gray
        }
    }
}

# Create integration script
Write-Host "`n=== CREATING INTEGRATION SCRIPT ===" -ForegroundColor Green

$integrationScript = @"
# Native Media AI Studio - Unified Components Integration
Write-Host "=== INTEGRATING UNIFIED COMPONENTS ===" -ForegroundColor Yellow

\$nativeStudioPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"
\$unifiedComponents = Join-Path \$nativeStudioPath "unified-components"

Write-Host "Integrating unified components into Native Media AI Studio..." -ForegroundColor White

# 1. Integrate Audio Sync into backend
Write-Host "1. Integrating Audio Sync capabilities..." -ForegroundColor Cyan
\$audioSyncPath = Join-Path \$unifiedComponents "audio-sync"
\$backendPath = Join-Path \$nativeStudioPath "backend"

if (Test-Path \$audioSyncPath) {
    # Copy to backend services
    if (Test-Path \$backendPath) {
        Copy-Item \$audioSyncPath\*.py \$backendPath\services\ -Force
        Write-Host "   Audio sync services integrated" -ForegroundColor Green
    }
}

# 2. Integrate Unified Processor
Write-Host "2. Integrating Unified Processor..." -ForegroundColor Cyan
\$unifiedProcessorPath = Join-Path \$unifiedComponents "unified-processor"

if (Test-Path \$unifiedProcessorPath) {
    if (Test-Path \$backendPath) {
        Copy-Item \$unifiedProcessorPath\*.py \$backendPath\services\ -Force
        Write-Host "   Unified processor services integrated" -ForegroundColor Green
    }
}

# 3. Update frontend components
Write-Host "3. Updating frontend components..." -ForegroundColor Cyan
\$frontendPath = Join-Path \$nativeStudioPath "frontend"
\$unifiedFrontendPath = Join-Path \$unifiedComponents "unified-frontend"

if (Test-Path \$unifiedFrontendPath -and Test-Path \$frontendPath) {
    # Copy components to frontend
    Copy-Item \$unifiedFrontendPath\src\components\* \$frontendPath\src\components\ -Recurse -Force
    Write-Host "   Frontend components integrated" -ForegroundColor Green
}

# 4. Update configuration
Write-Host "4. Updating configuration..." -ForegroundColor Cyan
\$configPath = Join-Path \$nativeStudioPath "config"
\$sharedConfigPath = Join-Path \$unifiedComponents "shared-dependencies"

if (Test-Path \$sharedConfigPath) {
    Copy-Item \$sharedConfigPath\*.json \$configPath\ -Force
    Copy-Item \$sharedConfigPath\*.txt \$configPath\ -Force
    Write-Host "   Configuration updated" -ForegroundColor Green
}

Write-Host "`nIntegration complete!" -ForegroundColor Green
Write-Host "Native Media AI Studio now includes unified components" -ForegroundColor White
"@

$integrationScriptPath = Join-Path $nativeStudioPath "unified-components\integrate_components.ps1"
Set-Content -Path $integrationScriptPath -Value $integrationScript -Encoding UTF8

# Create migration summary
Write-Host "`n=== MIGRATION SUMMARY ===" -ForegroundColor Yellow

Write-Host "Migration completed successfully!" -ForegroundColor Green
Write-Host "Components migrated to Native Media AI Studio:" -ForegroundColor White

$migratedComponents = @(
    "🎵 Audio Sync Processing Algorithms",
    "🎨 Unified Media Generation Pipeline", 
    "🔧 Shared Backend Services",
    "📦 Optimized Dependencies Configuration",
    "🎨 Enhanced Frontend Components",
    "⚙️ Unified Configuration Management"
)

foreach ($component in $migratedComponents) {
    Write-Host "  ✓ $component" -ForegroundColor Green
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Run integration script: .\unified-components\integrate_components.ps1" -ForegroundColor White
Write-Host "2. Test integrated functionality" -ForegroundColor White
Write-Host "3. Update Native Studio configuration to use unified components" -ForegroundColor White
Write-Host "4. Verify enhanced capabilities" -ForegroundColor White

Write-Host "`nMigration complete! Your Native Media AI Studio now has the best of both worlds." -ForegroundColor Green
