use assert_cmd::Command;
use std::time::Instant;
use serde_json::Value;

fn binary_name() -> &'static str {
    if cfg!(windows) {
        "space-analyzer-cli.exe"
    } else {
        "space-analyzer-cli"
    }
}

fn find_binary() -> Option<std::path::PathBuf> {
    let candidates = [
        std::path::PathBuf::from(env!("CARGO_BIN_EXE_space-analyzer-cli")),
        std::path::PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(binary_name()),
        std::path::PathBuf::from("target").join("debug").join(binary_name()),
        std::path::PathBuf::from("target").join("release").join(binary_name()),
    ];
    candidates.into_iter().find(|p| p.exists())
}

#[test]
fn benchmark_documents_folder_through_cli() {
    let Some(binary) = find_binary() else {
        eprintln!("Skipping: space-analyzer-cli binary not found");
        return;
    };

    let path = r"C:\Users\Aomega Imaging\Documents";
    if !std::path::Path::new(path).exists() {
        eprintln!("Skipping: {path} does not exist on this machine");
        return;
    }

    let cases: Vec<(&str, Vec<&str>)> = vec![
        ("shallow",         vec!["--shallow"]),
        ("medium (depth 5)", vec!["--max-depth", "5"]),
        ("deep",            vec!["--deep"]),
        ("deep+hidden",     vec!["--deep", "--include-hidden"]),
    ];

    eprintln!("Binary: {}", binary.display());
    eprintln!("Scanning: {path}");
    eprintln!("{:<16} {:>6} {:>6} {:>10} {:>10} {:>8}", "Mode", "Files", "Dirs", "Size", "Time", "Files/s");
    eprintln!("{:-<58}", "");

    let mut last_files: Option<u64> = None;
    for (label, flags) in cases {
        let mut cmd = Command::new(&binary);
        cmd.args(["scan", "--path", path, "--format", "json"]).args(&flags);

        let start = Instant::now();
        let output = match cmd.output() {
            Ok(o) if o.status.success() => o,
            Ok(o) => {
                eprintln!("{:<16} FAILED (exit {}): {}", label, o.status.code().unwrap_or(-1), String::from_utf8_lossy(&o.stderr));
                continue;
            }
            Err(e) => {
                eprintln!("{:<16} ERROR: {e}", label);
                continue;
            }
        };
        let elapsed = start.elapsed();

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json: Value = match serde_json::from_str(&stdout) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("{:<16} JSON parse error: {e}", label);
                eprintln!("  stdout: {}", stdout.chars().take(200).collect::<String>());
                continue;
            }
        };

        let files = json.get("total_files").and_then(|v| v.as_u64()).unwrap_or(0);
        let dirs  = json.get("total_dirs").and_then(|v| v.as_u64()).or_else(|| json.get("total_directories").and_then(|v| v.as_u64())).unwrap_or(0);
        let size  = json.get("total_size_bytes").and_then(|v| v.as_u64()).unwrap_or(0);
        let secs  = elapsed.as_secs_f64();
        let f_per_s = if secs > 0.0 { files as f64 / secs } else { 0.0 };
        let size_mb = size as f64 / (1024.0 * 1024.0);

        eprintln!(
            "{:<16} {:>6} {:>6} {:>9.1}MB {:>7.2}s {:>7.0}/s",
            label, files, dirs, size_mb, secs, f_per_s
        );

        if let Some(prev) = last_files {
            assert!(files >= prev, "deeper scan ({label}) found fewer files than shallower scan");
        }
        last_files = Some(files);
    }
}
