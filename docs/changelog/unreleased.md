# [Unreleased]

## Scanner engine rework

### Removed
- **`gpu-compute` crate removed** — GPU acceleration was never implemented; post-processing
  always fell back to CPU with rayon. The crate added build complexity and a CUDA
  dependency path for zero runtime benefit. All post-processing (extension counts,
  size histograms, top-N largest files, per-directory aggregates) now runs in
  `scan-engine/src/post_process.rs` with rayon parallelism.

### Changed
- **Parallel metadata collection** — `scan_directory_sync` now walks the tree
  sequentially (WalkDir is inherently sequential) but processes per-entry metadata
  syscalls in parallel using `rayon::par_iter`. Results are merged after the walk,
  giving a measurable speedup on large directory trees.
- **`should_include_file` is now a static method** — no longer takes `&self` since
  it doesn't use instance state, making it safe to call from parallel closures.

## CI pipeline

### Fixed
- **`just ci` now passes end-to-end**: `fmt-check` → `clippy-strict` → `test` all green
  (`cargo fmt --all -- --check` exit 0, `cargo clippy --workspace --all-targets -- -D warnings`
  exit 0, `cargo test --workspace` 125 passed / 0 failed).
- **71 pre-existing rustfmt deviations fixed** with `cargo fmt --all` (only
  recently-edited files affected: `src/cli/{args,dedup,diff,helpers,live_scan,search,system}.rs`,
  `tests/unit/{cli_test,shared_scanner_test}.rs`).

# [4.3.0] - 2026-10-24

### Added
- **Unit tests for age filtering** (`--min-age`/`--max-age`): `helpers.rs` tests for
  `parse_age_days`/`validate_age_window` (plain values, negative, fractional, empty,
  inverted windows); `shared_scanner_test.rs` tests proving scans respect
  `min_age_days`, `max_age_days`, and that an inverted window matches nothing.
- **Unit tests for `diff` subcommand**: `diff.rs` tests for `format_size_delta`,
  `diff_hash_map`, `diff_dir_entries`, `diff_largest_files` (changed-only, empty
  when unchanged, sorted by abs delta).
- **Unit tests for `system` subcommand**: `system.rs` tests for `require_apply`
  destructive-action gate (rejects no-apply, apply-without-yes, yes-without-apply),
  `available_shortcuts` shape (5 actions + names/descriptions), `emit` JSON path.
- **Unit tests for CLI arg parsing**: `args.rs` tests for `--min-age`/`--max-age` on
  scan+search, `--apply`/`--yes` on system (live on `SystemArgs`, not `SystemCommand`),
  `diff --id1/--id2`.
- **Integration tests in `cli_test.rs`**: `scan --min-age` excludes recently-modified
  files; `search --extension` filters results; `system list --format json` emits a
  shortcuts array with `count: 5`; `system hibernate` preview succeeds without
  `--apply`; `diff` with missing scan ids fails clearly.

### Fixed
- **`parse_age_days` signature** changed from `Result<Option<u64>>` to `Result<u64>`:
  clap could not downcast `Option<u64>` from a value parser returning `Option<u64>`;
  clap wraps `Option` automatically for `T`-returning parsers.
- **`set_modified` uses `OpenOptions::write(true)`** on Windows so `SetFileTime`
  (required for age-filter tests on temp files) is permitted.

### Verified
- `cargo build --workspace` ✅ exit 0
- `cargo clippy --workspace --all-targets` ✅ exit 0; zero warnings
- `cargo test --workspace` (excl. `gpu-compute`/`node_modules_cleaner`) ✅ all tests pass

## File organization

### Changed
- **Stray root screenshots/media relocated**: all PNG screenshots (`art-direction`,
  `docs-page`, `health-final`, `image-generation`, `media-library`,
  `music-video-*`, `mv-final`, `queue-page`, `settings-page`, `vertical-display`,
  `visualizer-page`) and media files (`test-track.mp3`, `test-upload.wav`) moved from
  the repo root into `docs/screenshots/ux-audit-2026-10-24/{page,media}/` per AGENTS.md
  convention.
- **Native Media AI Studio UI screenshots moved out of this repo**: all 14 screenshots
  that depict NMAI Studio (Art Direction, Docs, Diagnostics/Health, Job Queue,
  Settings, Music Video Studio, Visualizer, Image Generation, Media Library) plus both
  media files were relocated to
  `D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio\docs\screenshots\ux-audit-2026-10-24/`.
  Vision review confirmed they all show NMAI Studio UI, not Space Analyzer.

## Scan progress visibility fixes

### Fixed
- **Live progress now renders by default** (`src/cli/scan.rs`): removed the `--verbose`
  requirement and `--no-animation` gate from the live progress display. The live view
  now renders whenever stderr is a terminal (or `SPACE_ANALYZER_FORCE_LIVE` is set),
  regardless of animation flags. The fallback spinner also now shows without
  `--verbose` when live progress can't render.
- **Live progress no longer cleared before results** (`src/cli/scan.rs`): removed the
  premature `live.finish()` call that cleared the last progress frame before `output_results()`
  printed, leaving a blank gap between progress and the final report.
- **GPU post-processing progress gap closed** (`scan-engine/src/scanner_progress.rs`):
  added a "finalizing" progress callback (99.5%) after `processor.process()` completes,
  so users no longer see 99% then silence while large entry lists are aggregated,
  categorized, and sorted.
- **`--clean` dedup progress messages** (`src/cli/dedup.rs`): added "Scanning for
  duplicate files" and "N files indexed" messages before the content-hashing walk so
  users know `--clean` is actively working instead of appearing stuck.
- **Progress events now include `elapsed_secs`** (`scan-engine/src/types.rs`,
  `scan-engine/src/scanner_progress.rs`, `src/cli/scan.rs`): every progress snapshot
  records how long the scan has been running, so watchers and GUIs can display elapsed
  time and compute estimated time remaining.
- **`finalizing` progress callback uses accumulated counters** (`scan-engine/src/scanner_progress.rs`):
  the 99.5% "finalizing" event now reports the correct `files_scanned` and `total_size`
  instead of zeros, by using the in-loop accumulators rather than `result.*` fields
  that aren't populated until `apply_gpu_result` runs.

## Scan progress streaming and Windows native build environment

### Changed
- **Scan progress is reported during directory enumeration**, before the scanner
  finishes buffering the tree. Progress events identify `enumerating`, `scanning`,
  `processing`, and `complete` phases; enumeration reports discovered-entry counts
  without mislabeling them as already-scanned files. File processing emits updates at
  least every 500 ms or 1,024 entries. The CLI JSON stream and progress log carry the
  phase data, and the WinUI scan status and assistant tool bubble show the current phase.

### Fixed
- **MSVC-targeted Rust builds no longer inherit MinGW C objects accidentally.** When
  the shell exports `CC=gcc` from MSYS2, AWS-LC can compile GNU objects that the
  `x86_64-pc-windows-msvc` linker cannot consume. Build from the Visual Studio
  developer environment with `CC` cleared for that command; see `gui-winui/README.md`.

### Verified
- Release CLI build succeeded from the Visual Studio developer environment with
  `CC` cleared; the WinUI output scanner matched the release binary.
- `cargo fmt --all -- --check`, Clippy, and all 30 `scan-engine` tests passed.
- Workspace tests passed with three slow live Ollama tests skipped. In the full
  `just verify` run, those three live model requests timed out; the other 122 library
  tests passed.

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
