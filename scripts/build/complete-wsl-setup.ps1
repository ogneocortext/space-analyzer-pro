# Complete WSL Setup for Space Analyzer Pro
Write-Host "🔧 Setting up WSL for Space Analyzer Pro..."

# Check if WSL features are enabled
Write-Host "Checking Windows features..."
try {
    $vmPlatform = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
    $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsSubsystem
    
    Write-Host "Virtual Machine Platform: $($vmPlatform.State)"
    Write-Host "Windows Subsystem for Linux: $($wslFeature.State)"
    
    if ($vmPlatform.State -eq "Disabled" -or $wslFeature.State -eq "Disabled") {
        Write-Host ""
        Write-Host "❌ Some WSL features are still disabled"
        Write-Host "Please restart your computer after enabling the features"
        Write-Host "Then run this script again"
        exit 1
    }
} catch {
    Write-Host "Could not check feature status (requires admin)"
}

# Try to start WSL
Write-Host ""
Write-Host "Testing WSL connection..."
try {
    wsl -d Ubuntu -- echo "✅ WSL is working!"
    $wslWorking = $true
} catch {
    Write-Host "❌ WSL still not working - trying to fix..."
    Write-Host "Running: wsl --install --no-distribution"
    wsl --install --no-distribution
    Write-Host ""
    Write-Host "Please restart your computer and run this script again"
    exit 1
}

if ($wslWorking) {
    Write-Host ""
    Write-Host "🐧 WSL is ready! Setting up Space Analyzer Pro..."
    
    # Setup and build in WSL
    wsl -d Ubuntu -- bash -c "
        echo 'Updating package lists...'
        sudo apt update
        
        echo 'Installing build dependencies...'
        sudo apt install -y curl build-essential pkg-config libssl-dev
        
        # Install Rust
        if ! command -v cargo &> /dev/null; then
            echo 'Installing Rust...'
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
            source ~/.cargo/env
        fi
        
        # Install Node.js
        if ! command -v npm &> /dev/null; then
            echo 'Installing Node.js...'
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        
        echo 'Environment setup complete!'
        echo 'Rust version:' && cargo --version
        echo 'Node.js version:' && node --version
    "
    
    Write-Host ""
    Write-Host "🚀 Building Space Analyzer Pro in Linux..."
    
    # Build the project
    wsl -d Ubuntu -- bash -c "
        cd '/mnt/e/Self Built Web and Mobile Apps/Space Analyzer'
        source ~/.cargo/env
        
        echo 'Building Space Analyzer Pro...'
        cd src-tauri
        
        # Clean any previous builds
        cargo clean
        
        # Build the project
        cargo build
        
        if [ \$? -eq 0 ]; then
            echo ''
            echo '🎉 SUCCESS! Space Analyzer Pro built successfully!'
            echo ''
            echo 'Starting development server...'
            cargo tauri dev
        else
            echo ''
            echo '❌ Build failed. Trying alternative approach...'
            
            # Try building with different features
            cargo build --no-default-features
            
            if [ \$? -eq 0 ]; then
                echo '✅ Core build successful!'
                echo 'Starting with minimal features...'
                cargo tauri dev
            else
                echo '❌ Build failed completely'
                exit 1
            fi
        fi
    "
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 Space Analyzer Pro is now running in WSL!"
        Write-Host "The application should open in your browser shortly."
    } else {
        Write-Host ""
        Write-Host "❌ Build failed. Please check the error messages above."
    }
}