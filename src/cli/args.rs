use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    author,
    version,
    about = "Space Analyzer Pro - Find and save disk space",
    long_about = "Space Analyzer Pro CLI helps you identify space hogs on your disk.\nIt scans directories, shows breakdowns by folder and file type,\nfinds duplicate files, and provides actionable recommendations."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Output format: text, json, csv, jsonl, or md
    #[arg(short, long, global = true, default_value = "text")]
    pub format: String,

    /// Number of top items to show in breakdowns (default: 20)
    #[arg(long, global = true, default_value = "20")]
    pub top: usize,

    /// Suppress animations and progress output
    #[arg(long, global = true)]
    pub no_animation: bool,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Scan a directory and report disk usage
    Scan {
        /// Directory to scan
        #[arg(short, long, default_value = ".")]
        path: String,

        /// Enable verbose scan output
        #[arg(short, long)]
        verbose: bool,

        /// Maximum scan depth (default: 5; unlimited when unset or with --deep)
        #[arg(long)]
        max_depth: Option<usize>,

        /// Perform deeper scanning heuristics (unlimited depth)
        #[arg(long)]
        deep: bool,

        /// Minimum file size to include (e.g. 1M, 500K, 1G)
        #[arg(long)]
        min_size: Option<String>,

        /// Maximum file size to include (e.g. 100M, 1G)
        #[arg(long)]
        max_size: Option<String>,

        /// Include hidden files and directories
        #[arg(long)]
        include_hidden: bool,

        /// Export results to a file
        #[arg(long)]
        export: Option<String>,

        /// Generate a markdown report after scanning
        #[arg(long)]
        report: bool,

        /// Run duplicate-file cleanup analysis
        #[arg(long)]
        clean: bool,

        /// Show actionable cleanup recommendations
        #[arg(long)]
        cleanup_recommendations: bool,

        /// Trace file origins and assess deletion safety
        #[arg(long)]
        trace_origins: bool,

        /// Drop scan JSON into a GUI channel dir
        #[arg(long)]
        channel: Option<String>,

        /// Ask an AI question about the scan results
        #[arg(long)]
        ask: Option<String>,
    },

    /// Show disk space info for all volumes as JSON
    DiskInfo {
        /// Optional path to infer mount point; ignored when absent
        #[arg(short, long, default_value = ".")]
        path: String,
    },

    /// Show recent scan history from the embedded database as JSON
    History {
        /// Maximum number of records to return
        #[arg(long, default_value = "50")]
        limit: usize,

        /// Show full details for one scan by ID
        #[arg(long)]
        id: Option<i64>,
    },

    /// Run duplicate-file analysis on a directory and output JSON
    Dedup {
        /// Directory to analyze
        #[arg(short, long, default_value = ".")]
        path: String,
    },
}
