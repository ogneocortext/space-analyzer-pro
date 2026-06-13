use clap::Parser;

/// Command-line interface for the Space Analyzer Pro desktop binary.
#[derive(Debug, Parser)]
#[command(
    author,
    version,
    about = "Space Analyzer Pro - Find and save disk space",
    long_about = "Space Analyzer Pro CLI helps you identify space hogs on your disk.\nIt scans directories, shows breakdowns by folder and file type,\nfinds duplicate files, and provides actionable recommendations."
)]
pub struct Cli {
    /// Directory to scan
    #[arg(short, long, default_value = ".")]
    pub path: String,

    /// Output format: text, json, or csv
    #[arg(short, long, default_value = "text")]
    pub format: String,

    /// Enable verbose scan output
    #[arg(short, long)]
    pub verbose: bool,

    /// Perform deeper scanning heuristics (unlimited depth)
    #[arg(long)]
    pub deep: bool,

    /// Export results to a file
    #[arg(long)]
    pub export: Option<String>,

    /// Generate a markdown report after scanning
    #[arg(long)]
    pub report: bool,

    /// Run duplicate-file cleanup analysis
    #[arg(long)]
    pub clean: bool,

    /// Show actionable cleanup recommendations
    #[arg(long)]
    pub cleanup_recommendations: bool,

    /// Minimum file size to include in results (e.g. 1M, 500K, 1G)
    #[arg(long)]
    pub min_size: Option<String>,

    /// Number of top items to show in breakdowns (default: 20)
    #[arg(long, default_value = "20")]
    pub top: usize,

    /// Drop scan JSON into a GUI channel dir
    #[arg(long)]
    pub channel: Option<String>,
}
