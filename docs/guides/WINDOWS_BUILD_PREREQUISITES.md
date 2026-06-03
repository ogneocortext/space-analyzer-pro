# Windows Build Prerequisites

Complete guide for setting up the Windows development environment for Space Analyzer.

> **📝 Multi-Drive Setup**: If your build tools are on C: and D: drives, use `build-env.ps1` template to configure paths. Copy it to `build-env.ps1`, edit the paths, then run `.\build-env.ps1` before building.

---

## Required Software

### 1. Visual Studio 2022 (or Build Tools)

**Option A: Full Visual Studio 2022**

- Download from: https://visualstudio.microsoft.com/downloads/
- Workloads required:
  - **Desktop development with C++**
  - **Windows 10/11 SDK** (10.0.19041.0 or later)

**Option B: Visual Studio Build Tools (lighter)**

```powershell
# Using winget
winget install Microsoft.VisualStudio.2022.BuildTools

# Or download from:
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```

**Required components for Build Tools:**

- MSVC v143 - VS 2022 C++ x64/x86 build tools
- Windows 10/11 SDK (10.0.19041.0 or later)
- C++ CMake tools for Windows
- Git for Windows

### 2. Rust Toolchain

```powershell
# Using winget (recommended)
winget install Rustlang.Rustup

# Or download from https://rustup.rs/
```

**After installation, restart your terminal and run:**

```powershell
rustup default stable
rustup target add x86_64-pc-windows-msvc
```

### 3. Node.js and npm

```powershell
# Using winget
winget install OpenJS.NodeJS

# Verify installation
node --version  # Should be v18+
npm --version
```

### 4. WebView2 Runtime

Usually pre-installed on Windows 11. For Windows 10:

```powershell
# Check if installed
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

# If not installed, download from:
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

---

## Environment Setup

### Add to PATH

```powershell
# Rust (if not added automatically)
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

# Make permanent (add to user PATH)
[Environment]::SetEnvironmentVariable(
    "PATH",
    $env:PATH + ";$env:USERPROFILE\.cargo\bin",
    "User"
)
```

### Verify Installation

```powershell
# Check all tools are available
rustc --version    # Should show: rustc 1.75+ (any recent version)
cargo --version    # Should show: cargo 1.75+
node --version     # Should show: v18+
npm --version      # Should show: 9+

# Check Windows target is installed
rustup target list | findstr x86_64-pc-windows-msvc

# Should show: x86_64-pc-windows-msvc (installed)
```

---

## Build Tool Locations

If your build tools are installed across multiple drives (e.g., C: and D:), you must document their locations to prevent compilation errors. Update the paths below to match your actual installation locations.

### Default vs Custom Locations

| Tool                      | Default Location                                           | Your Location          |
| ------------------------- | ---------------------------------------------------------- | ---------------------- |
| Visual Studio Build Tools | `C:\Program Files\Microsoft Visual Studio\2022\BuildTools` | **\*\***\_\_\_**\*\*** |
| Rust/Cargo                | `C:\Users\<user>\.cargo`                                   | **\*\***\_\_\_**\*\*** |
| Node.js/npm               | `C:\Program Files\nodejs`                                  | **\*\***\_\_\_**\*\*** |
| Windows SDK               | `C:\Program Files (x86)\Windows Kits\10`                   | **\*\***\_\_\_**\*\*** |
| WebView2 Runtime          | System-wide (auto-detected)                                | **\*\***\_\_\_**\*\*** |

### Environment Configuration Template

Create a `build-env.ps1` file in your project root:

```powershell
# build-env.ps1 - Build Environment Configuration
# Edit these paths to match your installation locations

# Visual Studio Build Tools (adjust drive letter as needed)
$env:VS_BUILD_TOOLS_PATH = "C:\Program Files\Microsoft Visual Studio\2022\BuildTools"
# Or if on D: drive:
# $env:VS_BUILD_TOOLS_PATH = "D:\Program Files\Microsoft Visual Studio\2022\BuildTools"

# Rust/Cargo (if installed on custom drive)
$env:RUSTUP_HOME = "C:\Users\$env:USERNAME\.rustup"
$env:CARGO_HOME = "C:\Users\$env:USERNAME\.cargo"
# Or if on D: drive:
# $env:RUSTUP_HOME = "D:\rust\rustup"
# $env:CARGO_HOME = "D:\rust\cargo"

# Add tool paths to PATH
$env:PATH = "$env:VS_BUILD_TOOLS_PATH\VC\Tools\MSVC\14.35.32215\bin\Hostx64\x64;" + $env:PATH
$env:PATH = "$env:CARGO_HOME\bin;" + $env:PATH

Write-Host "✅ Build environment configured" -ForegroundColor Green
Write-Host "VS Tools: $env:VS_BUILD_TOOLS_PATH" -ForegroundColor Cyan
Write-Host "Rust: $env:CARGO_HOME" -ForegroundColor Cyan
```

### Finding Your Tool Locations

**Visual Studio Build Tools:**

```powershell
# Search across C: and D: drives
Get-ChildItem -Path "C:\", "D:\" -Recurse -Filter "vcvars64.bat" -ErrorAction SilentlyContinue

# Common locations to check:
# C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\
# D:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\
```

**Rust Installation:**

```powershell
# Check where rustup is installed
where.exe rustup
# or
Get-Command rustup | Select-Object Source

# Check environment variables
$env:RUSTUP_HOME
$env:CARGO_HOME
```

**Node.js/npm:**

```powershell
# Check Node installation location
where.exe node
where.exe npm

# Common locations:
# C:\Program Files\nodejs\
# D:\nodejs\
```

### Multi-Drive Setup Example

If your tools are split between C: and D: drives:

```powershell
# Example: Tools on D: drive, project on C:
$env:VS_BUILD_TOOLS_PATH = "D:\VS2022\BuildTools"
$env:RUSTUP_HOME = "D:\rust\rustup"
$env:CARGO_HOME = "D:\rust\cargo"
$env:NODE_HOME = "D:\nodejs"

# Update PATH
$env:PATH = "$env:VS_BUILD_TOOLS_PATH\VC\Tools\MSVC\14.35.32215\bin\Hostx64\x64;" + $env:PATH
$env:PATH = "$env:CARGO_HOME\bin;" + $env:PATH
$env:PATH = "$env:NODE_HOME;" + $env:PATH

# Verify
cl.exe  # Should show Microsoft C++ compiler version
cargo --version
node --version
```

### Common Multi-Drive Issues

**Issue**: `link.exe not found` despite VS being installed

- **Cause**: VS is on D: drive but PATH only looks on C:
- **Fix**: Add D: drive path to environment variables

**Issue**: `cargo` command not recognized

- **Cause**: Rust installed on D: but PATH points to C:
- **Fix**: Update `CARGO_HOME` and PATH to point to correct drive

**Issue**: `node` or `npm` not found

- **Cause**: Node.js installed on different drive than expected
- **Fix**: Locate with `where.exe node` and update PATH

---

## Building the Project

### 1. Native Rust Scanner

```powershell
cd "native\scanner"

# Debug build
cargo build

# Release build (optimized)
cargo build --release

# Copy to bin directory for backend use
copy target\release\space-analyzer.exe ..\..\bin\
```

### 2. Tauri Desktop App

```powershell
# From project root
npm install

# Install Tauri CLI
npm install -g @tauri-apps/cli

# Development mode
npm run tauri:dev

# Build Windows installer
npm run tauri:build:windows
```

---

## Troubleshooting

### Error: `link.exe not found`

**Solution**: Visual Studio Build Tools not installed or not in PATH

```powershell
# Option 1: Add to PATH for current session
$env:PATH += ";C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.35.32215\bin\Hostx64\x64"

# Option 2: Use vcvars64.bat
& "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

### Error: `error: target may not be installed`

**Solution**: Add Windows target to Rust

```powershell
rustup target add x86_64-pc-windows-msvc
```

### Error: `WebView2 not found`

**Solution**: Install WebView2 Runtime

1. Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
2. Install the Evergreen Standalone Installer

### Error: `cargo build` fails with missing dependencies

```powershell
# Update dependencies
cd native\scanner
cargo update
cargo build
```

### Error: `npm install` fails

```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

---

## Build Verification Script

Create `verify-windows-build.ps1`:

```powershell
# verify-windows-build.ps1
Write-Host "🔍 Verifying Windows Build Environment..." -ForegroundColor Cyan

# Check Rust
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    Write-Host "✅ Rust: $(rustc --version)" -ForegroundColor Green
} else {
    Write-Host "❌ Rust not found" -ForegroundColor Red
}

# Check Node
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "✅ Node: $(node --version)" -ForegroundColor Green
} else {
    Write-Host "❌ Node not found" -ForegroundColor Red
}

# Check Cargo target
$target = rustup target list | findstr "x86_64-pc-windows-msvc (installed)"
if ($target) {
    Write-Host "✅ Windows target installed" -ForegroundColor Green
} else {
    Write-Host "❌ Windows target not installed" -ForegroundColor Red
    Write-Host "   Run: rustup target add x86_64-pc-windows-msvc" -ForegroundColor Yellow
}

# Check Visual Studio
$vsPath = "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
if (Test-Path $vsPath) {
    Write-Host "✅ Visual Studio Build Tools found" -ForegroundColor Green
} else {
    Write-Host "❌ Visual Studio Build Tools not found" -ForegroundColor Red
}

# Check WebView2
$webview2 = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if ($webview2) {
    Write-Host "✅ WebView2 installed" -ForegroundColor Green
} else {
    Write-Host "⚠️ WebView2 not detected" -ForegroundColor Yellow
}

Write-Host "`n✨ Verification complete!" -ForegroundColor Cyan
```

Run with:

```powershell
.\verify-windows-build.ps1
```

---

## Quick Reference

| Tool        | Minimum Version | Verification Command     |
| ----------- | --------------- | ------------------------ |
| Rust        | 1.75.0          | `rustc --version`        |
| Node.js     | 18.x            | `node --version`         |
| npm         | 9.x             | `npm --version`          |
| Windows SDK | 10.0.19041.0    | Check in VS Installer    |
| WebView2    | 95+             | See registry check above |

---

## Related Documentation

- `native/scanner/BUILD.md` - Native scanner build instructions
- `WINDOWS-GUI-QUICKSTART.md` - Windows GUI setup guide
- `TAURI-GUI-README.md` - Full Tauri documentation
- `WINDOWS_GUI_ERROR_TRACKER.md` - Windows GUI issues

---

_Last Updated: 2026-05-04_
