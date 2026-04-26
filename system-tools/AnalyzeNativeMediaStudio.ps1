# Analyze Native Media AI Studio for Integration Opportunities
Write-Host "=== ANALYZING NATIVE MEDIA AI STUDIO ===" -ForegroundColor Yellow

$nativeStudioPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"
$unifiedPath = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools"

Write-Host "Analyzing Native Media AI Studio structure..." -ForegroundColor White
Write-Host "Path: $nativeStudioPath" -ForegroundColor Cyan
Write-Host "Comparing with unified structure at: $unifiedPath" -ForegroundColor Cyan

# Function to analyze directory structure
function Analyze-DirectoryStructure($path, $name) {
    Write-Host "`n=== ANALYZING: $name ===" -ForegroundColor Green
    
    if (-not (Test-Path $path)) {
        Write-Host "Directory does not exist!" -ForegroundColor Red
        return $null
    }
    
    $analysis = @{}
    
    # Get basic info
    $totalFiles = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue).Count
    $totalDirs = (Get-ChildItem $path -Recurse -Directory -ErrorAction SilentlyContinue).Count
    
    try {
        $totalSize = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    } catch {
        $totalSize = 0
    }
    
    Write-Host "Files: $totalFiles | Directories: $totalDirs | Size: $([math]::Round($totalSize/1MB,2)) MB" -ForegroundColor White
    
    # Analyze file types
    Write-Host "File Types:" -ForegroundColor Cyan
    $fileTypes = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | 
        Group-Object Extension | 
        Sort-Object Count -Descending | 
        Select-Object -First 15
    
    foreach ($type in $fileTypes) {
        $ext = if ([string]::IsNullOrEmpty($type.Name)) { "[No Extension]" } else { $type.Name }
        $size = ($type.Group | Measure-Object -Property Length -Sum).Sum
        Write-Host "  $ext`: $($type.Count) files, $([math]::Round($size/1MB,2)) MB" -ForegroundColor Gray
    }
    
    # Look for key directories
    Write-Host "Key Directories:" -ForegroundColor Cyan
    $keyDirs = Get-ChildItem $path -Directory -ErrorAction SilentlyContinue | 
        Where-Object { $_.GetFiles().Count -gt 5 -or $_.GetDirectories().Count -gt 2 } |
        Sort-Object Name |
        Select-Object -First 15
    
    foreach ($dir in $keyDirs) {
        try {
            $size = (Get-ChildItem $dir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            $fileCount = (Get-ChildItem $dir.FullName -Recurse -File -ErrorAction SilentlyContinue).Count
            Write-Host "  $($dir.Name): $fileCount files, $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
        } catch {
            Write-Host "  $($dir.Name): Cannot access" -ForegroundColor Yellow
        }
    }
    
    # Look for configuration files
    Write-Host "Configuration Files:" -ForegroundColor Cyan
    $configFiles = Get-ChildItem $path -Recurse -Include "*.json","*.config","*.xml","*.yml","*.yaml","*.env","*.ini","*.toml" -ErrorAction SilentlyContinue
    if ($configFiles.Count -gt 0) {
        Write-Host "Found $($configFiles.Count) configuration files" -ForegroundColor White
        foreach ($config in $configFiles | Select-Object -First 5) {
            Write-Host "  $($config.Name)" -ForegroundColor Gray
        }
    }
    
    # Look for main application files
    Write-Host "Main Application Files:" -ForegroundColor Cyan
    $mainFiles = Get-ChildItem $path -Recurse -Include "main.py","app.py","index.py","server.py","client.py" -ErrorAction SilentlyContinue
    if ($mainFiles.Count -gt 0) {
        foreach ($main in $mainFiles) {
            Write-Host "  $($main.Name)" -ForegroundColor White
        }
    }
    
    # Look for AI/ML related files
    Write-Host "AI/ML Files:" -ForegroundColor Cyan
    $aiFiles = Get-ChildItem $path -Recurse -Include "*.py" -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -match "ai|ml|model|neural|tensor|torch" -or 
                  (Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue) -match "import (tensorflow|torch|sklearn|opencv)" } |
        Select-Object -First 10
    
    foreach ($aiFile in $aiFiles) {
        Write-Host "  $($aiFile.Name)" -ForegroundColor White
    }
    
    # Look for frontend files
    Write-Host "Frontend Files:" -ForegroundColor Cyan
    $frontendFiles = Get-ChildItem $path -Recurse -Include "*.tsx","*.ts","*.jsx","*.js","*.html","*.css","*.vue" -ErrorAction SilentlyContinue
    if ($frontendFiles.Count -gt 0) {
        Write-Host "Found $($frontendFiles.Count) frontend files" -ForegroundColor White
        foreach ($frontend in $frontendFiles | Select-Object -First 5) {
            Write-Host "  $($frontend.Name)" -ForegroundColor Gray
        }
    }
    
    return @{
        Name = $name
        Path = $path
        TotalFiles = $totalFiles
        TotalDirs = $totalDirs
        TotalSize = $totalSize
        FileTypes = $fileTypes
        KeyDirectories = $keyDirs
        ConfigFiles = $configFiles
        MainFiles = $mainFiles
        AIFiles = $aiFiles
        FrontendFiles = $frontendFiles
    }
}

# Analyze Native Media AI Studio
$nativeAnalysis = Analyze-DirectoryStructure $nativeStudioPath "Native Media AI Studio"

# Analyze current unified structure
$unifiedAnalysis = Analyze-DirectoryStructure $unifiedPath "Current Unified Structure"

# Compare and identify integration opportunities
Write-Host "`n=== INTEGRATION OPPORTUNITIES ANALYSIS ===" -ForegroundColor Yellow

if ($nativeAnalysis -and $unifiedAnalysis) {
    Write-Host "Comparing structures for integration potential..." -ForegroundColor White
    
    # Compare file types
    Write-Host "`nFile Type Comparison:" -ForegroundColor Cyan
    $nativeTypes = $nativeAnalysis.FileTypes | ForEach-Object { $_.Name }
    $unifiedTypes = $unifiedAnalysis.FileTypes | ForEach-Object { $_.Name }
    $commonTypes = $nativeTypes | Where-Object { $_ -in $unifiedTypes }
    $uniqueToNative = $nativeTypes | Where-Object { $_ -notin $unifiedTypes }
    $uniqueToUnified = $unifiedTypes | Where-Object { $_ -notin $nativeTypes }
    
    Write-Host "Common file types ($($commonTypes.Count)):" -ForegroundColor Green
    Write-Host "  $($commonTypes -join ', ')" -ForegroundColor Gray
    
    Write-Host "Unique to Native Studio ($($uniqueToNative.Count)):" -ForegroundColor Yellow
    Write-Host "  $($uniqueToNative -join ', ')" -ForegroundColor Gray
    
    Write-Host "Unique to Unified ($($uniqueToUnified.Count)):" -ForegroundColor Yellow
    Write-Host "  $($uniqueToUnified -join ', ')" -ForegroundColor Gray
    
    # Analyze AI/ML capabilities
    Write-Host "`nAI/ML Capabilities Comparison:" -ForegroundColor Cyan
    Write-Host "Native Studio AI Files: $($nativeAnalysis.AIFiles.Count)" -ForegroundColor White
    Write-Host "Unified Structure AI Files: $($unifiedAnalysis.AIFiles.Count)" -ForegroundColor White
    
    # Analyze frontend capabilities
    Write-Host "`nFrontend Capabilities Comparison:" -ForegroundColor Cyan
    Write-Host "Native Studio Frontend Files: $($nativeAnalysis.FrontendFiles.Count)" -ForegroundColor White
    Write-Host "Unified Structure Frontend Files: $($unifiedAnalysis.FrontendFiles.Count)" -ForegroundColor White
    
    # Look for specific integration opportunities
    Write-Host "`n=== SPECIFIC INTEGRATION OPPORTUNITIES ===" -ForegroundColor Yellow
    
    Write-Host "1. AI Model Integration:" -ForegroundColor Green
    Write-Host "   - Native Studio may have newer/better AI models" -ForegroundColor White
    Write-Host "   - Can integrate advanced models into unified backend" -ForegroundColor White
    
    Write-Host "2. Frontend Enhancement:" -ForegroundColor Green
    Write-Host "   - Native Studio may have better UI components" -ForegroundColor White
    Write-Host "   - Can enhance unified frontend with better UX" -ForegroundColor White
    
    Write-Host "3. Processing Pipeline:" -ForegroundColor Green
    Write-Host "   - Native Studio may have improved algorithms" -ForegroundColor White
    Write-Host "   - Can upgrade unified processing capabilities" -ForegroundColor White
    
    Write-Host "4. Configuration Management:" -ForegroundColor Green
    Write-Host "   - Native Studio may have better config system" -ForegroundColor White
    Write-Host "   - Can improve unified configuration" -ForegroundColor White
}

Write-Host "`nAnalysis complete!" -ForegroundColor Green
