# Remove Duplicate ML Libraries Script
# This script safely identifies and removes duplicate ML libraries to recover space

Write-Host "=== DUPLICATE ML LIBRARIES CLEANUP ===" -ForegroundColor Yellow
Write-Host "Target Directory: C:\Users\Aomega Imaging" -ForegroundColor White
Write-Host ""

# Function to calculate file size in MB
function Get-SizeInMB($path) {
    return [math]::Round((Get-Item $path).Length / 1MB, 2)
}

# Function to safely remove duplicates (keep the newest one)
function Remove-DuplicateFiles($files, $description) {
    if ($files.Count -le 1) {
        Write-Host "No duplicates found for $description" -ForegroundColor Green
        return
    }
    
    Write-Host "Found $($files.Count) $description files:" -ForegroundColor Cyan
    
    # Sort by modification time (newest first)
    $sortedFiles = $files | Sort-Object LastWriteTime -Descending
    
    # Keep the newest, remove the rest
    $keepFile = $sortedFiles[0]
    $removeFiles = $sortedFiles | Select-Object -Skip 1
    
    Write-Host "  KEEPING: $($keepFile.FullName) - $(Get-SizeInMB $keepFile.FullName) MB (Newest)" -ForegroundColor Green
    
    $totalSpaceRecovered = 0
    foreach ($file in $removeFiles) {
        $size = Get-SizeInMB $file.FullName
        Write-Host "  REMOVING: $($file.FullName) - $size MB" -ForegroundColor Red
        
        # Safety check - ask for confirmation
        $confirm = Read-Host "Remove this file? (y/n)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Remove-Item $file.FullName -Force
            Write-Host "    ✓ Removed successfully" -ForegroundColor Green
            $totalSpaceRecovered += $size
        } else {
            Write-Host "    ✗ Skipped" -ForegroundColor Yellow
        }
    }
    
    Write-Host "Space recovered from $description`: $totalSpaceRecovered MB" -ForegroundColor Green
    Write-Host ""
}

# Search for duplicate ML libraries
try {
    # Find dnnl.lib files
    Write-Host "Searching for dnnl.lib files..." -ForegroundColor White
    $dnnlFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "dnnl.lib" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Join-Path "C:\Users\Aomega Imaging" $_
    } | Where-Object { Test-Path $_ }
    
    # Find torch_cpu.dll files
    Write-Host "Searching for torch_cpu.dll files..." -ForegroundColor White
    $torchFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "torch_cpu.dll" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Join-Path "C:\Users\Aomega Imaging" $_
    } | Where-Object { Test-Path $_ }
    
    # Find llvmlite.dll files
    Write-Host "Searching for llvmlite.dll files..." -ForegroundColor White
    $llvmFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Name "llvmlite.dll" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Join-Path "C:\Users\Aomega Imaging" $_
    } | Where-Object { Test-Path $_ }
    
    # Find other large ML libraries that might be duplicated
    Write-Host "Searching for other ML libraries..." -ForegroundColor White
    $otherMLFiles = Get-ChildItem -Path "C:\Users\Aomega Imaging" -Include "*.lib","*.dll" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -match "(torch|tensorflow|cuda|cudnn|mklnn)" -and $_.Length -gt 50MB } |
        Group-Object Name | Where-Object { $_.Count -gt 1 }
    
    Write-Host ""
    Write-Host "=== DUPLICATE ANALYSIS RESULTS ===" -ForegroundColor Yellow
    
    # Show duplicates and ask for removal
    Remove-DuplicateFiles $dnnlFiles "dnnl.lib"
    Remove-DuplicateFiles $torchFiles "torch_cpu.dll"
    Remove-DuplicateFiles $llvmFiles "llvmlite.dll"
    
    # Handle other ML libraries
    foreach ($group in $otherMLFiles) {
        $files = $group.Group | Sort-Object LastWriteTime -Descending
        Remove-DuplicateFiles $files "$($group.Name)"
    }
    
    Write-Host "=== CLEANUP COMPLETE ===" -ForegroundColor Green
    Write-Host "Note: Always keep at least one copy of each library for your Python environments to work properly." -ForegroundColor Yellow
    
} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please run this script as Administrator if you encounter permission issues." -ForegroundColor Yellow
}

Write-Host "Press any key to continue..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
