# Analyze Directory Merge Potential
Write-Host "=== DIRECTORY MERGE ANALYSIS ===" -ForegroundColor Yellow

$dir1 = "E:\Self Built Web and Web and Mobile Apps\Music Sync 2 Video App"
$dir2 = "E:\Self Built Web and Web and Mobile Apps\Simplified Media Generator"

Write-Host "Analyzing directories for merge potential..." -ForegroundColor White
Write-Host "Directory 1: Music Sync 2 Video App" -ForegroundColor Cyan
Write-Host "Directory 2: Simplified Media Generator" -ForegroundColor Cyan

# Function to analyze directory
function Analyze-Directory($path, $name) {
    Write-Host "`n=== ANALYZING: $name ===" -ForegroundColor Green
    Write-Host "Path: $path" -ForegroundColor White
    
    if (-not (Test-Path $path)) {
        Write-Host "Directory does not exist!" -ForegroundColor Red
        return $null
    }
    
    try {
        # Get total size
        $totalSize = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "Total Size: $([math]::Round($totalSize/1MB,2)) MB ($([math]::Round($totalSize/1GB,2)) GB)" -ForegroundColor Yellow
        
        # Get file count
        $fileCount = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue).Count
        $dirCount = (Get-ChildItem $path -Recurse -Directory -ErrorAction SilentlyContinue).Count
        Write-Host "Files: $fileCount | Directories: $dirCount" -ForegroundColor Yellow
        
        # Analyze file types
        Write-Host "`nFile Types:" -ForegroundColor Cyan
        $fileTypes = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | 
            Group-Object Extension | 
            Sort-Object Count -Descending | 
            Select-Object -First 10
        
        foreach ($type in $fileTypes) {
            $ext = if ([string]::IsNullOrEmpty($type.Name)) { "[No Extension]" } else { $type.Name }
            $size = ($type.Group | Measure-Object -Property Length -Sum).Sum
            Write-Host "  $ext`: $($type.Count) files, $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
        }
        
        # Look for key directories
        Write-Host "`nKey Directories:" -ForegroundColor Cyan
        $keyDirs = Get-ChildItem $path -Directory -ErrorAction SilentlyContinue | 
            Where-Object { $_.GetFiles().Count -gt 5 -or $_.GetDirectories().Count -gt 2 } |
            Sort-Object { 
                try { (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } 
                catch { 0 } 
            } -Descending |
            Select-Object -First 10
        
        foreach ($dir in $keyDirs) {
            try {
                $size = (Get-ChildItem $dir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                Write-Host "  $($dir.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
            } catch {
                Write-Host "  $($dir.Name): Cannot access" -ForegroundColor Yellow
            }
        }
        
        # Look for configuration files
        Write-Host "`nConfiguration Files:" -ForegroundColor Cyan
        $configFiles = Get-ChildItem $path -Recurse -Include "*.json","*.config","*.xml","*.yml","*.yaml","*.env","*.ini" -ErrorAction SilentlyContinue
        if ($configFiles.Count -gt 0) {
            Write-Host "Found $($configFiles.Count) configuration files" -ForegroundColor White
            foreach ($config in $configFiles | Select-Object -First 5) {
                Write-Host "  $($config.Name)" -ForegroundColor Gray
            }
        } else {
            Write-Host "No configuration files found" -ForegroundColor Gray
        }
        
        # Look for dependencies
        Write-Host "`nDependencies:" -ForegroundColor Cyan
        $depDirs = @("node_modules", "venv", ".venv", "env", "packages", "lib", "libs")
        foreach ($depDir in $depDirs) {
            $depPath = Join-Path $path $depDir
            if (Test-Path $depPath) {
                try {
                    $size = (Get-ChildItem $depPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                    Write-Host "  $depDir`: $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
                } catch {
                    Write-Host "  $depDir`: Cannot access" -ForegroundColor Yellow
                }
            }
        }
        
        # Check for README or documentation
        Write-Host "`nDocumentation:" -ForegroundColor Cyan
        $docFiles = Get-ChildItem $path -Recurse -Include "README*","*.md","*.txt","CHANGELOG*","LICENSE*" -ErrorAction SilentlyContinue
        if ($docFiles.Count -gt 0) {
            Write-Host "Found $($docFiles.Count) documentation files" -ForegroundColor White
            foreach ($doc in $docFiles | Select-Object -First 3) {
                Write-Host "  $($doc.Name)" -ForegroundColor Gray
            }
        } else {
            Write-Host "No documentation files found" -ForegroundColor Gray
        }
        
        return @{
            Name = $name
            Path = $path
            Size = $totalSize
            FileCount = $fileCount
            DirCount = $dirCount
            FileTypes = $fileTypes
            HasDependencies = $depDirs | Where-Object { Test-Path (Join-Path $path $_) }
            HasConfig = $configFiles.Count -gt 0
            HasDocs = $docFiles.Count -gt 0
        }
        
    } catch {
        Write-Host "Error analyzing directory: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Analyze both directories
$analysis1 = Analyze-Directory $dir1 "Music Sync 2 Video App"
$analysis2 = Analyze-Directory $dir2 "Simplified Media Generator"

# Compare and provide merge recommendation
Write-Host "`n=== MERGE ANALYSIS & RECOMMENDATION ===" -ForegroundColor Yellow

if ($analysis1 -and $analysis2) {
    Write-Host "Directory Comparison:" -ForegroundColor White
    Write-Host "  $($analysis1.Name): $($analysis1.SizeMB) MB, $($analysis1.FileCount) files" -ForegroundColor Cyan
    Write-Host "  $($analysis2.Name): $($analysis2.SizeMB) MB, $($analysis2.FileCount) files" -ForegroundColor Cyan
    
    # Check for similarities
    Write-Host "`nSimilarity Analysis:" -ForegroundColor White
    
    # Compare file types
    $types1 = $analysis1.FileTypes | ForEach-Object { $_.Name }
    $types2 = $analysis2.FileTypes | ForEach-Object { $_.Name }
    $commonTypes = $types1 | Where-Object { $_ -in $types2 }
    
    if ($commonTypes.Count -gt 0) {
        Write-Host "Common file types: $($commonTypes.Count) types" -ForegroundColor Green
        Write-Host "  $($commonTypes -join ', ')" -ForegroundColor Gray
    } else {
        Write-Host "No common file types found" -ForegroundColor Yellow
    }
    
    # Check for similar dependencies
    $deps1 = $analysis1.HasDependencies | ForEach-Object { Split-Path $_ -Leaf }
    $deps2 = $analysis2.HasDependencies | ForEach-Object { Split-Path $_ -Leaf }
    $commonDeps = $deps1 | Where-Object { $_ -in $deps2 }
    
    if ($commonDeps.Count -gt 0) {
        Write-Host "Common dependencies: $($commonDeps -join ', ')" -ForegroundColor Green
        Write-Host "RECOMMENDATION: These projects appear related and could benefit from merging" -ForegroundColor Green
    } else {
        Write-Host "No common dependencies found" -ForegroundColor Yellow
        Write-Host "RECOMMENDATION: Projects appear unrelated - keep separate" -ForegroundColor Yellow
    }
    
    # Final recommendation
    Write-Host "`n=== FINAL RECOMMENDATION ===" -ForegroundColor Yellow
    
    if ($commonDeps.Count -gt 2 -or $commonTypes.Count -gt 5) {
        Write-Host "🟢 MERGE RECOMMENDED" -ForegroundColor Green
        Write-Host "Reason: High similarity in dependencies and/or file types" -ForegroundColor White
        Write-Host "Suggested approach:" -ForegroundColor Cyan
        Write-Host "  1. Create a new parent directory: 'Media Processing Tools'" -ForegroundColor White
        Write-Host "  2. Move both projects as subdirectories" -ForegroundColor White
        Write-Host "  3. Consider sharing common dependencies" -ForegroundColor White
    } else {
        Write-Host "🟡 KEEP SEPARATE" -ForegroundColor Yellow
        Write-Host "Reason: Low similarity - different purposes" -ForegroundColor White
        Write-Host "Suggested approach:" -ForegroundColor Cyan
        Write-Host "  1. Keep directories separate" -ForegroundColor White
        Write-Host "  2. Consider creating a parent category if desired" -ForegroundColor White
    }
}

Write-Host "`nAnalysis complete!" -ForegroundColor Green
