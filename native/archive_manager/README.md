# Archive Manager

Cross-platform archive manager with cloud integration and intelligent compression for Space Analyzer Pro.

## Features

- **Multiple Formats**: Support for ZIP, TAR, TAR.GZ, TAR.BZ2, TAR.XZ, TAR.LZ4, TAR.ZSTD, 7Z
- **Intelligent Compression**: Automatic algorithm selection based on file types
- **Cloud Integration**: Direct upload to AWS S3, Azure Blob Storage, Google Cloud Storage
- **Parallel Processing**: Multi-threaded compression for maximum performance
- **Progress Tracking**: Real-time progress bars and detailed statistics
- **Format Comparison**: Benchmark different compression algorithms
- **Archive Testing**: Verify archive integrity and contents
- **Smart Filtering**: Include/exclude patterns for selective archiving
- **Cross-Platform**: Full Windows, macOS, and Linux support

## Installation

### From Source

```bash
cd native/archive_manager
cargo build --release
```

The binary will be available at `target/release/archive-manager.exe` on Windows or `target/release/archive-manager` on Unix.

## Usage

### Basic Archiving

```bash
# Create archive with default settings
archive-manager create /path/to/source output.tar.gz

# Create ZIP archive with maximum compression
archive-manager create /path/to/directory output.zip \
  --format zip --compression maximum

# Create archive with custom settings
archive-manager create /data backup.tar.xz \
  --format tar.xz \
  --compression maximum \
  --exclude "*.tmp,*.log,node_modules" \
  --include "*.pdf,*.docx" \
  --preserve-timestamps \
  --follow-symlinks
```

### Extraction

```bash
# Extract archive
archive-manager extract backup.tar.gz /path/to/extract

# Extract with verbose output
archive-manager extract backup.tar.xz ./extracted --verbose
```

### Cloud Upload

```bash
# Upload to AWS S3
archive-manager upload backup.tar.gz \
  --cloud-provider aws-s3 \
  --bucket my-backups \
  --region us-west-2 \
  --access-key YOUR_ACCESS_KEY \
  --secret-key YOUR_SECRET_KEY

# Upload to Azure Blob Storage
archive-manager upload backup.tar.gz \
  --cloud-provider azure-blob \
  --bucket my-container \
  --access-key ACCOUNT_NAME \
  --secret-key ACCOUNT_KEY
```

### Format Comparison

```bash
# Compare compression algorithms
archive-manager compare /data ./comparison_output

# This will create test archives with all supported formats
# and show performance comparison table
```

### Archive Testing

```bash
# Test archive integrity
archive-manager test backup.tar.gz

# List archive contents
archive-manager list backup.tar.gz
```

### Options

- `--format <FORMAT>`: Archive format (zip, tar, tar.gz, tar.bz2, tar.xz, tar.lz4, tar.zstd, 7z)
- `--compression <LEVEL>`: Compression level (none, fast, default, maximum, ultra)
- `--include-hidden`: Include hidden files and directories
- `--follow-symlinks`: Follow symbolic links during archiving
- `--preserve-permissions`: Preserve file permissions
- `--preserve-timestamps`: Preserve file timestamps
- `--exclude <PATTERNS>`: Exclude patterns (comma-separated)
- `--include <PATTERNS>`: Include patterns (comma-separated)
- `--cloud-provider <PROVIDER>`: Cloud provider (aws-s3, azure-blob, google-cloud)
- `--bucket <NAME>`: Cloud storage bucket/container name
- `--region <REGION>`: Cloud storage region
- `--access-key <KEY>`: Cloud access key
- `--secret-key <KEY>`: Cloud secret key
- `--output <FORMAT>`: Output format (json, table)
- `--verbose`: Verbose output

## Archive Formats

### ZIP
- **Best for**: Cross-platform compatibility, Windows integration
- **Compression**: Deflate algorithm
- **Speed**: Fast compression and extraction
- **Features**: Password protection, encryption support

### TAR.GZ
- **Best for**: Unix/Linux systems, good compression ratio
- **Compression**: Gzip (DEFLATE) algorithm
- **Speed**: Moderate speed, good balance
- **Features**: Preserves Unix permissions and metadata

### TAR.BZ2
- **Best for**: Maximum compression for text files
- **Compression**: Bzip2 algorithm
- **Speed**: Slow compression, fast extraction
- **Features**: Excellent compression ratio

### TAR.XZ
- **Best for**: Highest compression ratio
- **Compression**: LZMA2 algorithm
- **Speed**: Very slow compression, moderate extraction
- **Features**: Best compression for most file types

### TAR.LZ4
- **Best for**: Fast compression/decompression
- **Compression**: LZ4 algorithm
- **Speed**: Extremely fast, low compression
- **Features**: Real-time compression scenarios

### TAR.ZSTD
- **Best for**: Balanced speed and compression
- **Compression**: Zstandard algorithm
- **Speed**: Fast compression, very fast extraction
- **Features**: Modern, efficient algorithm

## Cloud Integration

### AWS S3 Setup

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-west-2"

archive-manager upload backup.tar.gz \
  --cloud-provider aws-s3 \
  --bucket my-backups
```

### Azure Blob Setup

```bash
archive-manager upload backup.tar.gz \
  --cloud-provider azure-blob \
  --bucket my-container \
  --access-key your-storage-account \
  --secret-key your-storage-key
```

### Google Cloud Storage Setup

```bash
# Set up service account JSON file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

archive-manager upload backup.tar.gz \
  --cloud-provider google-cloud \
  --bucket my-bucket
```

## Library Usage

```rust
use archive_manager::{ArchiveManager, ArchiveConfig, ArchiveFormat, CompressionLevel};

// Create configuration
let config = ArchiveConfig {
    format: ArchiveFormat::TarGz,
    compression_level: CompressionLevel::Maximum,
    exclude_patterns: vec!["*.tmp".to_string(), "*.log".to_string()],
    ..Default::default()
};

// Create archive manager
let manager = ArchiveManager::new(config);

// Create archive
let result = manager.create_archive("/data", "backup.tar.gz").await?;
println!("Archive created: {} -> {} bytes", 
    result.original_size, result.compressed_size);

// Extract archive
let result = manager.extract_archive("backup.tar.gz", "/extracted").await?;
println!("Extracted {} files", result.files_processed);
```

## Performance Comparison

| Format | Compression | Speed | Best Use Case |
|--------|-------------|--------|---------------|
| ZIP | Medium | Fast | Cross-platform compatibility |
| TAR.GZ | Good | Medium | Unix systems, general use |
| TAR.BZ2 | Excellent | Slow | Maximum compression |
| TAR.XZ | Best | Very Slow | Archive storage |
| TAR.LZ4 | Poor | Very Fast | Real-time scenarios |
| TAR.ZSTD | Good | Fast | Modern applications |

## Examples

### Automated Backup Script

```bash
#!/bin/bash
# Daily backup script

SOURCE="/home/user/Documents"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d)
ARCHIVE_NAME="backup_${DATE}.tar.xz"

# Create backup
archive-manager create "$SOURCE" "$BACKUP_DIR/$ARCHIVE_NAME" \
  --format tar.xz \
  --compression maximum \
  --exclude "*.tmp,*.cache,node_modules" \
  --preserve-permissions \
  --preserve-timestamps

# Upload to cloud
archive-manager upload "$BACKUP_DIR/$ARCHIVE_NAME" \
  --cloud-provider aws-s3 \
  --bucket my-backups \
  --region us-west-2

# Clean up old backups (keep last 30 days)
find "$BACKUP_DIR" -name "backup_*.tar.xz" -mtime +30 -delete
```

### Format Performance Test

```bash
# Test different formats on your data
archive-manager compare /large/dataset ./test_results

# This will create test archives with all formats
# and show detailed performance comparison
```

### Selective Archiving

```bash
# Archive only specific file types
archive-manager create /project ./code_backup.tar.gz \
  --format tar.gz \
  --include "*.rs,*.toml,*.md,*.json" \
  --exclude "target/,node_modules/,*.lock"

# Archive with custom filters
archive-manager create /user ./user_data.tar.xz \
  --format tar.xz \
  --compression maximum \
  --exclude "*.tmp,*.cache,.cache,*.log" \
  --include-hidden \
  --preserve-permissions
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure read permissions for source files
2. **Disk Space**: Check available space for archive creation
3. **Cloud Upload**: Verify credentials and bucket permissions
4. **Format Support**: Ensure target system supports chosen format

### Debug Mode

```bash
archive-manager create /data backup.tar.gz --verbose
```

### Performance Tips

1. **Use SSDs**: Faster I/O significantly improves archiving speed
2. **Parallel Processing**: Enable multi-threading for large datasets
3. **Choose Right Format**: Balance compression vs speed for your use case
4. **Exclude Unnecessary Files**: Reduce archive size and processing time

## Integration with Space Analyzer Pro

This archive manager integrates seamlessly with the main application:

1. **Smart Recommendations**: Suggests best format based on file types
2. **Cloud Integration**: Direct upload from web interface
3. **Progress Tracking**: Real-time updates in web dashboard
4. **Scheduling**: Automated backup operations
5. **Storage Analysis**: Analyzes archive contents before creation

## Contributing

1. Follow existing code style and patterns
2. Add comprehensive tests for new formats
3. Update documentation for any API changes
4. Ensure cross-platform compatibility

## License

MIT License - see LICENSE file for details.