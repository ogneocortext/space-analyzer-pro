# Testing Documentation

## Overview

This document covers testing practices for the Space Analyzer Pro Rust desktop application.

## Testing Strategy

- **Unit tests**: Test individual functions and modules in isolation
- **Integration tests**: Test interactions between crates (when added)
- **GPU tests**: Test CUDA acceleration and CPU fallback

## Running Tests

```bash
# Run all tests
cargo test --workspace

# Run with verbose output
cargo test --workspace -- --nocapture

# Run specific test by name
cargo test test_name

# Run tests for a specific crate
cargo test -p shared-scanner
cargo test -p gpu-compute
cargo test -p space-analyzer

# Run and show println! output
cargo test --workspace -- --nocapture
```

## Writing Tests

### Inline Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_functionality() {
        let result = my_function();
        assert!(result.is_ok());
    }

    #[test]
    fn test_error_handling() {
        let result = function_that_should_fail();
        assert!(result.is_err());
    }
}
```

### Test File Organization

Place test files in `tests/unit/`:
- `cli_test.rs` - CLI argument parsing
- `gui_test.rs` - GUI component logic
- `gui_data_flow_test.rs` - GUI data flow
- `native_scanner_test.rs` - File scanner
- `shared_scanner_test.rs` - Shared scanning logic
- `gpu_compute_test.rs` - GPU acceleration
- `ollama_function_calling_test.rs` - AI integration
- `ollama_reliability_test.rs` - AI reliability
- `system_monitor_test.rs` - System monitoring

### Test Patterns

```rust
// Test with temporary directory
use tempfile::TempDir;

#[test]
fn test_scan_directory() {
    let temp_dir = TempDir::new().unwrap();
    // Create test files...
    let results = scan_directory(temp_dir.path()).unwrap();
    assert_eq!(results.file_count, 3);
}

// Test error cases
#[test]
fn test_missing_path() {
    let result = scan_directory(Path::new("/nonexistent"));
    assert!(result.is_err());
}

// Test with mock data
#[test]
fn test_parse_results() {
    let json = r#"{"files": []}"#;
    let results: ScanResults = serde_json::from_str(json).unwrap();
    assert!(results.files.is_empty());
}
```

## Code Quality

### Formatting

```bash
# Format all code
cargo fmt --all

# Check formatting without modifying
cargo fmt --all -- --check
```

### Linting

```bash
# Run Clippy lints
cargo clippy --all-targets --all-features -- -D warnings
```

### Full Verification

```bash
# Format check + clippy + all tests
just verify
```

## Test Data

- Test fixtures go in `tests/fixtures/`
- Use `tempfile::TempDir` for temporary test data
- Clean up test artifacts automatically

## CI Testing

The CI pipeline runs on every push and PR:
1. `cargo fmt --all -- --check`
2. `cargo clippy --all-targets --all-features -- -D warnings`
3. `cargo test --workspace`
