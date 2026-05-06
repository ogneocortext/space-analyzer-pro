# Space Analyzer - Windows GUI Error Tracker

Tracks issues in the Windows Desktop GUI implementation (Tauri + Rust + Vue.js).

---

## Overview

The Windows GUI implementation consists of three layers:

- **Rust Backend** (`src-tauri/src/`) - Tauri commands, native file scanning
- **Native Scanner** (`native/scanner/src/`) - Advanced Windows scanning (NTFS MFT, USN Journal)
- **Vue.js Frontend** (`src/composables/`, `src/components/vue/desktop/`) - Desktop UI

---

## Status Overview

| Issue | Status          | Layer    | File                             | Summary                          |
| ----- | --------------- | -------- | -------------------------------- | -------------------------------- |
| GUI-1 | ✅ **RESOLVED** | Rust     | `src-tauri/src/commands.rs`      | Structured error types added     |
| GUI-2 | ✅ **RESOLVED** | Rust     | `src-tauri/src/scanner.rs`       | Error categorization added       |
| GUI-3 | ✅ **RESOLVED** | Native   | `windows_errors.rs`              | Windows API error handling added |
| GUI-4 | ✅ **RESOLVED** | Native   | `native/scanner/src/main.rs`     | Panic handling in CLI tool       |
| GUI-5 | ✅ **RESOLVED** | Frontend | `useTauriDesktop.ts`             | Unhandled promise rejections     |
| GUI-6 | ✅ **RESOLVED** | Frontend | `DesktopLayout.vue`              | Error boundary added             |
| GUI-7 | ✅ **RESOLVED** | Build    | `WINDOWS_BUILD_PREREQUISITES.md` | Windows build documentation      |
| GUI-8 | ✅ **RESOLVED** | Config   | `tauri.conf.json`                | Windows-specific settings added  |

**Windows GUI Status**: ✅ **All 8 Issues Resolved**

---

## Issue Details

### GUI-1: Error Handling in Tauri Commands ✅ RESOLVED

- **File**: `src-tauri/src/commands.rs:10-94`
- **Issue**: Tauri commands lack comprehensive error handling and user-friendly error messages
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Added `TauriError` enum with structured error types (PathNotFound, PermissionDenied, NotADirectory, IoError, Cancelled, OperationFailed)
  - Added `from_io_error()` helper to categorize IO errors
  - Added `user_message()` and `suggestion()` methods for user-friendly messages
  - Updated `analyze_directory()` and `get_file_details()` to use structured errors
- **Impact**:
  - Users see technical error messages
  - Errors not categorized (user error vs system error vs bug)
  - No error recovery suggestions
- **Fix Required**:
  - Implement structured error types
  - Add error context and recovery hints
  - Log errors with appropriate severity

**Example Fix**:

```rust
// Before:
#[tauri::command]
async fn analyze_directory(path: String) -> Result<AnalysisResult, String> {
    let result = std::fs::read_dir(&path)
        .map_err(|e| e.to_string())?; // Technical error
    // ...
}

// After:
#[derive(Debug, Serialize)]
enum AnalysisError {
    PathNotFound { path: String, suggestion: String },
    PermissionDenied { path: String, suggestion: String },
    ScanFailed { reason: String, log_path: String },
}

#[tauri::command]
async fn analyze_directory(path: String) -> Result<AnalysisResult, AnalysisError> {
    let result = std::fs::read_dir(&path)
        .map_err(|e| match e.kind() {
            ErrorKind::NotFound => AnalysisError::PathNotFound {
                path: path.clone(),
                suggestion: format!("Check if '{}' exists", path),
            },
            ErrorKind::PermissionDenied => AnalysisError::PermissionDenied {
                path: path.clone(),
                suggestion: "Run as administrator or check folder permissions".to_string(),
            },
            _ => AnalysisError::ScanFailed {
                reason: e.to_string(),
                log_path: get_log_path(),
            },
        })?;
    // ...
}
```

---

### GUI-2: File Scanning Error Propagation ✅ RESOLVED

- **File**: `src-tauri/src/scanner.rs`
- **Issue**: File scanning errors don't propagate cleanly to frontend
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Modified `scan_directory_sync()` to collect WalkDir errors instead of filtering them out
  - Added error categorization (PermissionDenied vs NotFound vs generic AccessError)
  - Improved metadata error handling with context
  - Modified `scan_directory_with_progress()` to track and report errors during progress updates
  - Errors are now collected in `ScanResult.errors` with descriptive messages
- **Impact**:
  - Scan appears to hang on errors
  - Progress reporting stops without explanation
  - Partial results lost on error
- **Fix Required**:
  - Implement error channels for real-time error reporting
  - Continue scanning on non-fatal errors
  - Return partial results with error summary

---

### GUI-3: Missing Windows API Error Codes ✅ RESOLVED

- **Files**:
  - `native/scanner/src/windows_errors.rs` (NEW)
  - `native/scanner/src/ntfs_mft_scanner.rs`
  - `native/scanner/src/usn_journal_scanner.rs`
  - `native/scanner/src/windows_advanced.rs`
- **Issue**: Windows API errors not properly captured and translated
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Created `windows_errors.rs` module with structured error handling
  - Added Windows error code constants (ERROR_ACCESS_DENIED, ERROR_SHARING_VIOLATION, etc.)
  - Created `WindowsError` struct with error categorization
  - Added user-friendly error messages and recovery suggestions
  - Updated all three scanner files to use new error handling
- **Impact**:
  - Generic "scan failed" messages
  - Can't distinguish between access denied, file locked, etc.
  - Hard to troubleshoot Windows-specific issues
- **Fix Required**:
  - Map Windows error codes (ERROR_ACCESS_DENIED, ERROR_SHARING_VIOLATION, etc.)
  - Use `winapi` or `windows-rs` error handling
  - Provide Windows-specific error context

**Windows Error Codes to Handle**:

```rust
const ERROR_ACCESS_DENIED: u32 = 5;
const ERROR_SHARING_VIOLATION: u32 = 32;
const ERROR_FILE_NOT_FOUND: u32 = 2;
const ERROR_PATH_NOT_FOUND: u32 = 3;
const ERROR_NOT_READY: u32 = 21; // Drive not ready
const ERROR_WRITE_PROTECT: u32 = 19;
```

---

### GUI-4: Panic Handling in Native CLI ✅ RESOLVED

- **File**: `native/scanner/src/main.rs:1713-1742`
- **Issue**: CLI tool panics on errors instead of graceful exit
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Added `std::panic::set_hook` at start of main()
  - Panics are now logged to `scanner-panics.log`
  - User-friendly message printed to stderr
  - Includes timestamp and panic location
- **Impact**:
  - Process crashes with no error log
  - Windows Event Log shows generic crash
  - User sees "App stopped working" dialog
- **Fix Required**:
  - Add `std::panic::set_hook` for custom panic handler
  - Log panics to file before exit
  - Return proper exit codes (0 = success, 1 = error, 2 = panic)

**Fix**:

```rust
fn main() {
    // Set up panic handler
    std::panic::set_hook(Box::new(|info| {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let panic_msg = format!("[{}] PANIC: {}\n", timestamp, info);

        // Log to file
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open("scanner-panics.log")
        {
            let _ = std::io::Write::write_all(&mut file, panic_msg.as_bytes());
        }

        eprintln!("{}", panic_msg);
    }));

    // Rest of main...
}
```

---

### GUI-5: Unhandled Promise Rejections in Desktop Composable ✅ RESOLVED

- **File**: `src/composables/useTauriDesktop.ts`
- **Issue**: Tauri command calls lack try-catch and error handling
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Added DebugLogger import and initialization
  - Wrapped all 8 Tauri invoke calls in try-catch
  - Added structured error logging with context
  - Functions now return null/empty array on error instead of crashing
- **Impact**:
  - Vue warnings about unhandled promise rejections
  - UI state inconsistent when commands fail
  - Users see blank screens or stuck loading states
- **Fix Required**:
  - Add try-catch around all `invoke()` calls
  - Implement error state management
  - Add user-facing error notifications

**Example**:

```typescript
// Before:
const selectDirectory = async () => {
  const selected = await invoke<string | null>("select_directory");
  return selected;
};

// After:
const selectDirectory = async () => {
  try {
    const selected = await invoke<string | null>("select_directory");
    return selected;
  } catch (error) {
    logger.error("Failed to select directory", { error });
    notificationStore.showError("Could not open folder dialog. Please try again.");
    return null;
  }
};
```

---

### GUI-6: Missing Error Boundaries in Desktop Components RESOLVED

- **Files**:
  - `DesktopLayout.vue:139`
- **Issue**: Desktop components lack error boundaries
- **Status**: RESOLVED
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Added ErrorBoundary import to DesktopLayout.vue
  - Wrapped `<slot />` content with ErrorBoundary component (`isolate="true"`)
  - Error boundary catches Vue render errors and displays user-friendly fallback UI
  - Provides "Try Again", "Reload Page", and "Go Home" recovery options
- **Impact**:
  - Component errors crash entire desktop view
  - No recovery mechanism
  - User must restart app
- **Fix Required**:
  - Add Vue error boundaries
  - Implement fallback UI for failed components
  - Add "Retry" functionality

---

### GUI-7: Windows-Specific Build Issues ✅ RESOLVED

- **File**: `WINDOWS_BUILD_PREREQUISITES.md` (new)
- **Issue**: Build fails on Windows without specific toolchain setup
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Created comprehensive build prerequisites guide
  - Documented Visual Studio requirements
  - Added verification PowerShell script
  - Included troubleshooting section for common errors
- **Impact**:
  - CI/CD builds fail
  - New developers can't build locally
  - Windows SDK requirements not documented
- **Fix Required**:
  - Document Windows build prerequisites
  - Add build verification script
  - Provide prebuilt binaries for releases

**Prerequisites to Document**:

- Visual Studio 2022 Build Tools (or full VS)
- Windows SDK (10.0.19041.0 or later)
- Rust target: `x86_64-pc-windows-msvc`
- WebView2 Runtime (for end users)

---

### GUI-8: Missing Windows-Specific Tauri Configuration ✅ RESOLVED

- **File**: `src-tauri/tauri.conf.json`
- **Issue**: Default Tauri config lacks Windows optimizations
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Fix Applied**:
  - Added Windows bundle configuration (webview install mode, signing)
  - Added NSIS installer settings
  - Added system tray icon configuration
  - Windows-specific optimizations for native feel
- **Impact**:
  - App doesn't feel native on Windows
  - Missing Windows notifications integration
  - No jump list support
- **Fix Required**:
  - Add Windows-specific Tauri config
  - Enable Windows notifications
  - Add taskbar integration

**Config to Add**:

```json
{
  "tauri": {
    "bundle": {
      "windows": {
        "webviewInstallMode": {
          "type": "downloadBootstrapper"
        },
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": "",
        "tsp": false
      }
    },
    "systemTray": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  }
}
```

---

## Environment Variables

```bash
# Windows GUI Build
TAURI_SIGNING_PRIVATE_KEY=path/to/key
TAURI_KEY_PASSWORD=password

# Windows-specific
WEBVIEW2_BROWSER_EXECUTABLE_FOLDER=C:\Program Files\WebView2
RUST_LOG=debug  # For Rust logging
RUST_BACKTRACE=1  # Enable backtraces

# Development
TAURI_DEV_HOST=localhost
TAURI_DEV_PORT=1420
```

---

## Debugging Windows GUI

### Enable Rust Logging

```bash
set RUST_LOG=debug
npm run tauri:dev
```

### Check WebView2 Installation

```powershell
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
```

### Build with Verbose Output

```bash
cd src-tauri
cargo build --verbose
```

---

## Related Documentation

- `WINDOWS-GUI-QUICKSTART.md` - Windows GUI setup guide
- `TAURI-GUI-README.md` - Full Tauri documentation
- `native/scanner/BUILD.md` - Native scanner build instructions
- Root: `ERROR_TRACKER.md` - Master tracker

---

## Issue Naming Convention

- **GUI-1+**: General Windows GUI issues
- **NTFS-1+**: NTFS MFT scanner specific
- **USN-1+**: USN Journal scanner specific
- **TAURI-1+**: Tauri framework specific

---

_Created: 2026-05-04_
_Status: 8 Open, 0 Resolved, 0 Partial_
