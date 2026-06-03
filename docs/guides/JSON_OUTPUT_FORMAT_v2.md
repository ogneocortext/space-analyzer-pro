# JSON Output Format v2.0

## Overview

Space Analyzer now outputs analysis results in an enhanced JSON format (v2.0) that provides better structure, performance metrics, and error tracking while maintaining backward compatibility.

## Schema Version

- **Current Version**: `2.0`
- **Compatibility**: Backward compatible with v1.0 format

## New Structure

### Root Level

```json
{
  "schema_version": "2.0",
  "generated_at": "2026-05-02T12:03:00Z",
  "scanner_version": "2.8.5",
  "scan_config": { ... },
  "summary": { ... },
  "file_analysis": { ... },
  "performance": { ... },
  "issues": { ... }
}
```

### Metadata

- `schema_version`: JSON schema version for compatibility tracking
- `generated_at`: RFC3339 timestamp when the analysis was generated
- `scanner_version`: Version of the scanner that generated the results

### Scan Configuration

```json
{
  "scan_config": {
    "path": "D:/Test",
    "max_files": 1000,
    "include_hidden": false,
    "follow_symlinks": false,
    "json_progress": true
  }
}
```

### Summary Statistics

```json
{
  "summary": {
    "total_files": 150,
    "total_size": 52428800,
    "scan_duration_ms": 1250,
    "files_scanned_per_second": 120,
    "bytes_scanned_per_second": 41943040
  }
}
```

### File Analysis

```json
{
  "file_analysis": {
    "files": [
      {
        "name": "test.txt",
        "path": "D:/Test/test.txt",
        "size": {
          "bytes": 1024,
          "formatted": "1.0 KB",
          "on_disk": null
        },
        "extension": "txt",
        "category": "Documents",
        "timestamps": {
          "created": "2026-05-02T10:00:00Z",
          "modified": "2026-05-02T11:00:00Z",
          "accessed": "2026-05-02T12:00:00Z"
        },
        "file_hash": null,
        "is_hard_link": false,
        "attributes": {
          "is_readonly": false,
          "is_hidden": false,
          "is_system": false,
          "has_ads": false,
          "ads_count": 0,
          "is_compressed": false,
          "compressed_size": null,
          "is_sparse": false,
          "is_reparse_point": false,
          "reparse_tag": null,
          "owner": null
        }
      }
    ],
    "categories": {
      "Documents": { "count": 50, "size": 20971520 },
      "Images": { "count": 100, "size": 31457280 }
    },
    "extension_stats": {
      "txt": { "count": 25, "size": 10485760 },
      "jpg": { "count": 75, "size": 41943040 }
    },
    "duplicate_groups": [],
    "duplicate_count": 0,
    "duplicate_size": 0,
    "hard_link_count": 0,
    "hard_link_savings": 0,
    "apparent_size": 52428800
  }
}
```

### Performance Metrics

```json
{
  "performance": {
    "scan_duration_ms": 1250,
    "files_per_second": 120,
    "bytes_per_second": 41943040,
    "memory_peak_mb": null,
    "disk_reads": null,
    "cache_hits": null
  }
}
```

### Issues and Warnings

```json
{
  "issues": {
    "errors": [
      {
        "type_": "access_denied",
        "path": "D:/Test/protected.txt",
        "message": "Unable to access file metadata",
        "count": 1
      }
    ],
    "warnings": [
      {
        "type_": "large_file",
        "path": "D:/Test/large_video.mp4",
        "message": "File larger than 1GB",
        "size": 2147483648
      }
    ]
  }
}
```

## Key Improvements

### 1. Enhanced File Structure
- **Formatted Sizes**: Human-readable file sizes (e.g., "1.5 MB")
- **Organized Timestamps**: Grouped creation, modification, and access times
- **Structured Attributes**: All file attributes grouped together

### 2. Performance Metrics
- **Scan Rate**: Files and bytes processed per second
- **Duration Tracking**: Precise scan timing in milliseconds
- **Resource Usage**: Memory and disk I/O metrics (when available)

### 3. Error Tracking
- **Access Errors**: Files that couldn't be accessed
- **Warnings**: Large files, unusual extensions, etc.
- **Counts**: Number of occurrences for each issue type

### 4. Schema Versioning
- **Version Tracking**: Clear schema version for compatibility
- **Backward Compatibility**: Legacy fields preserved
- **Future-Proof**: Structure can evolve without breaking changes

## Migration Guide

### For Frontend Developers

Use the `normalizeAnalysisResult()` function in `AnalysisBridge.ts` to handle both formats:

```typescript
import { normalizeAnalysisResult } from '@/services/AnalysisBridge';

// Handle both old and new formats
const normalizedData = normalizeAnalysisResult(jsonData);

// Access new structured data
console.log(normalizedData.summary.total_files);
console.log(normalizedData.performance.files_per_second);
console.log(normalizedData.issues?.warnings);
```

### For API Consumers

1. **Check Schema Version**: Look for `schema_version` field
2. **Use New Structure**: Prefer `summary`, `performance`, and `file_analysis` fields
3. **Fallback**: Legacy fields (`totalFiles`, `totalSize`) are still available

## Error Types

| Type | Description | Example |
|------|-------------|---------|
| `access_denied` | File couldn't be accessed due to permissions | Protected system files |
| `file_not_found` | File was deleted during scan | Temporary files |
| `corrupted_file` | File metadata is corrupted | Damaged filesystem entries |

## Warning Types

| Type | Description | Trigger |
|------|-------------|---------|
| `large_file` | File larger than 1GB | Video files, disk images |
| `unusual_extension` | Rare file extension | Custom file formats |
| `deep_directory` | Directory depth exceeds recommended level | Nested folder structures |

## Backward Compatibility

The v2.0 format maintains full backward compatibility with v1.0:

- Legacy fields are preserved as-is
- New fields are optional and don't break existing parsers
- Migration is transparent to existing code

## Performance Impact

The new JSON format has minimal performance impact:
- ~5% larger file size due to additional metadata
- Faster parsing due to structured organization
- Better compression ratios with gzip

## Examples

### Basic Analysis Result
See `test_json_output.json` for a complete example of the new format.

### Error Handling
```json
{
  "issues": {
    "errors": [
      {
        "type_": "access_denied",
        "path": "C:/Windows/System32/config",
        "message": "Access denied by system",
        "count": 1
      }
    ],
    "warnings": []
  }
}
```

### Performance Metrics
```json
{
  "performance": {
    "scan_duration_ms": 2340,
    "files_per_second": 15420,
    "bytes_per_second": 8294400,
    "memory_peak_mb": 256,
    "disk_reads": 12345,
    "cache_hits": 9876
  }
}
```
