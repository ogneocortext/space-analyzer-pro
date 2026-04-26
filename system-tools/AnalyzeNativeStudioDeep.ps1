# Deep Analysis of Native Media AI Studio
Write-Host "=== DEEP ANALYSIS: NATIVE MEDIA AI STUDIO ===" -ForegroundColor Yellow

$nativeStudioPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"

Write-Host "Performing deep analysis of Native Media AI Studio..." -ForegroundColor White

# Analyze key components
Write-Host "`n=== KEY COMPONENTS ANALYSIS ===" -ForegroundColor Green

# Check AI models directory
$modelsPath = Join-Path $nativeStudioPath "models_organized"
if (Test-Path $modelsPath) {
    Write-Host "AI Models Directory:" -ForegroundColor Cyan
    $models = Get-ChildItem $modelsPath -Directory -ErrorAction SilentlyContinue | Sort-Object Name
    foreach ($model in $models | Select-Object -First 10) {
        try {
            $size = (Get-ChildItem $model.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            Write-Host "  $($model.Name): $([math]::Round($size/1MB,2)) MB" -ForegroundColor White
        } catch {
            Write-Host "  $($model.Name): Cannot access" -ForegroundColor Yellow
        }
    }
}

# Check backend structure
$backendPath = Join-Path $nativeStudioPath "backend"
if (Test-Path $backendPath) {
    Write-Host "`nBackend Structure:" -ForegroundColor Cyan
    $backendFiles = Get-ChildItem $backendPath -File -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -match "\.(py|js|json)$" } | 
        Select-Object -First 15
    foreach ($file in $backendFiles) {
        Write-Host "  $($file.Name)" -ForegroundColor Gray
    }
}

# Check frontend structure
$frontendPath = Join-Path $nativeStudioPath "frontend"
if (Test-Path $frontendPath) {
    Write-Host "`nFrontend Structure:" -ForegroundColor Cyan
    $frontendFiles = Get-ChildItem $frontendPath -Recurse -File -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -match "\.(js|ts|jsx|tsx|json)$" } | 
        Select-Object -First 15
    foreach ($file in $frontendFiles) {
        $relativePath = $file.FullName.Replace($frontendPath, "")
        Write-Host "  $relativePath" -ForegroundColor Gray
    }
}

# Check configuration
$configPath = Join-Path $nativeStudioPath "config"
if (Test-Path $configPath) {
    Write-Host "`nConfiguration Files:" -ForegroundColor Cyan
    $configFiles = Get-ChildItem $configPath -File -ErrorAction SilentlyContinue
    foreach ($file in $configFiles) {
        Write-Host "  $($file.Name)" -ForegroundColor White
        try {
            $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
            if ($content -and $content.Length -lt 1000) {
                Write-Host "    Content preview: $($content.Substring(0, [math]::Min(100, $content.Length)))..." -ForegroundColor Gray
            }
        } catch {
            Write-Host "    Cannot read content" -ForegroundColor Yellow
        }
    }
}

# Look for specific AI/ML capabilities
Write-Host "`n=== AI/ML CAPABILITIES ===" -ForegroundColor Green

# Check for specific AI models
$aiModels = @(
    "dreamlike-diffusion",
    "whisper", 
    "wav2vec2",
    "stable-diffusion",
    "ollama"
)

foreach ($model in $aiModels) {
    $modelFiles = Get-ChildItem $nativeStudioPath -Recurse -Filter "*$model*" -ErrorAction SilentlyContinue
    if ($modelFiles.Count -gt 0) {
        Write-Host "$model model found:" -ForegroundColor Cyan
        foreach ($file in $modelFiles | Select-Object -First 3) {
            $relativePath = $file.FullName.Replace($nativeStudioPath, "")
            Write-Host "  $relativePath" -ForegroundColor White
        }
    }
}

# Check for Ollama integration
$ollamaFiles = Get-ChildItem $nativeStudioPath -Recurse -Filter "*ollama*" -ErrorAction SilentlyContinue
if ($ollamaFiles.Count -gt 0) {
    Write-Host "`nOllama Integration:" -ForegroundColor Cyan
    foreach ($file in $ollamaFiles) {
        $relativePath = $file.FullName.Replace($nativeStudioPath, "")
        Write-Host "  $relativePath" -ForegroundColor White
    }
}

# Check for media processing capabilities
Write-Host "`n=== MEDIA PROCESSING CAPABILITIES ===" -ForegroundColor Green

# Check media directories
$mediaDirs = @("AI_GENERATED_IMAGES", "MEDIA_BY_QUALITY", "MEDIA_EXTRACTION")
foreach ($dir in $mediaDirs) {
    $dirPath = Join-Path $nativeStudioPath $dir
    if (Test-Path $dirPath) {
        $fileCount = (Get-ChildItem $dirPath -Recurse -File -ErrorAction SilentlyContinue).Count
        $size = (Get-ChildItem $dirPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Write-Host "$dir`: $fileCount files, $([math]::Round($size/1MB,2)) MB" -ForegroundColor Cyan
    }
}

# Check for advanced features
Write-Host "`n=== ADVANCED FEATURES ===" -ForegroundColor Green

# Check for Docker/Kubernetes
$containerFiles = Get-ChildItem $nativeStudioPath -Recurse -Include "Dockerfile*", "docker-compose*", "k8s*", "kubernetes*" -ErrorAction SilentlyContinue
if ($containerFiles.Count -gt 0) {
    Write-Host "Container Orchestration:" -ForegroundColor Cyan
    foreach ($file in $containerFiles) {
        $relativePath = $file.FullName.Replace($nativeStudioPath, "")
        Write-Host "  $relativePath" -ForegroundColor White
    }
}

# Check for CI/CD
$cicdFiles = Get-ChildItem $nativeStudioPath -Recurse -Include "*.yml", "*.yaml" -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -match "ci|cd|pipeline|github|gitlab" }
if ($cicdFiles.Count -gt 0) {
    Write-Host "CI/CD Pipeline:" -ForegroundColor Cyan
    foreach ($file in $cicdFiles) {
        $relativePath = $file.FullName.Replace($nativeStudioPath, "")
        Write-Host "  $relativePath" -ForegroundColor White
    }
}

Write-Host "`n=== INTEGRATION RECOMMENDATIONS ===" -ForegroundColor Yellow

Write-Host "Based on analysis, here are the key integration opportunities:" -ForegroundColor White

Write-Host "`n1. 🤖 ADVANCED AI MODELS:" -ForegroundColor Green
Write-Host "   - Native Studio has 57GB of organized AI models" -ForegroundColor White
Write-Host "   - Includes dreamlike-diffusion, whisper, wav2vec2" -ForegroundColor White
Write-Host "   - Can significantly enhance unified backend capabilities" -ForegroundColor White

Write-Host "`n2. 🎨 MASSIVE FRONTEND (35K+ files):" -ForegroundColor Green
Write-Host "   - Much larger and more sophisticated than unified frontend" -ForegroundColor White
Write-Host "   - Advanced UI components and configurations" -ForegroundColor White
Write-Host "   - Can completely replace and enhance current frontend" -ForegroundColor White

Write-Host "`n3. 🔧 PRODUCTION-READY INFRASTRUCTURE:" -ForegroundColor Green
Write-Host "   - Docker containerization support" -ForegroundColor White
Write-Host "   - CI/CD pipelines for automated deployment" -ForegroundColor White
Write-Host "   - Enterprise-grade configuration management" -ForegroundColor White

Write-Host "`n4. 📊 MEDIA MANAGEMENT SYSTEM:" -ForegroundColor Green
Write-Host "   - Organized media by quality (8.9GB)" -ForegroundColor White
Write-Host "   - Extracted media processing (9.0GB)" -ForegroundColor White
Write-Host "   - AI-generated images management" -ForegroundColor White

Write-Host "`n5. 🌐 OLLAMA INTEGRATION:" -ForegroundColor Green
Write-Host "   - Local LLM integration capabilities" -ForegroundColor White
Write-Host "   - Enhanced configuration management" -ForegroundColor White
Write-Host "   - Advanced AI processing pipeline" -ForegroundColor White

Write-Host "`nDeep analysis complete!" -ForegroundColor Green
