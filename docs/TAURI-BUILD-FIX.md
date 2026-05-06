# Tauri Build Error Fix - Windows SDK Issue

## Error
```
fatal error C1034: windows.h: no include path set
```

This means the C++ compiler can't find the Windows SDK headers.

## Fix Options (try in order)

### Option 1: Run from Visual Studio Developer Command Prompt (Easiest)

```powershell
# Find and open "Developer Command Prompt for VS 2022" from Start Menu
# Then navigate to your project and build:

cd "E:\Self Built Web and Mobile Apps\Space Analyzer"
npm run tauri:dev
```

To find it: Press `Win` key → Type "Developer Command Prompt" → Run as Administrator

---

### Option 2: Set Environment Variables in PowerShell

```powershell
# Run these commands before building:
$env:LIB = "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64;D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\lib\x64"

$env:INCLUDE = "C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\shared;D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\include"

$env:PATH = "D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64;" + $env:PATH

# Then build
cd "E:\Self Built Web and Mobile Apps\Space Analyzer"
npm run tauri:dev
```

---

### Option 3: Install Windows SDK via Visual Studio Installer

1. Open **Visual Studio Installer** (search in Start Menu)
2. Click **Modify** on Visual Studio Community 2022
3. Go to **Individual Components** tab
4. Search and install:
   - **Windows 11 SDK** (latest version, e.g., 10.0.22621.0)
   - **C++ Windows XP Support for VS 2022** (optional)
   - **MSVC v143 - VS 2022 C++ x64/x86 build tools**

5. Click **Modify** to install

---

### Option 4: Use VSWhere to Set Environment

```powershell
# Run this script to auto-detect and set VS environment
$vsPath = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath

if ($vsPath) {
    $vcvarsPath = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
    if (Test-Path $vcvarsPath) {
        # Import VC environment
        cmd /c "`"$vcvarsPath`" && set" | ForEach-Object {
            if ($_ -match "^(.*?)=(.*)$") {
                [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
            }
        }
        Write-Host "Visual Studio environment loaded from: $vsPath"
    }
}

# Then build
cd "E:\Self Built Web and Mobile Apps\Space Analyzer"
npm run tauri:dev
```

---

### Option 5: Simplified Build (Skip C++ Dependencies)

If the above doesn't work, we can modify the Tauri config to avoid the problematic dependency:

```powershell
# Clean previous build
cd "E:\Self Built Web and Mobile Apps\Space Analyzer\src-tauri"
cargo clean

# Update dependencies
cargo update

# Try building with minimal features
cargo build --release --no-default-features
```

---

## Quick Check

Verify your setup:

```powershell
# Check if cl.exe can find windows.h
cl /nologo /c "C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\um\windows.h"

# Check Rust
rustc --version
cargo --version

# Check Tauri
npx tauri --version
```

## Recommended Solution

**Use Option 1** (Developer Command Prompt) - it's the most reliable.

If that fails, **use Option 3** to install the Windows SDK properly.

## Alternative: Use Pre-built Binary

If building continues to fail, you can:

1. Use the web version: `npm run dev`
2. Or use GitHub Actions to build the Windows installer (see `.github/workflows/build.yml`)

---

## Troubleshooting

### "Cannot find VCINSTALLDIR"
Your Visual Studio is at `D:\` drive. Make sure the paths in the environment variables above match your actual Windows SDK installation location.

### Common Windows SDK Paths to Check:
```
C:\Program Files (x86)\Windows Kits\10\
C:\Program Files (x86)\Windows Kits\8.1\
D:\Windows Kits\10\
```

Find your exact path by searching for `windows.h`:
```powershell
Get-ChildItem -Path "C:\", "D:\" -Recurse -Filter "windows.h" -ErrorAction SilentlyContinue | Select-Object -First 5
```
