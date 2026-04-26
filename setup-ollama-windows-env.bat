@echo off
REM Ollama 0.21.2 Optimization Environment Variables for Windows
REM Run this script before starting Ollama to enable performance optimizations

echo Setting Ollama 0.21.2 optimization environment variables...

REM Flash Attention - Reduces KV cache VRAM by 30-50%
set OLLAMA_FLASH_ATTENTION=1

REM Keep Alive - Prevents model reloads for faster subsequent requests
set OLLAMA_KEEP_ALIVE=5m

REM Thread Optimization - Let Ollama decide optimal thread count
set OLLAMA_NUM_THREAD=0

REM CUDA GPU Configuration - Use all available GPUs
set CUDA_VISIBLE_DEVICES=0,1

echo.
echo Ollama optimization environment variables set:
echo - OLLAMA_FLASH_ATTENTION=1 (Reduces VRAM usage by 30-50%%)
echo - OLLAMA_KEEP_ALIVE=5m (Faster subsequent requests)
echo - OLLAMA_NUM_THREAD=0 (Auto thread optimization)
echo - CUDA_VISIBLE_DEVICES=0,1 (Multi-GPU support)
echo.
echo You can now start Ollama with: ollama serve
echo.
echo To make these changes permanent, add them to:
echo System Properties ^> Environment Variables ^> User Variables
