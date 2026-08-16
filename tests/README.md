# Test Suite for Space Analyzer Pro

Rust unit tests for the Space Analyzer desktop application.

## Directory Structure

```
tests/
├── unit/                    # Rust unit tests
│   ├── cli_test.rs         # CLI argument parsing tests
│   ├── gpu_compute_test.rs # GPU acceleration tests
│   ├── gui_test.rs         # GUI component tests
│   ├── gui_data_flow_test.rs # GUI data flow tests
│   ├── native_scanner_test.rs # File scanner tests
│   ├── ollama_function_calling_test.rs # Ollama AI tests
│   ├── ollama_reliability_test.rs # Ollama reliability tests
│   ├── shared_scanner_test.rs # Shared scanner tests
│   ├── system_monitor_test.rs # System monitor tests
│   └── lib_shim.rs         # Test helper shim
├── integration/             # Integration tests (when added)
└── fixtures/                # Test fixtures
```

## Running Tests

```bash
# Run all tests
cargo test --workspace

# Run with verbose output
cargo test --workspace -- --nocapture

# Run specific test
cargo test test_name

# Run tests for a specific crate
cargo test -p scan-engine
cargo test -p gpu-compute
cargo test -p space-analyzer
```

## Writing Tests

- Place unit tests in `tests/unit/`
- Use `#[cfg(test)]` module pattern for inline tests
- Follow existing test patterns in neighboring files
- Use descriptive test names that explain the expected behavior
- Test both success and error cases

### Example

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_empty_directory() {
        let temp_dir = create_temp_dir();
        let results = scan_directory(&temp_dir).unwrap();
        assert_eq!(results.file_count, 0);
    }

    #[test]
    fn test_scan_returns_error_for_missing_path() {
        let result = scan_directory(Path::new("/nonexistent"));
        assert!(result.is_err());
    }
}
```

## Test Categories

- **Unit tests**: Test individual functions and modules in isolation
- **Integration tests**: Test interactions between crates (when added)
- **GPU tests**: Test CUDA acceleration and CPU fallback (requires NVIDIA GPU for full coverage)

## Verification

After every code change, run:
```bash
just verify
```

This runs format check + clippy + all tests in one command.
