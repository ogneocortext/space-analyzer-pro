# Fixing Rust Build on Windows

## Finding Your Build Tools

### Common Visual Studio Installation Locations

Check these common paths for Visual Studio:

```powershell
# Check C: drive (default location)
ls "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build"

# Check D: drive (alternative location)
ls "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build"

# Search for vcvarsall.bat anywhere
Get-ChildItem -Path C:\, D:\ -Filter "vcvarsall.bat" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
```

### Finding Windows SDK

```powershell
# Check standard Windows SDK locations
ls "C:\Program Files (x86)\Windows Kits\10\Lib"
ls "C:\Program Files (x86)\Windows Kits\10\Include"

# Find kernel32.lib (required for linking)
Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits" -Filter "kernel32.lib" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 FullName
```

## Build Instructions

### Method 1: Using build-with-vs2022.bat (Recommended)

If you have Visual Studio 2022 on D: drive:

```bash
cd native/scanner
.\build-with-vs2022.bat
```

### Method 2: Manual Build with Environment Setup

For Visual Studio on D: drive with Windows SDK:

```powershell
# Set up Visual Studio environment
$env:LIB = 'C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64;D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\lib\x64'

# Set Rust toolchain
$env:RUSTUP_TOOLCHAIN = 'stable-x86_64-pc-windows-msvc'

# Use separate target directory (avoids permission issues)
$env:CARGO_TARGET_DIR = 'E:\rust-builds\scanner-target'

# Build
cd native/scanner
cargo build --release --bin space-analyzer

# Copy to project bin
Copy-Item "$env:CARGO_TARGET_DIR\release\space-analyzer.exe" "..\..\bin\space-analyzer.exe"
```

### Method 3: Using GNU Toolchain (No Visual Studio Required)

```bash
rustup toolchain install stable-gnu
rustup default stable-gnu
cd native/scanner
cargo build --release --bin space-analyzer
```

**Note:** GNU toolchain may fail with `dlltool.exe not found` error. In that case, use Method 1 or 2 with Visual Studio.

## Troubleshooting

### Error: "cannot open input file 'kernel32.lib'"

**Cause:** LIB environment variable not set correctly.

**Fix:** Set LIB to include Windows SDK paths (see Method 2 above).

### Error: "Access is denied" during build

**Cause:** File locks from previous failed builds.

**Fix:** Use a different target directory:

```bash
set CARGO_TARGET_DIR=E:\temp\scanner-build
cargo build --release
```

### Library (lib.rs) Build Errors

**Note:** The library (`lib.rs`) is only needed if you want to use Rust as a Node.js native addon via NAPI. The CLI binary (`main.rs`) compiles separately and doesn't require the library.

To build only the CLI (recommended):

```bash
cargo build --release --bin space-analyzer
```

## After Building

The executable will be at:

- Custom target dir: `%CARGO_TARGET_DIR%\release\space-analyzer.exe`
- Default: `target\release\space-analyzer.exe`

Copy to project bin:

```bash
copy space-analyzer.exe ..\..\bin\
```

Test the CLI:

```bash
space-analyzer.exe "C:\Users\YourName\Documents" --progress --parallel
```
