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
