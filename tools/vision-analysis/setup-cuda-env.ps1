# PowerShell script to activate the CUDA GPU environment for Space Analyzer vision analysis
# This sets up the conda environment with PyTorch CUDA 12.4 support for GTX 1070 Ti

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Space Analyzer - CUDA GPU Vision Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$EnvName = "space-analyzer-cuda"
$CondaExe = "C:\Users\Aomega Imaging\miniconda3\Scripts\conda.exe"

# Check if environment exists
$envExists = & $CondaExe env list | Select-String -Pattern "^$EnvName\s"

if (-not $envExists) {
    Write-Host "`nCreating conda environment '$EnvName'..." -ForegroundColor Yellow
    & $CondaExe create -n $EnvName python=3.12 -y
    
    Write-Host "`nInstalling PyTorch CUDA 12.4..." -ForegroundColor Yellow
    & $CondaExe run -n $EnvName pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
    
    Write-Host "`nInstalling vision analysis dependencies..." -ForegroundColor Yellow
    & $CondaExe run -n $EnvName pip install transformers timm accelerate scikit-learn pillow requests pydantic
} else {
    Write-Host "`nEnvironment '$EnvName' already exists." -ForegroundColor Green
}

# Verify CUDA
Write-Host "`nVerifying CUDA GPU setup..." -ForegroundColor Cyan
$verifyCmd = @"
import torch, sys
print(f"Python: {sys.version}")
print(f"PyTorch: {torch.__version__}")
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA Version: {torch.version.cuda}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB VRAM")
"@
$verifyResult = & $CondaExe run -n $EnvName python -c $verifyCmd
Write-Host $verifyResult

Write-Host "`nUsage examples:" -ForegroundColor Green
Write-Host "  conda activate $EnvName" -ForegroundColor White
Write-Host "  python tools/vision-analysis/gpu_vision_analyzer.py --benchmark" -ForegroundColor White
Write-Host "  python tools/vision-analysis/gpu_vision_analyzer.py <screenshot_dir>" -ForegroundColor White
Write-Host "  python tools/vision-analysis/gpu_vision_analyzer.py --single <image.png>" -ForegroundColor White