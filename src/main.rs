mod animation;
mod cli;

use std::io;

/// Exit codes follow the GNU/clig.dev convention:
///   0 — success
///   1 — general error (scan failure, I/O error, etc.)
///   2 — usage error (bad arguments, invalid flags, path errors)
fn main() {
    match cli::main() {
        Ok(()) => {}
        Err(e) => {
            let code = exit_code(&e);
            // Broken pipe (EPIPE) is expected when a user pipes output into
            // `head`/`less`/etc. Exit quietly instead of printing an error.
            if is_broken_pipe(&e) {
                std::process::exit(code);
            }
            eprintln!("❌ Error: {}", e);
            std::process::exit(code);
        }
    }
}

/// Map an `AppError` to a process exit code.
/// Usage/validation errors -> 2, everything else -> 1.
fn exit_code(e: &space_analyzer_pro_desktop::error::AppError) -> i32 {
    match e {
        space_analyzer_pro_desktop::error::AppError::Cli(_)
        | space_analyzer_pro_desktop::error::AppError::Validation(_)
        | space_analyzer_pro_desktop::error::AppError::InvalidMinSize(_) => 2,
        _ => 1,
    }
}

/// True when the error chain contains a broken pipe (EPIPE) — the consumer
/// closed the output stream (e.g. piping into `head`). Exit quietly.
fn is_broken_pipe(e: &space_analyzer_pro_desktop::error::AppError) -> bool {
    match e {
        space_analyzer_pro_desktop::error::AppError::Io(io) => {
            io.kind() == io::ErrorKind::BrokenPipe
        }
        // A Scanner error wraps anyhow, which may wrap io::Error.
        space_analyzer_pro_desktop::error::AppError::Scanner(any) => any.chain().any(|cause| {
            cause
                .downcast_ref::<io::Error>()
                .map(|io| io.kind() == io::ErrorKind::BrokenPipe)
                .unwrap_or(false)
        }),
        _ => false,
    }
}
