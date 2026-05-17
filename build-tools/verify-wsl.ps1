# WSL Verification Script
Write-Host "Verifying WSL and Hyper-V setup..."

# Check if WSL is working
try {
    wsl --version
    Write-Host "✅ WSL is installed"
} catch {
    Write-Host "❌ WSL not found - please restart after enabling Hyper-V"
    exit 1
}

# Try to start Ubuntu
try {
    wsl -d Ubuntu -- echo "✅ WSL Ubuntu is working!"
    $wslWorking = $true
} catch {
    Write-Host "❌ WSL Ubuntu not ready - trying to start..."
    wsl -d Ubuntu
    $wslWorking = $false
}

if ($wslWorking) {
    Write-Host ""
    Write-Host "🐧 WSL is ready! Building Space Analyzer Pro in Linux..."
    
    # Build in WSL to bypass Windows dependency issues
    wsl -d Ubuntu -- bash -c "
        cd '/mnt/e/Self Built Web and Mobile Apps/Space Analyzer'
        
        # Install Rust if not present
        if ! command -v cargo &> /dev/null; then
            echo 'Installing Rust...'
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
            source ~/.cargo/env
        fi
        
        # Install Node.js if not present  
        if ! command -v npm &> /dev/null; then
            echo 'Installing Node.js...'
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        
        echo 'Building Space Analyzer Pro in Linux environment...'
        cd src-tauri
        source ~/.cargo/env
        cargo build
        
        if [ \$? -eq 0 ]; then
            echo '✅ Build successful! Starting Space Analyzer Pro...'
            cargo tauri dev
        else
            echo '❌ Build failed in WSL'
        fi
    "
} else {
    Write-Host ""
    Write-Host "🔄 Please restart your computer and run this script again."
    Write-Host "If issues persist, run: wsl --install"
}