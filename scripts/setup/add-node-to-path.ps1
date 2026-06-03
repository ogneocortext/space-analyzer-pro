# Space Analyzer - Find and Add Node.js to PATH
# Run this in PowerShell as Administrator

$nodePath = "C:\nvm4w\nodejs"

# Check if Node.js exists
if (Test-Path "$nodePath\node.exe") {
    Write-Host "Found Node.js at: $nodePath" -ForegroundColor Green

    # Get current PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

    # Check if already in PATH
    if ($currentPath -like "*$nodePath*") {
        Write-Host "Node.js is already in your PATH" -ForegroundColor Yellow
    } else {
        # Add to PATH
        $newPath = "$currentPath;$nodePath"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Added Node.js to PATH" -ForegroundColor Green
        Write-Host "You may need to restart your terminal" -ForegroundColor Cyan
    }
} else {
    Write-Host "Node.js not found at: $nodePath" -ForegroundColor Red
    Write-Host "Searching for node.exe..."

    # Search common locations
    $locations = @(
        "C:\Program Files\nodejs",
        "$env:LOCALAPPDATA\Programs\node",
        "$env:APPDATA\npm"
    )

    foreach ($loc in $locations) {
        if (Test-Path "$loc\node.exe") {
            Write-Host "Found at: $loc" -ForegroundColor Green
        }
    }
}

# Test node
Write-Host "`nTesting Node.js..."
& "$nodePath\node.exe" --version