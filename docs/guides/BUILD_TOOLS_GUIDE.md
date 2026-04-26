# C++ Build Tools Setup Guide

## Visual Studio 2026 Location

**Installation Path**: `D:\Microsoft Visual Studio\18\Community`

## Dynamic Detection Method

Use vswhere.exe to find VS installation dynamically:

```powershell
# Find VS installation path
$vsPath = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath

# Setup build environment
& "$vsPath\VC\Auxiliary\Build\vcvarsall.bat" x64

# Compile
cl /EHsc /std:c++17 /O2 source.cpp /Fe:output.exe
```

## Build Scripts Created

1. **build_dynamic.bat** - Dynamic VS detection with Unicode support
2. **build_console.bat** - Console version (working)
3. **build_ansi.bat** - ANSI fallback version

## Key Files

- **Executable**: `bin\Release\SpaceAnalyzerConsole.exe`
- **Source**: `src/console_main.cpp`
- **Tested**: Successfully analyzes directories with JSON output

## Integration Notes

The console version outputs JSON format perfect for Electron integration:
- Real-time progress updates
- Structured results
- Error handling
- Cross-platform compatible

## Future LLM Instructions

When building C++ projects on this system:

1. Use vswhere.exe for dynamic VS detection
2. Path: `D:\Microsoft Visual Studio\18\Community`
3. Version: Visual Studio 2026 (v18.1.1)
4. Use console version for Electron integration
5. JSON output format for easy parsing

## Environment Variables

- `VS_PATH` = `D:\Microsoft Visual Studio\18\Community`
- `VCVARSALL` = `VS_PATH\VC\Auxiliary\Build\vcvarsall.bat`
- Use `x64` architecture for 64-bit builds