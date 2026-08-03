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

        /// Maximum scan depth (default: 5; unlimited with --deep, root-only with --shallow)
        #[arg(long)]
        max_depth: Option<usize>,

        /// Perform deeper scanning heuristics (unlimited depth)
        #[arg(long)]
        deep: bool,

        /// Shallow scan: root directory only (depth = 1)
        #[arg(long)]
        shallow: bool,

        /// Minimum file size to include (e.g. 1M, 500K, 1G)
        #[arg(long)]
        min_size: Option<String>,

        /// Maximum file size to include (e.g. 100M, 1G)
        #[arg(long)]
        max_size: Option<String>,

        /// Include hidden files and directories
        #[arg(long)]
        include_hidden: bool,

        /// Number of parallel threads for directory traversal (0 = auto)
        #[arg(long, default_value = "0")]
        threads: usize,

        /// Enable file cache (skip unchanged files from previous scan)
        #[arg(long)]
        cache: bool,

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

        /// Stream results as JSONL to stdout (one JSON object per line) instead of
        /// a single JSON document at the end. Enables real-time UI updates.
        #[arg(long)]
        stream: bool,
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

        /// Number of records to skip (for pagination)
        #[arg(long, default_value = "0")]
        offset: usize,

        /// Search/filter by path (case-insensitive substring match)
        #[arg(long)]
        search: Option<String>,

        /// Sort by: timestamp (default), path, total_files, total_size_bytes, duration_secs
        #[arg(long, default_value = "timestamp")]
        sort_by: String,

        /// Sort ascending (default: descending/newest first)
        #[arg(long)]
        sort_asc: bool,

        /// Show full details for one scan by ID
        #[arg(long)]
        id: Option<i64>,

        /// Delete a scan record by ID
        #[arg(long)]
        delete: Option<i64>,

        /// Prune duplicate scan records, keeping only the newest entry per
        /// (path, total size, file count). Also removes orphaned
        /// duplicate-analysis and embedding rows for the deleted scans.
        #[arg(long)]
        prune: bool,

        /// When pruning, also drop records whose path is not absolute
        /// (e.g. relative "." scans that don't resolve to a real directory).
        #[arg(long)]
        drop_relative: bool,
    },

    /// Run duplicate-file analysis on a directory and output JSON
    Dedup {
        /// Directory to analyze
        #[arg(short, long, default_value = ".")]
        path: String,
    },

    /// Read or write settings in the embedded database as raw key/value pairs
    Settings {
        /// Print all stored settings
        #[arg(long)]
        get: bool,

        /// Set a single setting; requires --key and --value
        #[arg(long)]
        set: bool,

        /// Setting key to read or write
        #[arg(long)]
        key: Option<String>,

        /// Setting value to write (paired with --key)
        #[arg(long)]
        value: Option<String>,
    },

    /// Database maintenance: vacuum free pages, inspect the freelist, and
    /// prune workflow execution history beyond the retention cap.
    Db {
        /// Reclaim free pages left behind by deleted rows (VACUUM)
        #[arg(long)]
        vacuum: bool,

        /// Show the freelist and table row counts
        #[arg(long)]
        info: bool,

        /// Trim workflow execution history to the newest N records (default 100)
        #[arg(long, default_value = "100")]
        prune_workflows: usize,
    },
}
