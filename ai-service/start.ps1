#!/usr/bin/env pwsh
# AI Service Startup Script for Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Space Analyzer AI Service..." -ForegroundColor Cyan

# Check if Python is installed
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "❌ Python not found. Please install Python 3.9+ from https://python.org" -ForegroundColor Red
    exit 1
}

# Check Python version
$version = & python --version 2>&1
Write-Host "📦 $version"

# Create virtual environment if it doesn't exist
if (-not (Test-Path "venv")) {
    Write-Host "📁 Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "🔌 Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
pip install -q -r requirements.txt

# Load environment variables
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^#][^=]*)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Start the service
Write-Host "🌐 Starting AI Service on port ${env:PYTHON_AI_PORT}..." -ForegroundColor Green
Write-Host "📖 API docs: http://localhost:${env:PYTHON_AI_PORT}/docs" -ForegroundColor Green
Write-Host ""

python main.py
