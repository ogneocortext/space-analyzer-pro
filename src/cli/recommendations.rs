use crate::cli::render;
use crate::cli::types::ScanResult;

/// Print cleanup recommendations. Delegates to the shared `render` module so
/// the text report and this standalone call never diverge in logic.
///
/// Goes to stdout in text mode and to stderr whenever stdout has to stay a
/// single machine-readable document (see [`crate::cli::sink`]).
pub fn print_cleanup_recommendations(result: &ScanResult) {
    crate::hprintln!();
    render::render_recommendations_text(&render::build_recommendations(result));
}
