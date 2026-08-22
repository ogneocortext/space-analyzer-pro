# [Unreleased]

## Rust workspace modernization: edition 2024, full dependency refresh & cudarc 0.19 migration

### Changed
- **Rust edition 2021 → 2024** across all 6 workspace crates (`src/`, `scan-engine/`,
  `gpu-compute/`, `native/win-usn/`, `native/file_deduplicator/`,
  `native/node_modules_cleaner/`) and `rustfmt.toml`.
- **All behind-major dependency upgrades** (user chose "all major upgrades"): `zip`
  2→8.6, `tokio-tungstenite` 0.21→0.30, `toml` 0.8→1.1, `tower-http` 0.6→0.7,
  `base64` 0.22→0.23, `ndarray` 0.16→0.17, `rand` 0.9→0.10, `cudarc` 0.12→0.19,
  `napi`/`napi-derive` 2→3, `md5` 0.7→0.8. The transitive RustCrypto stack
  (`aes`/`cipher`/`digest`/`hmac`/`sha1`/`pbkdf2`) and `tungstenite`/`thiserror` 2.x
  followed automatically.
- **cudarc 0.19 API migration** in `gpu-compute`: the removed `CudaDevice` type is
  replaced by `CudaContext` (`device.rs`, `hash.rs`, `kernels.rs`); module loading now
  uses `context.load_module(ptx)?.load_function(name)`; per-kernel error handling
  switched to `anyhow::bail!` / `with_context`. Enabled the explicit `cuda-12040`
  feature so `cudarc` links against the installed CUDA 12.4 toolkit. `rand` 0.10
  migration in `gpu-compute/src/ml.rs` (`rand::Rng` → `rand::RngExt`).
- **Edition-2024 source API fixes**: `unsafe extern "system"` in
  `scan-engine/src/formatting.rs`; closure pattern `&c`→`entry.1` in
  `src/workflows/insights.rs`; match-ergonomics loop fix in `src/cli/output.rs`
  (`map(|&(c,s)| (*c,*s))`).

### Fixed
- **`node_modules_cleaner` recursion + display bugs**
  (`native/node_modules_cleaner/src/main.rs`): `is_nested_node_modules` now recurses
  properly (was excluding all project-level `node_modules`); display unit bugs fixed
  (`82.74 MB GB`, `Very large (0 GB)`).
- **Unit-test struct literals** updated for the new `ScanReport` fields
  (`category_reclaimable`, `reclaim_tier_sizes`, `is_index_only`) in
  `tests/unit/gui_data_flow_test.rs`, `gui_test.rs`, `native_scanner_test.rs`,
  `shared_scanner_test.rs`.

### Verified
- `cargo build --workspace` ✅
- `cargo clippy --workspace --all-targets` ✅ (exit 0; only pre-existing style nits)
- `cargo test --workspace` ✅ (all crates pass)
- `cargo build -p win-usn --features napi` ✅
- `cargo build -p gpu-compute --features cuda` ✅ (links against CUDA 12.4)

## Scanner performance, output schema & drill-down

### Added
- **`--drill <N>`** CLI flag: for the top N largest directories, walks their
  immediate children on the filesystem and attaches child subdirectory sizes and
  largest files inside each (`ScanReport.drill_down: HashMap<String, DirDrillDown>`).
  Lets a consumer see what is consuming space without re-scanning or manual digging.
  New types `DirDrillDown { children, largest_files }` in `gui_common.rs`.
- **`--progress-log <file>`** CLI flag: appends machine-readable progress events
  (one JSON object per line) to a file while the scan runs. Independent of stderr
  (live view) and stdout (final JSON), so a GUI or log watcher can tail structured
  progress. Each line is a progress snapshot; the final line is
  `{"type":"complete",...}`.
- **Human-readable size companions** across all output surfaces: `--format json`,
  `--format jsonl`, and `--format text` now emit `*_human` fields (e.g.
  `total_size_human`, `size_human`) alongside raw byte counts so results are
  interpretable without mental arithmetic.

### Changed
- **JSON output schema unified**: `generate_jsonl` and the curated
  `generate_json_pretty` now use consistent field names (`total_size` for
  directories, `size` for files) instead of the old `size_bytes` outlier.
- **Scan performance**: progress callback throttled to every 5,000 entries (was
  200), cutting ~25x the per-callback HashMap clones; `live_files` sort moved out
  of the hot per-file loop into the callback path. Home-directory deep scan dropped
  ~255s → ~180s (~30% faster).
- **Rayon thread pool** built once at CLI startup (`scan_command.rs`) instead of
  per-scan inside the scanner, where `build_global()` would silently fail (ignoring
  `--threads`) if the pool was already initialized. Warns if `--threads` can't apply.
- **Partial-scan elevation warning**: when ≥5 permission-denied errors occur the CLI
  warns to re-run from an elevated (Administrator) terminal.

### Removed
- Dead `ScanProgress.completed` field (set, never read).
- Dead `ScanOptions.size_buckets` and `cuda_enabled` fields (scanner never read
  `cuda_enabled`; `settings.cuda_enabled` is a separate struct).
- Dead `ScanResult.size_distribution` (populated by gpu-compute, never output).
- 300-line deprecated async `scan_with_progress` (marked unused; sync path is used).

### Verified
- `cargo clippy --workspace --all-targets` ✅ (exit 0; zero warnings)
- `cargo test --workspace` ✅ (all crates pass)
