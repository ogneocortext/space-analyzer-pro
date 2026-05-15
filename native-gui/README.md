# Space Analyzer Native GUI

A native Rust GUI application for disk space analysis, built with egui. This provides the same functionality as the web-based version without requiring any backend servers or web dependencies.

## Features

- **Real-time Scanning**: Progress tracking with live updates during directory analysis
- **File Type Analysis**: Distribution of file types with counts and sizes
- **Largest Files Identification**: Automatically finds and displays the largest files
- **Empty Directory Detection**: Identifies directories that contain no files
- **System Information**: Display OS, memory, CPU, and drive information
- **Native Performance**: Fast, responsive GUI without web browser overhead
- **Cross-platform**: Works on Windows, macOS, and Linux

## Building

### Prerequisites

- Rust 1.70+ with the `rust-src` component
- For Windows: Visual Studio Build Tools or MSVC
- For macOS: Xcode Command Line Tools
- For Linux: `build-essential` package

### Build Commands

```bash
# Development build
cargo build

# Release build (optimized)
cargo build --release

# Run directly
cargo run
```

## Usage

1. **Select Directory**: Use the "Select Directory" button or File menu to choose a folder to analyze
2. **View Progress**: Watch real-time progress as the scanner processes files
3. **Explore Results**: Navigate through different tabs to view:
   - Dashboard: System overview and quick actions
   - File Explorer: Detailed file and directory analysis
   - Charts: Visual representations (coming soon)
   - Settings: Configure application preferences

## Architecture

- `src/main.rs`: Application entry point and window setup
- `src/app.rs`: Main application state and UI logic
- `src/scanner.rs`: File system scanning and analysis engine
- `src/types.rs`: Data structures and type definitions

## Dependencies

- `egui`: Immediate mode GUI framework
- `eframe`: Application framework for egui
- `walkdir`: Directory traversal
- `tokio`: Async runtime
- `sysinfo`: System information gathering
- `serde`: Serialization support

## Performance

The scanner is optimized for:
- Single-pass directory traversal
- Memory-efficient processing
- Real-time progress updates
- Cancellation support
- Error handling and recovery

## License

This project is part of the Space Analyzer suite.