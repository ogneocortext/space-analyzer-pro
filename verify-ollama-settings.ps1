Write-Host "=== Ollama 0.21.2 Settings Verification ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking Environment Variables:" -ForegroundColor Yellow
$flash = [Environment]::GetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", "User")
$keep = [Environment]::GetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "User")
$thread = [Environment]::GetEnvironmentVariable("OLLAMA_NUM_THREAD", "User")
$cuda = [Environment]::GetEnvironmentVariable("CUDA_VISIBLE_DEVICES", "User")

if ($flash) { Write-Host "  OLLAMA_FLASH_ATTENTION = $flash" -ForegroundColor Green } else { Write-Host "  OLLAMA_FLASH_ATTENTION not set" -ForegroundColor Red }
if ($keep) { Write-Host "  OLLAMA_KEEP_ALIVE = $keep" -ForegroundColor Green } else { Write-Host "  OLLAMA_KEEP_ALIVE not set" -ForegroundColor Red }
if ($thread) { Write-Host "  OLLAMA_NUM_THREAD = $thread" -ForegroundColor Green } else { Write-Host "  OLLAMA_NUM_THREAD not set" -ForegroundColor Red }
if ($cuda) { Write-Host "  CUDA_VISIBLE_DEVICES = $cuda" -ForegroundColor Green } else { Write-Host "  CUDA_VISIBLE_DEVICES not set" -ForegroundColor Red }
Write-Host ""

Write-Host "2. Checking Ollama Server Status:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -ErrorAction Stop
    Write-Host "  Ollama server is running" -ForegroundColor Green
    Write-Host "  Available models: $($response.models.Count)" -ForegroundColor White
} catch {
    Write-Host "  Ollama server is not running or not accessible" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "If variables show as set, restart your terminal and Ollama server." -ForegroundColor Yellow
