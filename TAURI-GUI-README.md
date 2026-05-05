# Space Analyzer Pro - Windows GUI (Tauri)

This is the Windows desktop GUI for Space Analyzer Pro, built with Tauri. It wraps the existing Vue.js web interface into a native Windows application with access to system APIs for file scanning.

## Features

- **Native Windows App**: Lightweight (~5MB) native desktop application
- **Fast File Scanning**: Direct access to Windows APIs for optimal performance
- **Native File Dialogs**: Windows-style folder picker dialogs
- **System Integration**: Access to system drives, memory info, and file operations
- **Progress Tracking**: Real-time scan progress with native notifications
- **Open in Explorer**: Direct integration with Windows Explorer

## Prerequisites

1. **Node.js** (>= 20.0.0)
2. **Rust** (>= 1.77) - [Install Rust](https://www.rust-lang.org/tools/install)
3. **Windows SDK** (for Windows builds)

### Installing Rust on Windows

```powershell
# Using winget
winget install Rustlang.Rustup

# Or download from https://rustup.rs/
# After installation, restart your terminal
```

## Setup

### 1. Install Tauri CLI

```bash
npm install
# or
npm install -g @tauri-apps/cli
```

### 2. Build the Rust backend

```bash
cd src-tauri
cargo build
```

## Development

### Run in development mode

```bash
npm run tauri:dev
```

This will:
1. Start the Vite dev server
2. Launch the Tauri desktop window
3. Enable hot-reloading for both frontend and Rust code

## Building for Production

### Build Windows Installer

```bash
# Build for Windows (MSI installer)
npm run tauri:build:windows

# Or use the generic build command
npm run tauri:build
```

The installer will be created at:
- `src-tauri/target/release/bundle/msi/Space Analyzer Pro_2.8.9_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Space Analyzer Pro_2.8.9_x64-setup.exe`

### Build Portable Executable

```bash
cd src-tauri
cargo build --release
```

The portable executable will be at:
- `src-tauri/target/release/Space Analyzer Pro.exe`

## Project Structure

```
src-tauri/
├── Cargo.toml           # Rust project configuration
├── tauri.conf.json      # Tauri application configuration
├── build.rs             # Build script
├── capabilities/        # Tauri permissions
│   └── default.json     # Default capabilities
├── icons/               # Application icons
│   ├── icon.ico         # Windows icon
│   ├── icon.png         # PNG icon
│   └── ...
└── src/
    ├── main.rs          # Application entry point
    ├── lib.rs           # Library exports
    ├── commands.rs      # Tauri commands (exposed to frontend)
    └── scanner.rs       # File scanning implementation
```

## Tauri Commands

The following commands are exposed to the Vue.js frontend:

| Command | Description |
|---------|-------------|
| `analyze_directory` | Scan a directory and return results |
| `analyze_directory_with_progress` | Scan with real-time progress updates |
| `cancel_analysis` | Cancel an ongoing scan |
| `get_system_info` | Get system memory and CPU info |
| `get_drives` | List available drives |
| `open_file_location` | Open file in Windows Explorer |
| `get_file_details` | Get detailed file information |
| `delete_files` | Delete selected files |

## Using the Desktop Features in Vue.js

```typescript
import { useTauriDesktop } from '@/composables/useTauriDesktop'

const {
  isTauri,           // Check if running in Tauri
  selectDirectory,   // Open native folder picker
  analyzeDirectoryWithProgress,  // Scan with progress
  getSystemInfo,     // Get system info
  getDrives,         // List drives
  openFileLocation,  // Open in Explorer
  progress,          // Reactive scan progress
  isScanning,        // Scanning state
} = useTauriDesktop()

// Example: Select and analyze a directory
async function selectAndAnalyze() {
  const path = await selectDirectory()
  if (path) {
    const result = await analyzeDirectoryWithProgress(path)
    console.log(`Found ${result.total_files} files`)
  }
}
```

## Customization

### Window Settings

Edit `src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "windows": [{
      "title": "Space Analyzer Pro",
      "width": 1400,
      "height": 900,
      "theme": "Dark"
    }]
  }
}
```

### Adding New Commands

1. Add the command in `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn my_custom_command(arg: String) -> Result<String, String> {
    Ok(format!("Received: {}", arg))
}
```

2. Register it in `src-tauri/src/lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_custom_command,
])
```

3. Call from frontend:

```typescript
import { invoke } from '@tauri-apps/api/core'
const result = await invoke('my_custom_command', { arg: 'hello' })
```

## Troubleshooting

### Rust Build Errors

```bash
# Update Rust
rustup update

# Install Windows target
rustup target add x86_64-pc-windows-msvc
```

### Tauri CLI Not Found

```bash
npm install -g @tauri-apps/cli
# or
npx tauri --version
```

### Permission Denied Errors

Make sure the capabilities are properly configured in `src-tauri/capabilities/default.json`.

## License

Same as the main Space Analyzer Pro project.
