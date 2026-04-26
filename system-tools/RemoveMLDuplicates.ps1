# Remove Duplicate ML Libraries - Simple Version
Write-Host "=== DUPLICATE ML LIBRARIES CLEANUP ===" -ForegroundColor Yellow

# Find all dnnl.lib files
Write-Host "Finding dnnl.lib files..." -ForegroundColor White
$dnnlFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "dnnl.lib" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Join-Path "C:\Users\Aomega Imaging" $_
} | Where-Object { Test-Path $_ }

if ($dnnlFiles.Count -gt 1) {
    Write-Host "Found $($dnnlFiles.Count) dnnl.lib files:" -ForegroundColor Cyan
    $dnnlFiles | ForEach-Object {
        $size = [math]::Round((Get-Item $_).Length / 1MB, 2)
        Write-Host "  $_ - $size MB"
    }
    
    # Sort by modification time, keep the newest
    $sorted = $dnnlFiles | Sort-Object LastWriteTime -Descending
    $keep = $sorted[0]
    $remove = $sorted | Select-Object -Skip 1
    
    Write-Host "KEEPING: $keep (newest)" -ForegroundColor Green
    foreach ($file in $remove) {
        $size = [math]::Round((Get-Item $file).Length / 1MB, 2)
        Write-Host "REMOVING: $file - $size MB" -ForegroundColor Red
        Remove-Item $file -Force
        Write-Host "  Removed successfully" -ForegroundColor Green
    }
}

# Find all torch_cpu.dll files
Write-Host "`nFinding torch_cpu.dll files..." -ForegroundColor White
$torchFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "torch_cpu.dll" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Join-Path "C:\Users\Aomega Imaging" $_
} | Where-Object { Test-Path $_ }

if ($torchFiles.Count -gt 1) {
    Write-Host "Found $($torchFiles.Count) torch_cpu.dll files:" -ForegroundColor Cyan
    $torchFiles | ForEach-Object {
        $size = [math]::Round((Get-Item $_).Length / 1MB, 2)
        Write-Host "  $_ - $size MB"
    }
    
    # Sort by modification time, keep the newest
    $sorted = $torchFiles | Sort-Object LastWriteTime -Descending
    $keep = $sorted[0]
    $remove = $sorted | Select-Object -Skip 1
    
    Write-Host "KEEPING: $keep (newest)" -ForegroundColor Green
    foreach ($file in $remove) {
        $size = [math]::Round((Get-Item $file).Length / 1MB, 2)
        Write-Host "REMOVING: $file - $size MB" -ForegroundColor Red
        Remove-Item $file -Force
        Write-Host "  Removed successfully" -ForegroundColor Green
    }
}

# Find all llvmlite.dll files
Write-Host "`nFinding llvmlite.dll files..." -ForegroundColor White
$llvmFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "llvmlite.dll" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Join-Path "C:\Users\Aomega Imaging" $_
} | Where-Object { Test-Path $_ }

if ($llvmFiles.Count -gt 1) {
    Write-Host "Found $($llvmFiles.Count) llvmlite.dll files:" -ForegroundColor Cyan
    $llvmFiles | ForEach-Object {
        $size = [math]::Round((Get-Item $_).Length / 1MB, 2)
        Write-Host "  $_ - $size MB"
    }
    
    # Sort by modification time, keep the newest
    $sorted = $llvmFiles | Sort-Object LastWriteTime -Descending
    $keep = $sorted[0]
    $remove = $sorted | Select-Object -Skip 1
    
    Write-Host "KEEPING: $keep (newest)" -ForegroundColor Green
    foreach ($file in $remove) {
        $size = [math]::Round((Get-Item $file).Length / 1MB, 2)
        Write-Host "REMOVING: $file - $size MB" -ForegroundColor Red
        Remove-Item $file -Force
        Write-Host "  Removed successfully" -ForegroundColor Green
    }
}

Write-Host "`n=== CLEANUP COMPLETE ===" -ForegroundColor Green
Write-Host "Duplicate ML libraries have been removed. The newest copies were kept." -ForegroundColor Yellow
