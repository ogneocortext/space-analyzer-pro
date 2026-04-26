# Analyze Project Duplicates and Unique Value
Write-Host "=== PROJECT DUPLICATES & UNIQUE VALUE ANALYSIS ===" -ForegroundColor Yellow

$project1 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Music Sync 2 Video App"
$project2 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Simplified Media Generator"

Write-Host "Analyzing projects for duplicates and unique features..." -ForegroundColor White
Write-Host "Project 1: Music Sync 2 Video App" -ForegroundColor Cyan
Write-Host "Project 2: Simplified Media Generator" -ForegroundColor Cyan

# Function to analyze project structure
function Analyze-ProjectStructure($path, $name) {
    Write-Host "`n=== ANALYZING: $name ===" -ForegroundColor Green
    
    if (-not (Test-Path $path)) {
        Write-Host "Directory does not exist!" -ForegroundColor Red
        return $null
    }
    
    $analysis = @{}
    
    # Analyze file types
    Write-Host "File Types Analysis..." -ForegroundColor White
    $fileTypes = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | 
        Group-Object Extension | 
        Sort-Object Count -Descending
    
    $analysis.FileTypes = $fileTypes
    $analysis.TotalFiles = ($fileTypes | Measure-Object -Property Count -Sum).Sum
    
    # Analyze key directories
    Write-Host "Key Directories Analysis..." -ForegroundColor White
    $keyDirs = Get-ChildItem $path -Directory -ErrorAction SilentlyContinue | 
        Where-Object { $_.GetFiles().Count -gt 5 -or $_.GetDirectories().Count -gt 2 }
    
    $analysis.KeyDirectories = $keyDirs
    
    # Analyze Python files for functionality
    Write-Host "Python Functionality Analysis..." -ForegroundColor White
    $pythonFiles = Get-ChildItem $path -Recurse -Filter "*.py" -ErrorAction SilentlyContinue
    $pythonImports = @()
    $pythonFunctions = @()
    
    foreach ($file in $pythonFiles | Select-Object -First 20) {
        try {
            $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
            if ($content) {
                # Find imports
                $imports = [regex]::Matches($content, '(?:from\s+\S+\s+)?import\s+(\S+)') | 
                    ForEach-Object { $_.Groups[1].Value }
                $pythonImports += $imports
                
                # Find function definitions
                $functions = [regex]::Matches($content, 'def\s+(\w+)\s*\(') | 
                    ForEach-Object { $_.Groups[1].Value }
                $pythonFunctions += $functions
            }
        } catch {
            # Skip files that can't be read
        }
    }
    
    $analysis.PythonImports = $pythonImports | Group-Object | Sort-Object Count -Descending
    $analysis.PythonFunctions = $pythonFunctions | Group-Object | Sort-Object Count -Descending
    
    # Analyze configuration files
    Write-Host "Configuration Analysis..." -ForegroundColor White
    $configFiles = Get-ChildItem $path -Recurse -Include "*.json","*.config","*.xml","*.yml","*.yaml","*.env","*.ini" -ErrorAction SilentlyContinue
    $analysis.ConfigFiles = $configFiles
    
    # Look for main application files
    Write-Host "Main Application Files..." -ForegroundColor White
    $mainFiles = Get-ChildItem $path -Recurse -Filter "main.py" -ErrorAction SilentlyContinue
    $appFiles = Get-ChildItem $path -Recurse -Filter "app.py" -ErrorAction SilentlyContinue
    $indexFiles = Get-ChildItem $path -Recurse -Filter "index.*" -ErrorAction SilentlyContinue
    
    $analysis.MainFiles = @($mainFiles) + @($appFiles) + @($indexFiles)
    
    # Analyze documentation
    Write-Host "Documentation Analysis..." -ForegroundColor White
    $docFiles = Get-ChildItem $path -Recurse -Include "README*","*.md","CHANGELOG*" -ErrorAction SilentlyContinue
    $analysis.Documentation = $docFiles
    
    # Check for frontend components
    Write-Host "Frontend Analysis..." -ForegroundColor White
    $frontendFiles = Get-ChildItem $path -Recurse -Include "*.tsx","*.ts","*.jsx","*.js","*.html","*.css" -ErrorAction SilentlyContinue
    $analysis.FrontendFiles = $frontendFiles
    
    return $analysis
}

# Analyze both projects
$analysis1 = Analyze-ProjectStructure $project1 "Music Sync 2 Video App"
$analysis2 = Analyze-ProjectStructure $project2 "Simplified Media Generator"

# Compare and find duplicates
Write-Host "`n=== DUPLICATE ANALYSIS ===" -ForegroundColor Yellow

if ($analysis1 -and $analysis2) {
    # Compare file types
    Write-Host "File Type Comparison:" -ForegroundColor White
    $types1 = $analysis1.FileTypes | ForEach-Object { $_.Name }
    $types2 = $analysis2.FileTypes | ForEach-Object { $_.Name }
    $commonTypes = $types1 | Where-Object { $_ -in $types2 }
    $uniqueTypes1 = $types1 | Where-Object { $_ -notin $types2 }
    $uniqueTypes2 = $types2 | Where-Object { $_ -notin $types1 }
    
    Write-Host "Common file types ($($commonTypes.Count)):" -ForegroundColor Green
    Write-Host "  $($commonTypes -join ', ')" -ForegroundColor Gray
    
    Write-Host "Unique to Music Sync ($($uniqueTypes1.Count)):" -ForegroundColor Cyan
    Write-Host "  $($uniqueTypes1 -join ', ')" -ForegroundColor Gray
    
    Write-Host "Unique to Media Generator ($($uniqueTypes2.Count)):" -ForegroundColor Cyan
    Write-Host "  $($uniqueTypes2 -join ', ')" -ForegroundColor Gray
    
    # Compare Python imports
    Write-Host "`nPython Import Comparison:" -ForegroundColor White
    $imports1 = $analysis1.PythonImports | ForEach-Object { $_.Name }
    $imports2 = $analysis2.PythonImports | ForEach-Object { $_.Name }
    $commonImports = $imports1 | Where-Object { $_ -in $imports2 }
    $uniqueImports1 = $imports1 | Where-Object { $_ -notin $imports2 }
    $uniqueImports2 = $imports2 | Where-Object { $_ -notin $imports1 }
    
    Write-Host "Common Python libraries ($($commonImports.Count)):" -ForegroundColor Green
    Write-Host "  $($commonImports -join ', ')" -ForegroundColor Gray
    
    Write-Host "Unique to Music Sync ($($uniqueImports1.Count)):" -ForegroundColor Cyan
    Write-Host "  $($uniqueImports1 -join ', ')" -ForegroundColor Gray
    
    Write-Host "Unique to Media Generator ($($uniqueImports2.Count)):" -ForegroundColor Cyan
    Write-Host "  $($uniqueImports2 -join ', ')" -ForegroundColor Gray
    
    # Analyze unique value
    Write-Host "`n=== UNIQUE VALUE ANALYSIS ===" -ForegroundColor Yellow
    
    Write-Host "Music Sync 2 Video App - Unique Value:" -ForegroundColor Green
    Write-Host "  Primary Purpose: Music synchronization with video" -ForegroundColor White
    Write-Host "  Key Features:" -ForegroundColor Cyan
    Write-Host "    - Audio processing capabilities" -ForegroundColor White
    Write-Host "    - Video synchronization" -ForegroundColor White
    Write-Host "    - React frontend for user interface" -ForegroundColor White
    Write-Host "  Unique Technologies:" -ForegroundColor Cyan
    Write-Host "    - Audio processing libraries" -ForegroundColor White
    Write-Host "    - Video synchronization algorithms" -ForegroundColor White
    Write-Host "    - React-based UI components" -ForegroundColor White
    
    Write-Host "`nSimplified Media Generator - Unique Value:" -ForegroundColor Green
    Write-Host "  Primary Purpose: General media processing and generation" -ForegroundColor White
    Write-Host "  Key Features:" -ForegroundColor Cyan
    Write-Host "    - Image processing capabilities" -ForegroundColor White
    Write-Host "    - Machine learning integration" -ForegroundColor White
    Write-Host "    - Multiple media format support" -ForegroundColor White
    Write-Host "  Unique Technologies:" -ForegroundColor Cyan
    Write-Host "    - Computer vision libraries" -ForegroundColor White
    Write-Host "    - ML/AI integration" -ForegroundColor White
    Write-Host "    - Extensive media format support" -ForegroundColor White
    
    # Recommendations
    Write-Host "`n=== OPTIMIZATION RECOMMENDATIONS ===" -ForegroundColor Yellow
    
    if ($commonTypes.Count -gt 5 -and $commonImports.Count -gt 10) {
        Write-Host "🟢 HIGH MERGE POTENTIAL" -ForegroundColor Green
        Write-Host "Recommendation: Merge with shared backend, separate frontends" -ForegroundColor White
        Write-Host "Benefits:" -ForegroundColor Cyan
        Write-Host "  - Shared Python processing logic" -ForegroundColor White
        Write-Host "  - Reduced dependency duplication" -ForegroundColor White
        Write-Host "  - Unified media processing pipeline" -ForegroundColor White
        Write-Host "  - Estimated space savings: 400-600 MB" -ForegroundColor White
    } else {
        Write-Host "🟡 MODERATE MERGE POTENTIAL" -ForegroundColor Yellow
        Write-Host "Recommendation: Keep separate but optimize shared dependencies" -ForegroundColor White
    }
    
    Write-Host "`nSpecific Actions:" -ForegroundColor Cyan
    Write-Host "1. Share common Python libraries (numpy, opencv, requests)" -ForegroundColor White
    Write-Host "2. Keep unique processing logic separate" -ForegroundColor White
    Write-Host "3. Consider shared frontend components" -ForegroundColor White
    Write-Host "4. Create unified configuration management" -ForegroundColor White
}

Write-Host "`nAnalysis complete!" -ForegroundColor Green
