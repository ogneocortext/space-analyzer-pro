# Native Scanner Build Guide - Visual Studio 2026

This guide explains how to build the high-performance native file scanners using Visual Studio 2026.

## Overview

Three native scanners are available:

1. **C++ Native Scanner** (`src/cpp/native-scanner/`) - NAPI-based C++ scanner
2. **Rust Native Scanner** (`native/scanner/`) - Primary Rust scanner with NAPI bindings

## Prerequisites

- **Visual Studio 2026** (located on your D: drive)
- **Node.js** 18+ with npm
- **Rust** with cargo (latest stable)
- **Python** 3.10+ (for node-gyp)

### Setting Up VS2026 Environment

Open PowerShell and run:

```powershell
# Load VS2026 environment variables
& "D:\Path\To\VS2026\Common7\Tools\VsDevCmd.bat" -arch=x64

# Or for VS2026 Professional/Enterprise:
& "D:\Path\To\VS2026\VC\Auxiliary\Build\vcvars64.bat"
```

## Build Instructions

### 1. C++ Native Scanner

```powershell
cd "E:\Self Built Web and Mobile Apps\Space Analyzer\src\cpp\native-scanner"

# Install dependencies
npm install

# Configure for VS2026
npm run configure:vs2026

# Build Release (optimized)
npm run build:vs2026

# Or use node-gyp directly
npx node-gyp rebuild --release --msvs_version=2026
```

**Build Optimizations Applied:**
- C++20 standard (`/std:c++20`)
- AVX2 SIMD instructions (`/arch:AVX2`)
- Maximum speed optimization (`/O2`)
- Link-time optimization (`/GL`, `/LTCG`)
- Auto-parallelization (`/Qpar`)
- Fast floating-point (`/fp:fast`)

### 2. Rust Simple Scanner (Primary)

```powershell
cd "E:\Self Built Web and Mobile Apps\Space Analyzer\src\rust\simple-scanner"

# Update dependencies
cargo update

# Build optimized release
cargo build --release

# Or with explicit flags
$env:RUSTFLAGS="-C target-cpu=native"
cargo build --release

# Copy to project root (optional)
copy "target\release\scanner.node" "scanner.node"
```

**Build Optimizations Applied:**
- Native CPU targeting (`target-cpu=native`)
- Full LTO (`lto = true`)
- Single codegen unit (`codegen-units = 1`)
- Panic abort (`panic = "abort"`)
- Symbol stripping (`strip = true`)
- AVX2 and FMA instructions enabled

### 3. Rust Native Scanner (Alternative)

```powershell
cd "E:\Self Built Web and Mobile Apps\Space Analyzer\native\scanner"

# Build optimized release
cargo build --release
```

## Quick Build Script

Create `build-all.ps1` in project root:

```powershell
# Build all native scanners
$ErrorActionPreference = "Stop"

Write-Host "=== Building C++ Native Scanner ===" -ForegroundColor Cyan
cd "src\cpp\native-scanner"
npm install
npm run build:vs2026
cd "..\..\.."

Write-Host "=== Building Rust Simple Scanner ===" -ForegroundColor Cyan
cd "src\rust\simple-scanner"
cargo build --release
cd "..\..\.."

Write-Host "=== Building Rust Native Scanner ===" -ForegroundColor Cyan
cd "native\scanner"
cargo build --release
cd "..\.."

Write-Host "=== Build Complete ===" -ForegroundColor Green
```

## Code Improvements Made

### C++ Scanner

✅ **Fixed Issues:**
- Added missing `#include <unordered_map>`
- Made `total_size` atomic for thread safety
- Added `NDEBUG` guards around debug printf statements
- Added proper ScanResult constructor
- Updated binding.gyp for VS2026 with C++20 and AVX2
- Created `index.js` loader with fallback paths
- Added comprehensive package.json build scripts

### Rust Scanners

✅ **Fixed Issues:**
- Replaced problematic `sys-info` with `sysinfo` crate
- Fixed atomic ordering (Relaxed → SeqCst)
- Fixed time calculation bug (scan start time)
- Added proper thread join error handling
- Added release profiles with full optimizations
- Created `.cargo/config.toml` with native CPU flags
- Added missing dependencies (`crossbeam-channel`, `rustc_version_runtime`)
- Created `index.js` loader with multiple fallback paths
- Added comprehensive TypeScript definitions
- Removed redundant dependencies from package.json

## Performance Expectations

After building with VS2026 optimizations:

| Scanner | Expected Speedup | Features |
|---------|------------------|----------|
| **C++ Native** | 10-50x vs JS | AVX2, C++20, LTO |
| **Rust Simple** | 5-20x vs JS | Native CPU, LTO, Parallel |
| **Rust Native** | 3-10x vs JS | Rayon, Walkdir, Channels |

## Troubleshooting

### C++ Build Errors

**"Cannot find node-addon-api"**
```powershell
npm install node-addon-api
```

**"MSBuild not found"**
Ensure VS2026 environment is loaded:
```powershell
& "D:\Path\To\VS2026\VC\Auxiliary\Build\vcvars64.bat"
```

### Rust Build Errors

**"Linker error"**
Ensure Rust target is installed:
```powershell
rustup target add x86_64-pc-windows-msvc
```

**"Crate not found"**
Update dependencies:
```powershell
cargo update
```

### Runtime Errors

**"Module not found"**
Check that the `.node` file exists:
- C++: `src/cpp/native-scanner/build/Release/native_scanner.node`
- Rust: `src/rust/simple-scanner/scanner.node`

## Verification

Test the built modules:

```powershell
# Test C++ scanner
node -e "const cpp = require('./src/cpp/native-scanner'); console.log('C++ OK');"

# Test Rust scanner
node -e "const rust = require('./src/rust/simple-scanner'); console.log('Rust OK');"
```

## Additional Resources

- [node-gyp documentation](https://github.com/nodejs/node-gyp)
- [NAPI documentation](https://nodejs.org/api/n-api.html)
- [napi-rs documentation](https://napi.rs/)
- [Rust Cargo profiles](https://doc.rust-lang.org/cargo/reference/profiles.html)
