# Building Space Analyzer Rust CLI

## Prerequisites

1. **Install Rust** (if not already installed)
   ```bash
   # Windows (using rustup)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   # Or download from https://rustup.rs/
   ```

2. **Verify Rust installation**
   ```bash
   rustc --version
   cargo --version
   ```

## Building the CLI

### Release Build (Recommended)

From the project root directory:

```bash
cd native/scanner
cargo build --release
```

The executable will be created at:
- Windows: `native/scanner/target/release/space-analyzer.exe`
- Linux/Mac: `native/scanner/target/release/space-analyzer`

### Development Build

```bash
cd native/scanner
cargo build
```

Executable will be at `target/debug/space-analyzer[.exe]`

## Installing to Project

After building, copy the executable to the project's `bin` directory:

**Windows:**
```powershell
copy target\release\space-analyzer.exe ..\..\bin\
```

**Linux/Mac:**
```bash
cp target/release/space-analyzer ../../bin/
```

## Verifying Installation

The backend will automatically find the executable if it's in:
- `bin/space-analyzer.exe`
- `native/scanner/target/release/space-analyzer.exe`
- `native/scanner/target/debug/space-analyzer.exe`

Run a quick test:
```bash
space-analyzer.exe "C:\Users\YourName\Documents" --progress --parallel
```

## Troubleshooting

### Build Errors

1. **Missing dependencies**: Run `cargo update` before building
2. **Linking errors**: Ensure you have Visual Studio Build Tools (Windows) or GCC (Linux)
3. **Permission denied**: Run terminal as Administrator (Windows) or use `sudo` (Linux)

### Runtime Issues

1. **Not found by backend**: Check that the executable name matches `space-analyzer.exe` exactly
2. **Permission denied**: Ensure the executable has execute permissions
3. **Missing DLLs**: Install Visual C++ Redistributable (Windows)

## Features

The Rust CLI provides:
- **Parallel scanning** for multi-core systems
- **Real-time progress** output (use `--progress` flag)
- **JSON output** for backend integration
- **Category detection** based on file extensions
- **Memory efficient** processing with bounded channels

## CLI Arguments

```
space-analyzer [PATH] [OPTIONS]

Arguments:
  [PATH]              Directory path to analyze

Options:
  -o, --output <FILE>   Output file path
      --format <FMT>    Output format (default: json)
      --progress        Show progress output
      --parallel        Use parallel processing (default: true)
      --max-files <N>   Maximum files to analyze (0 = all)
      --max-depth <N>   Maximum directory depth (default: 10)
      --hidden          Include hidden files
  -h, --help            Print help
```
