use clap::Parser;

/// Command-line interface for the Space Analyzer Pro desktop binary.
#[derive(Debug, Parser)]
#[command(author, version, about = "Space Analyzer Pro - Desktop Application")]
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

    /// Perform deeper scanning heuristics
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
}
