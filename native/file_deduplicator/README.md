# File Deduplicator

High-performance file deduplicator with BLAKE3 hashing and hard link support for the Space Analyzer Pro project.

## Features

- **BLAKE3 Hashing**: Ultra-fast cryptographic hashing for accurate duplicate detection
- **Hard Link Support**: True space savings through hard link creation on Windows and Unix
- **Parallel Processing**: Multi-threaded scanning and hashing for maximum performance
- **Configurable Filters**: Include/exclude patterns, size limits, and symlink handling
- **Dry Run Mode**: Preview potential space savings without making changes
- **Progress Tracking**: Real-time progress bars and detailed statistics
- **Multiple Output Formats**: JSON and table output for integration
- **Cross-Platform**: Full Windows and Unix support with platform-specific optimizations

## Installation

### From Source

```bash
cd native/file_deduplicator
cargo build --release
```

The binary will be available at `target/release/file-deduplicator.exe` on Windows or `target/release/file-deduplicator` on Unix.

## Usage

### Basic Usage

```bash
# Scan for duplicates (dry run)
file-deduplicator scan /path/to/directory

# Deduplicate files
file-deduplicator deduplicate /path/to/directory --no-dry-run

# Run complete process
file-deduplicator run /path/to/directory --no-dry-run
```

### Advanced Options

```bash
# Custom configuration
file-deduplicator run /path/to/directory \
  --min-size 1048576 \
  --max-size 1073741824 \
  --exclude "*.tmp,*.log,node_modules" \
  --include "*.pdf,*.docx" \
  --jobs 8 \
  --output json \
  --verbose
```

### Options

- `-d, --directory <DIR>`: Directory to scan (default: current directory)
- `-m, --min-size <BYTES>`: Minimum file size (default: 1024)
- `-M, --max-size <BYTES>`: Maximum file size
- `-f, --follow-symlinks`: Follow symbolic links
- `-e, --exclude <PATTERNS>`: Patterns to exclude (comma-separated)
- `-I, --include <PATTERNS>`: Patterns to include (comma-separated)
- `-j, --jobs <NUM>`: Number of parallel jobs
- `--dry-run`: Don't actually deduplicate files
- `--hard-links`: Create hard links for deduplication
- `-o, --output <FORMAT>`: Output format (json, table)
- `-v, --verbose`: Verbose output

## Library Usage

```rust
use file_deduplicator::{FileDeduplicator, DeduplicationConfig};

// Create deduplicator with custom config
let config = DeduplicationConfig {
    min_file_size: 1024 * 1024, // 1MB
    dry_run: false,
    create_hard_links: true,
    ..Default::default()
};

let deduplicator = FileDeduplicator::with_config(config);

// Run deduplication
let result = deduplicator.run("/path/to/directory")?;
println!("Space saved: {} bytes", result.space_saved);
```

## Performance

- **Scanning Speed**: Up to 10,000 files/second on modern SSDs
- **Hashing Speed**: BLAKE3 provides ~3GB/s hashing performance
- **Memory Usage**: Efficient streaming with 8KB buffers
- **Parallel Processing**: Utilizes all available CPU cores

## Integration with Space Analyzer Pro

This deduplicator integrates seamlessly with the main Space Analyzer Pro application:

1. **Tauri Integration**: Can be called from the Rust backend
2. **Node.js FFI**: Available through NAPI bindings
3. **CLI Integration**: Can be invoked from shell scripts
4. **JSON Output**: Perfect for web dashboard integration

## Safety Features

- **Dry Run Mode**: Always preview before making changes
- **Backup Protection**: Won't modify system directories
- **Error Handling**: Comprehensive error reporting and recovery
- **Cross-Platform**: Safe hard link creation on all platforms

## Examples

### Scan Home Directory

```bash
file-deduplicator scan ~/Documents --verbose --exclude "*.tmp,*.cache"
```

### Deduplicate with Custom Settings

```bash
file-deduplicator deduplicate /media/storage \
  --min-size 10485760 \
  --exclude "*.log,*.tmp" \
  --jobs 12 \
  --no-dry-run
```

### JSON Output for Integration

```bash
file-deduplicator run /path/to/scan --output json --no-dry-run > results.json
```

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure cross-platform compatibility

## License

MIT License - see LICENSE file for details.