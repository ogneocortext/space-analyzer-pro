//! Output routing for human-facing report text.
//!
//! The CLI has two kinds of output:
//!
//! * **Data** — the JSON/CSV/JSONL/markdown document a script or GUI parses.
//!   It must be the only thing on stdout, exactly once.
//! * **Prose** — banners, section headers, recommendations, "report written
//!   to ..." notices. Useful to a human, fatal to a parser.
//!
//! Previously both went to `println!`, so `--format json --export out.json`
//! produced a JSON document followed by `✅ Results exported to: ...` and
//! failed to parse. This module lets the entry point declare once that prose
//! belongs on stderr; the [`hprintln!`] / [`hprint!`] macros then route every
//! human-facing line accordingly.

use std::cell::Cell;
use std::io::Write;

thread_local! {
    static HUMAN_TO_STDERR: Cell<bool> = const { Cell::new(false) };
}

/// Route human-facing report text to stderr instead of stdout.
///
/// Enabled whenever stdout has to stay machine-readable: any `--format` other
/// than `text`, or a `--stream` JSONL session.
pub fn route_human_output_to_stderr(enabled: bool) {
    HUMAN_TO_STDERR.with(|flag| flag.set(enabled));
}

/// Whether human-facing text is currently routed to stderr.
pub fn human_goes_to_stderr() -> bool {
    HUMAN_TO_STDERR.with(|flag| flag.get())
}

/// Flush whichever stream human-facing text is currently going to.
pub fn flush_human() {
    if human_goes_to_stderr() {
        let _ = std::io::stderr().flush();
    } else {
        let _ = std::io::stdout().flush();
    }
}

/// `println!` for human-facing prose: stdout in text mode, stderr otherwise.
#[macro_export]
macro_rules! hprintln {
    () => {
        if $crate::cli::sink::human_goes_to_stderr() {
            eprintln!()
        } else {
            println!()
        }
    };
    ($($arg:tt)*) => {
        if $crate::cli::sink::human_goes_to_stderr() {
            eprintln!($($arg)*)
        } else {
            println!($($arg)*)
        }
    };
}

/// `print!` for human-facing prose: stdout in text mode, stderr otherwise.
#[macro_export]
macro_rules! hprint {
    ($($arg:tt)*) => {
        if $crate::cli::sink::human_goes_to_stderr() {
            eprint!($($arg)*)
        } else {
            print!($($arg)*)
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routing_defaults_to_stdout_and_toggles() {
        route_human_output_to_stderr(false);
        assert!(!human_goes_to_stderr());
        route_human_output_to_stderr(true);
        assert!(human_goes_to_stderr());
        route_human_output_to_stderr(false);
        assert!(!human_goes_to_stderr());
    }
}
