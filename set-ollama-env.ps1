# Set Ollama 0.21.2 optimization environment variables for Windows
# Run this script with PowerShell as administrator or user

Write-Host "Setting Ollama 0.21.2 optimization environment variables..." -ForegroundColor Green

# Set Flash Attention - Reduces KV cache VRAM by 30-50%
[Environment]::SetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", "1", "User")
Write-Host "✓ OLLAMA_FLASH_ATTENTION=1" -ForegroundColor Cyan

# Set Keep Alive - Prevents model reloads for faster subsequent requests
[Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "5m", "User")
Write-Host "✓ OLLAMA_KEEP_ALIVE=5m" -ForegroundColor Cyan

# Set Thread Optimization - Let Ollama decide optimal thread count
[Environment]::SetEnvironmentVariable("OLLAMA_NUM_THREAD", "0", "User")
Write-Host "✓ OLLAMA_NUM_THREAD=0" -ForegroundColor Cyan

# Set CUDA GPU Configuration - Use all available GPUs
[Environment]::SetEnvironmentVariable("CUDA_VISIBLE_DEVICES", "0,1", "User")
Write-Host "✓ CUDA_VISIBLE_DEVICES=0,1" -ForegroundColor Cyan

Write-Host ""
Write-Host "Environment variables set successfully!" -ForegroundColor Green
Write-Host "These variables will be applied to new terminal sessions." -ForegroundColor Yellow
Write-Host "Restart your terminal or Ollama server to apply changes." -ForegroundColor Yellow
Write-Host ""
Write-Host "To verify, run:" -ForegroundColor White
Write-Host "  echo %OLLAMA_FLASH_ATTENTION%" -ForegroundColor Gray
Write-Host "  echo %OLLAMA_KEEP_ALIVE%" -ForegroundColor Gray
