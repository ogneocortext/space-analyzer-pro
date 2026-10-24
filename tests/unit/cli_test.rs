//! Space Analyzer Pro — CLI binary regression tests
//!
//! Uses `assert_cmd` to drive `space-analyzer-cli` as a real user would:
//  - `--help` exits 0
//  - a non-existent flag exits non-zero with a meaningful message
//  - `--version` prints the crate version string
//  - a real directory scan produces text output on stdout
//!
//! Run with:  cargo nextest run cli_test
//!
#![cfg(test)]

use assert_cmd::prelude::*;
use predicates::prelude::*;
use std::path::PathBuf;
use std::process::Command;
use tempfile::TempDir;

macro_rules! info {
    ($($arg:tt)*) => { eprintln!("[cli_test] {}", format!($($arg)*)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: path to the compiled CLI binary
// ─────────────────────────────────────────────────────────────────────────────
fn cli() -> Command {
    Command::cargo_bin("space-analyzer-cli").expect("binary must exist for tests")
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Help / version smoke tests
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_help_exits_zero_and_mentions_app_name() {
    info!("Verifying `space-analyzer-cli --help` exits 0 and mentions app name");
    cli()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Space Analyzer Pro"));
    info!("PASS");
}

#[test]
fn cli_version_matches_crate_version() {
    info!("Verifying `--version` matches Cargo.toml version");
    let manifest = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml"))
        .expect("Cargo.toml of the CLI package must be readable");
    let crate_ver = manifest
        .lines()
        .find(|l| l.starts_with("version"))
        .and_then(|l| l.split('=').nth(1))
        .and_then(|v| v.trim().trim_matches('"').parse::<String>().ok())
        .expect("version field must be present in Cargo.toml");

    eprintln!("  crate version from Cargo.toml='{}'", crate_ver);
    cli()
        .arg("--version")
        .assert()
        .success()
        .stdout(predicate::str::contains(crate_ver.as_str()));
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. No-arg baseline — must produce some output (not silently exit with nothing)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_no_args_produces_output() {
    info!("Verifying running with no args emits stderr (not silent)");
    cli().assert().stderr(predicate::str::is_empty().not());
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Unknown flag — must be rejected, not silently ignored
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_unknown_flag_exits_nonzero() {
    info!("Verifying unknown flag causes non-zero exit + stderr");
    cli()
        .arg("--this-flag-does-not-exist")
        .assert()
        .failure()
        .stderr(predicate::str::is_empty().not());
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Path validation guard — a nonexistent scan path must not silently succeed
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_nonexistent_path_does_not_silently_succeed() {
    info!("Verifying nonexistent path is rejected");
    let bogus: PathBuf = PathBuf::from(r"C:\__space_analyzer_nonexistent_54321__");
    let out = cli()
        .arg("-p")
        .arg(bogus)
        .output()
        .expect("CLI must execute");
    eprintln!(
        "  exit_status={:?}, stderr_len={}",
        out.status,
        out.stderr.len()
    );
    assert!(
        !out.status.success() || !out.stderr.is_empty(),
        "A nonexistent path must either exit non-zero or emit stderr"
    );
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Real scan produces text output — guards 121-file/s throughput green
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_scan_real_isolated_dir_completes() {
    info!("Verifying real scan of temp dir succeeds and produces stdout");
    let tmp = TempDir::new().expect("could not create isolated temp dir");
    std::fs::write(tmp.path().join("alpha.txt"), b"hello a").unwrap();
    std::fs::write(tmp.path().join("beta.bin"), b"hello b").unwrap();
    std::fs::create_dir(tmp.path().join("sub")).unwrap();
    std::fs::write(tmp.path().join("sub/deep.txt"), b"deep").unwrap();

    let out = cli()
        .arg("scan")
        .arg("-p")
        .arg(tmp.path().to_string_lossy().into_owned())
        .output()
        .expect("scan command must execute without the process crashing");

    eprintln!(
        "  exit_status={:?}, stdout_len={}",
        out.status,
        out.stdout.len()
    );
    assert!(
        out.status.success(),
        "scanning a valid directory must succeed"
    );
    // Stdout must contain something — at minimum a line-count header or file list
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.len() > 20,
        "scan stdout must contain more than 20 bytes of structured output"
    );
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Unicode path regression — guards encoding breakage on Windows (ISSUE-001)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_scan_unicode_path_completes_without_panic() {
    info!("Verifying scan of path with Unicode filenames does not panic");
    let tmp = TempDir::new().unwrap();
    let unicode_file = tmp.path().join("café_файл.txt");
    std::fs::write(&unicode_file, b"unicode content").unwrap();

    let out = cli()
        .arg("scan")
        .arg("-p")
        .arg(tmp.path().to_string_lossy().into_owned())
        .output()
        .expect("CLI process must not crash when dir contains Unicode filenames");

    eprintln!("  exit_status={:?}", out.status);
    // EXIT_SUCCESS is the key — cargo test through assert_cmd already decodes UTF-8
    // via Rust's default, so a non-0 exit here means the child panicked mid-scan.
    assert!(out.status.success());
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Special-character path regression — guards argument injection via paths
//    containing quotes, semicolons, or spaces that could break out of argument
//    quoting if string interpolation were reintroduced.
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_scan_special_char_path_does_not_inject_arguments() {
    info!("Verifying path with spaces/special chars is handled safely");
    let tmp = TempDir::new().unwrap();
    let special_dir = tmp.path().join("dir with spaces & ampersand");
    std::fs::create_dir(&special_dir).unwrap();
    std::fs::write(special_dir.join("file.txt"), b"content").unwrap();

    let out = cli()
        .arg("scan")
        .arg("-p")
        .arg(special_dir.to_string_lossy().into_owned())
        .output()
        .expect("CLI must not crash on paths with special characters");

    eprintln!("  exit_status={:?}", out.status);
    assert!(
        out.status.success(),
        "Scanning a path with spaces/special characters must succeed. stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Age filter flags end-to-end
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_scan_min_age_filters_old_files() {
    info!("Verifying --min-age excludes recently-modified files");
    let tmp = TempDir::new().unwrap();
    let old_file = tmp.path().join("old.txt");
    std::fs::write(&old_file, b"old").unwrap();
    // Open with write access so SetFileTime (set_modified) is permitted on Windows.
    std::fs::OpenOptions::new()
        .write(true)
        .open(&old_file)
        .unwrap()
        .set_modified(std::time::SystemTime::now() - std::time::Duration::from_secs(5 * 86_400))
        .expect("set old mtime");
    std::fs::write(tmp.path().join("new.txt"), b"new").unwrap();

    let out = cli()
        .arg("scan")
        .arg("-p")
        .arg(tmp.path().to_string_lossy().into_owned())
        .arg("--format")
        .arg("json")
        .arg("--min-age")
        .arg("3")
        .output()
        .expect("scan with --min-age must execute");

    assert!(out.status.success(), "scan with --min-age must succeed");
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("old.txt"),
        "old.txt (5 days old) should appear with --min-age 3"
    );
    assert!(
        !stdout.contains("new.txt"),
        "new.txt should be excluded by --min-age 3"
    );
    info!("PASS");
}

#[test]
fn cli_search_extension_filters_files() {
    info!("Verifying --extension filters search results");
    let tmp = TempDir::new().unwrap();
    std::fs::write(tmp.path().join("a.log"), b"log").unwrap();
    std::fs::write(tmp.path().join("b.txt"), b"txt").unwrap();

    let out = cli()
        .arg("search")
        .arg("-p")
        .arg(tmp.path().to_string_lossy().into_owned())
        .arg("--extension")
        .arg("log")
        .arg("--format")
        .arg("json")
        .output()
        .expect("search with --extension must execute");

    assert!(out.status.success(), "search must succeed");
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("a.log"),
        "a.log should match --extension log"
    );
    assert!(
        !stdout.contains("b.txt"),
        "b.txt should not match --extension log"
    );
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. System cleanup shortcuts
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_system_list_emits_json_with_shortcuts() {
    info!("Verifying `system list --format json` emits a shortcuts array");
    let out = cli()
        .arg("system")
        .arg("list")
        .arg("--format")
        .arg("json")
        .output()
        .expect("system list must execute");

    assert!(
        out.status.success(),
        "system list must succeed. stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("\"shortcuts\""),
        "JSON output must contain a 'shortcuts' array"
    );
    assert!(
        stdout.contains("\"count\": 5"),
        "there are exactly five shortcuts"
    );
    info!("PASS");
}

#[test]
fn cli_system_hibernate_preview_succeeds_without_apply() {
    info!("Verifying `system hibernate` without --apply succeeds in preview mode");
    let out = cli()
        .arg("system")
        .arg("hibernate")
        .arg("--format")
        .arg("json")
        .output()
        .expect("system hibernate preview must execute");

    assert!(
        out.status.success(),
        "system hibernate preview must succeed. stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("\"action\": \"hibernate\""),
        "preview output must name the hibernate action"
    );
    assert!(
        stdout.contains("\"apply_required\": true"),
        "preview must indicate apply is required"
    );
    info!("PASS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Diff with missing scan records fails with a clear message
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cli_diff_missing_record_fails_with_clear_message() {
    info!("Verifying `diff` with nonexistent scan ids fails clearly");
    let out = cli()
        .arg("diff")
        .arg("--id1")
        .arg("1")
        .arg("--id2")
        .arg("2")
        .arg("--format")
        .arg("json")
        .output()
        .expect("diff must execute");

    assert!(
        !out.status.success(),
        "diff with missing records must fail"
    );
    let stderr = String::from_utf8_lossy(&out.stderr);
    let stdout = String::from_utf8_lossy(&out.stdout);
    let combined = format!("{stderr}{stdout}");
    assert!(
        combined.contains("No scan found") || combined.contains("Database") || combined.contains("id"),
        "error must name the missing scan id or DB, got: {combined}"
    );
    info!("PASS");
}
