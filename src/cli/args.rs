use clap::{Args, Parser, Subcommand, ValueEnum};
use std::fmt;

const EXAMPLES: &str = "\
EXAMPLES:
  # Scan the current directory with the default depth of 5
  space-analyzer-cli scan

  # Scan a specific folder (positional or -p both work)
  space-analyzer-cli scan D:\\Projects
  space-analyzer-cli scan -p D:\\Projects

  # Unlimited depth, only files of 100 MB or more, saved as a markdown report
  space-analyzer-cli scan D:\\ --deep --min-size 100MB --report

  # Machine-readable output for scripting (stdout stays a single JSON document)
  space-analyzer-cli --format json scan D:\\Projects > scan.json

  # Line-delimited events for a live UI
  space-analyzer-cli scan D:\\Projects --stream

  # Preview duplicate files, then reclaim space with hard links
  space-analyzer-cli dedup D:\\Projects
  space-analyzer-cli dedup D:\\Projects --apply --yes

  # Inspect and maintain the embedded database
  space-analyzer-cli history --limit 10
  space-analyzer-cli db --info
";

/// Output format for machine- and human-readable results.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
#[value(rename_all = "lower")]
pub enum OutputFormat {
    /// Human-readable terminal report (default)
    Text,
    /// A single pretty-printed JSON document
    Json,
    /// Sectioned comma-separated values
    Csv,
    /// JSON Lines: one JSON object per line
    Jsonl,
    /// Markdown report
    #[value(alias = "markdown")]
    Md,
}

impl OutputFormat {
    /// True when stdout must carry structured data only, so every human-facing
    /// notice has to be routed to stderr instead.
    pub fn is_machine_readable(self) -> bool {
        !matches!(self, OutputFormat::Text)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            OutputFormat::Text => "text",
            OutputFormat::Json => "json",
            OutputFormat::Csv => "csv",
            OutputFormat::Jsonl => "jsonl",
            OutputFormat::Md => "md",
        }
    }
}

impl fmt::Display for OutputFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Parse a count that must be at least 1, so `--top 0` / `--max-depth 0`
/// are rejected by clap instead of silently producing an empty report.
pub(crate) fn parse_at_least_one(raw: &str) -> Result<usize, String> {
    let value: usize = raw
        .parse()
        .map_err(|_| format!("`{raw}` is not a whole number"))?;
    if value == 0 {
        return Err("value must be at least 1".to_string());
    }
    Ok(value)
}

#[derive(Debug, Parser)]
#[command(
    author,
    version,
    about = "Space Analyzer Pro - Find and save disk space",
    long_about = "Space Analyzer Pro CLI helps you identify space hogs on your disk.\nIt scans directories, shows breakdowns by folder and file type,\nfinds duplicate files, and provides actionable recommendations.",
    after_help = EXAMPLES,
    after_long_help = EXAMPLES
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Output format. Only `scan` renders every format; `history`, `disk-info`
    /// and `db --info` always emit JSON.
    #[arg(short, long, global = true, value_enum, default_value_t = OutputFormat::Text)]
    pub format: OutputFormat,

    /// Number of top items to show in breakdowns (minimum 1)
    #[arg(long, global = true, default_value = "20", value_parser = parse_at_least_one)]
    pub top: usize,

    /// Suppress animations and progress output
    #[arg(long, global = true)]
    pub no_animation: bool,

    /// Assume "yes" for destructive prompts (deduplication, history deletion)
    #[arg(short = 'y', long, global = true)]
    pub yes: bool,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Scan a directory and report disk usage
    Scan {
        /// Directory to scan (defaults to the current directory)
        #[arg(value_name = "PATH")]
        path: Option<String>,

        /// Directory to scan; flag form of the positional PATH argument
        #[arg(
            short = 'p',
            long = "path",
            value_name = "PATH",
            conflicts_with = "path"
        )]
        path_flag: Option<String>,

        /// Show extra sections: scan throughput and empty directories
        #[arg(short, long)]
        verbose: bool,

        /// Maximum scan depth (minimum 1, default 5)
        #[arg(long, value_parser = parse_at_least_one, conflicts_with_all = ["deep", "shallow"])]
        max_depth: Option<usize>,

        /// Perform deeper scanning heuristics (unlimited depth)
        #[arg(long, conflicts_with = "shallow")]
        deep: bool,

        /// Shallow scan: root directory only (depth = 1)
        #[arg(long)]
        shallow: bool,

        /// Minimum file size to include (e.g. 1M, 500K, 1GB)
        #[arg(long)]
        min_size: Option<String>,

        /// Maximum file size to include (e.g. 100M, 1GB)
        #[arg(long)]
        max_size: Option<String>,

        /// Include hidden files and directories
        #[arg(long)]
        include_hidden: bool,

        /// Number of parallel threads for directory traversal (0 = auto)
        #[arg(long, default_value = "0")]
        threads: usize,

        /// Disable GPU-accelerated post-processing (force CPU)
        #[arg(long)]
        no_gpu: bool,

        /// Enable file cache (skip unchanged files from previous scan)
        #[arg(long)]
        cache: bool,

        /// Export results to a file (parent directories are created)
        #[arg(long)]
        export: Option<String>,

        /// Generate a markdown report after scanning
        #[arg(long)]
        report: bool,

        /// Directory for `--report` output (default: ./reports)
        #[arg(long, value_name = "DIR")]
        report_dir: Option<String>,

        /// Run duplicate-file cleanup analysis
        #[arg(long)]
        clean: bool,

        /// Show actionable cleanup recommendations
        #[arg(long)]
        cleanup_recommendations: bool,

        /// Trace file origins and assess deletion safety
        #[arg(long)]
        trace_origins: bool,

        /// Ask an AI question about the scan results
        #[arg(long)]
        ask: Option<String>,

        /// Stream results as JSONL to stdout (one JSON object per line) instead of
        /// a single JSON document at the end. Enables real-time UI updates.
        #[arg(long)]
        stream: bool,

        /// Emit `__PROGRESS__<json>` progress lines on stderr for host processes
        /// (off by default so interactive runs stay quiet)
        #[arg(long, conflicts_with = "stream")]
        progress_json: bool,

        /// Include the full per-file list (`scanned_files`) in machine-readable
        /// output. Off by default: for large trees that map can exceed the size of
        /// every other field combined, so the summary (top directories, category
        /// sizes, largest files, cleanup estimate) is emitted on its own. Turn this
        /// on only when you need every individual path.
        #[arg(long)]
        files: bool,

        /// Persist the scan result to the embedded scan-history database. When set,
        /// a final `{"type":"saved","id":<id>}` JSON line is emitted on stdout (in
        /// `--stream` mode) so a host UI can jump straight to the saved record.
        #[arg(long)]
        save_history: bool,
    },

    /// Show disk space info as JSON: every volume, or just the one holding PATH
    DiskInfo {
        /// Report only the volume that contains this path
        #[arg(short, long, value_name = "PATH")]
        path: Option<String>,
    },

    /// Show recent scan history from the embedded database as JSON
    History {
        /// Maximum number of records to return
        #[arg(long, default_value = "50", value_parser = parse_at_least_one)]
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

        /// Delete a scan record by ID (requires confirmation or --yes)
        #[arg(long)]
        delete: Option<i64>,

        /// Prune duplicate scan records, keeping only the newest entry per
        /// (path, total size, file count). Also removes orphaned
        /// duplicate-analysis and embedding rows for the deleted scans.
        /// Requires confirmation or --yes.
        #[arg(long)]
        prune: bool,

        /// When pruning, also drop records whose path is not absolute
        /// (e.g. relative "." scans that don't resolve to a real directory).
        #[arg(long)]
        drop_relative: bool,

        /// Recompute the per-category size breakdown for any cached scan that
        /// predates the category column. Reads only the already-stored
        /// extension sizes, so it never touches the filesystem.
        #[arg(long)]
        backfill_categories: bool,

        /// Delete scan records that captured nothing (zero files). These are
        /// empty scans (e.g. of a temporary directory) that carry no metrics.
        #[arg(long)]
        prune_empty: bool,

        /// Delete ALL scan history records (and their embeddings/duplicate
        /// analysis). Requires confirmation. This is destructive.
        #[arg(long)]
        clear: bool,

        /// Only return scans whose folder has been scanned more than once
        /// (re-scans of the same directory). Combines with --search, --sort-by,
        /// --limit and --offset so the result stays paginated.
        #[arg(long)]
        only_duplicates: bool,

        /// Return a lightweight chronological series of every scan
        /// (id, path, timestamp, total size) for trend charts. The response
        /// carries no per-scan JSON payload, so it stays cheap for large
        /// history. Mutually exclusive in intent with the other mutating flags.
        #[arg(
            long,
            conflicts_with = "prune",
            conflicts_with = "prune_empty",
            conflicts_with = "clear",
            conflicts_with = "backfill_categories"
        )]
        trend: bool,

        /// Aggregate the per-category size breakdown across every scan-history
        /// record and return the summed bytes per category as a JSON object.
        /// Powers the "Library Composition" donut on the History page without
        /// re-scanning. Read-only.
        #[arg(
            long,
            conflicts_with = "prune",
            conflicts_with = "prune_empty",
            conflicts_with = "clear",
            conflicts_with = "backfill_categories",
            conflicts_with = "trend"
        )]
        category_totals: bool,

        /// Return the stored duplicate-file analysis for a scan. Requires --id;
        /// prints the saved result (or an empty array when none exists) instead
        /// of the scan record itself.
        #[arg(long, requires = "id")]
        duplicates: bool,

        /// Ask the local Ollama model to produce a 2-3 sentence AI summary of
        /// the most recent (or --id) scan. Requires Ollama running.
        #[arg(long)]
        summarize: bool,

        /// Include semantic-index-only scan records (created by `embed` with no
        /// real scan) in the results. These are normally hidden from the history
        /// list; the agentic assistant passes this flag to locate an existing
        /// embedding index for reuse.
        #[arg(long)]
        include_index_only: bool,
    },

    /// Run duplicate-file analysis on a directory and output JSON
    Dedup {
        /// Directory to analyze (defaults to the current directory)
        #[arg(value_name = "PATH")]
        path: Option<String>,

        /// Directory to analyze; flag form of the positional PATH argument
        #[arg(
            short = 'p',
            long = "path",
            value_name = "PATH",
            conflicts_with = "path"
        )]
        path_flag: Option<String>,

        /// Minimum file size to consider (e.g. 1M, 500K, 1GB)
        #[arg(long)]
        min_size: Option<String>,

        /// Maximum file size to consider (e.g. 100M, 1GB)
        #[arg(long)]
        max_size: Option<String>,

        /// Disable GPU-accelerated batch hashing (force CPU)
        #[arg(long)]
        no_gpu: bool,

        /// Actually create hard links to reclaim space (default: dry-run preview).
        /// Requires confirmation or --yes.
        #[arg(long)]
        apply: bool,

        /// Link the persisted analysis to a specific scan-history record instead
        /// of the most recent scan of the same path. Used by the GUI so the result
        /// is attached to the scan the user is currently viewing.
        #[arg(long)]
        scan_id: Option<i64>,
    },

    /// Read or write settings in the embedded database as raw key/value pairs
    Settings {
        /// Print stored settings (all of them, or just --key)
        #[arg(long)]
        get: bool,

        /// Set a single setting; requires --key and --value
        #[arg(long, conflicts_with = "get")]
        set: bool,

        /// Setting key to read or write
        #[arg(long)]
        key: Option<String>,

        /// Setting value to write (paired with --key)
        #[arg(long)]
        value: Option<String>,
    },

    /// Database maintenance: inspect the freelist, vacuum free pages, and
    /// prune workflow execution history. Without a flag this only reports
    /// status; it never deletes anything implicitly.
    Db {
        /// Reclaim free pages left behind by deleted rows (VACUUM)
        #[arg(long)]
        vacuum: bool,

        /// Show the freelist and table row counts (default action)
        #[arg(long)]
        info: bool,

        /// Trim workflow execution history to the newest N records
        #[arg(long, value_name = "N")]
        prune_workflows: Option<usize>,

        /// Remove per-scan file-cache rows whose directory no longer has any
        /// saved scan history (stale incremental-scan caches)
        #[arg(long)]
        prune_file_cache: bool,

        /// Drop disk-space snapshots older than N hours (minimum 1)
        #[arg(long, value_name = "HOURS", value_parser = parse_at_least_one)]
        prune_disk_space: Option<usize>,
    },

    /// Trace file relationships and assess deletion impact for a single file
    Dependencies {
        /// File to analyze (e.g. C:\path\to\file.ext)
        #[arg(value_name = "PATH")]
        path: String,
    },

    /// Generate and store semantic embeddings for the files in a directory
    Embed {
        /// Directory to embed (defaults to the current directory)
        #[arg(value_name = "PATH")]
        path: Option<String>,

        /// Attach embeddings to an existing scan record (otherwise a new scan
        /// record is created and its id is returned)
        #[arg(long)]
        scan_id: Option<i64>,

        /// Minimum file size to include (e.g. 1M, 500K)
        #[arg(long)]
        min_size: Option<String>,

        /// Maximum file size to include (e.g. 100M, 1GB)
        #[arg(long)]
        max_size: Option<String>,

        /// Include hidden files and directories
        #[arg(long)]
        include_hidden: bool,

        /// Disable GPU-accelerated batch embedding (force CPU)
        #[arg(long)]
        no_gpu: bool,

        /// Skip embedding when the target scan already has a fresh index for the
        /// current embedding model. Reuses the existing index instead of paying
        /// the Ollama cost to rebuild it (used by the AI assistant, which indexes
        /// on first query and wants to reuse that index on later queries).
        #[arg(long)]
        if_not_indexed: bool,
    },

    /// Natural-language file search over a previously embedded scan
    SemanticSearch {
        /// Natural-language query (e.g. "large video files from last year")
        #[arg(value_name = "QUERY")]
        query: String,

        /// Scan id whose embeddings to search
        #[arg(long)]
        scan_id: i64,

        /// Number of best matches to return (minimum 1)
        #[arg(long, default_value = "20", value_parser = parse_at_least_one)]
        top: usize,

        /// Ignore matches whose cosine similarity is below this value (0..1).
        /// Useful to drop irrelevant "central document" hits when embeddings
        /// compress scores into a narrow band.
        #[arg(long)]
        min_score: Option<f32>,
    },

    /// Inspect NTFS USN change journals (incremental-scan support)
    Usn {
        #[command(subcommand)]
        command: UsnCommand,
    },

    /// Detect bloat candidates in a stored scan using the Rust offline_ai classifier
    Bloat {
        /// Analyze a specific scan record by id (defaults to the most recent scan)
        #[arg(long)]
        scan_id: Option<i64>,

        /// Maximum number of bloat findings to return
        #[arg(long, default_value = "15")]
        top: usize,
    },

    /// Project future disk usage from the scan-history size trend (Rust storage prediction)
    Predict {
        /// Number of days to project ahead
        #[arg(long, default_value = "30")]
        days: usize,

        /// Maximum number of historical scans to use for the trend
        #[arg(long, default_value = "50")]
        limit: usize,
    },

    /// Surface cleanup recommendations for a stored scan (Rust rule engine)
    Recommend {
        /// Analyze a specific scan record by id (defaults to the most recent scan)
        #[arg(long)]
        scan_id: Option<i64>,

        /// Maximum number of recommendations to return (sorted by priority)
        #[arg(long, default_value = "50")]
        top: usize,
    },

    /// Ask the local Ollama model a free-form question about a saved scan,
    /// answered with read-only tool-calling (scan history, disk volumes,
    /// system resources, storage trend, bloat findings, cleanup
    /// recommendations, and per-file origin classification). Reconstructs the
    /// scan report from the embedded database so it never re-scans the disk.
    /// Requires Ollama running.
    Ask {
        /// The question to ask (wrap in quotes, e.g. "what is using the most space?")
        #[arg(value_name = "QUESTION")]
        question: String,

        /// Analyze a specific saved scan record by id (defaults to the most recent scan)
        #[arg(long)]
        scan_id: Option<i64>,
    },

    /// Enumerate installed applications and dev tools, then flag installs that are
    /// duplicated across drives/paths or present in multiple versions
    AppInventory,

    /// Real, bounded filesystem search: walk a directory tree and return every
    /// file matching the extension/keyword/size filters (capped at --limit).
    Search(SearchArgs),
}

/// Arguments for the `search` subcommand.
#[derive(Debug, Args)]
pub struct SearchArgs {
    /// Directory to search (defaults to the current directory)
    #[arg(value_name = "PATH")]
    pub path: Option<String>,

    /// Directory to search; flag form of the positional PATH argument
    #[arg(
        short = 'p',
        long = "path",
        value_name = "PATH",
        conflicts_with = "path"
    )]
    pub path_flag: Option<String>,

    /// Match only files with this extension (case-insensitive; leading `.` optional)
    #[arg(long)]
    pub extension: Option<String>,

    /// Case-insensitive substring match against the full file path
    #[arg(long)]
    pub keyword: Option<String>,

    /// Minimum file size to include (e.g. 1M, 500K, 1GB)
    #[arg(long)]
    pub min_size: Option<String>,

    /// Maximum file size to include (e.g. 100M, 1GB)
    #[arg(long)]
    pub max_size: Option<String>,

    /// Include hidden files and directories
    #[arg(long)]
    pub include_hidden: bool,

    /// Maximum traversal depth (minimum 1; whole subtree by default)
    #[arg(long, value_parser = parse_at_least_one)]
    pub max_depth: Option<usize>,

    /// Maximum number of matches to return (minimum 1)
    #[arg(long, default_value = "100", value_parser = parse_at_least_one)]
    pub limit: usize,

    /// Emit `__PROGRESS__<json>` progress lines on stderr for host processes
    /// (e.g. the WinUI AI assistant streaming tool progress), instead of running
    /// the interactive live view.
    #[arg(long)]
    pub progress_json: bool,
}

/// Sub-commands for inspecting NTFS USN change journals.
#[derive(Debug, Subcommand)]
pub enum UsnCommand {
    /// List volumes that have a USN journal available
    Volumes,
    /// Show journal status for a drive (omit to use the system drive)
    Status {
        /// Drive letter, e.g. C: or C (defaults to the system drive)
        #[arg(value_name = "DRIVE")]
        drive: Option<String>,
    },
    /// Read recent changes recorded in the USN journal for a drive
    Changes {
        /// Drive letter, e.g. C: or C
        #[arg(value_name = "DRIVE")]
        drive: String,
        /// Maximum number of change records to read
        #[arg(long, default_value = "1000", value_parser = parse_at_least_one)]
        max: usize,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    #[test]
    fn cli_definition_is_valid() {
        Cli::command().debug_assert();
    }

    #[test]
    fn top_and_max_depth_reject_zero() {
        assert!(parse_at_least_one("0").is_err());
        assert!(parse_at_least_one("-1").is_err());
        assert_eq!(parse_at_least_one("1").unwrap(), 1);
    }

    #[test]
    fn deep_and_shallow_conflict() {
        let err = Cli::try_parse_from(["sa", "scan", "--deep", "--shallow"]);
        assert!(err.is_err(), "--deep and --shallow must conflict");
    }

    #[test]
    fn deep_and_max_depth_conflict() {
        let err = Cli::try_parse_from(["sa", "scan", "--deep", "--max-depth", "3"]);
        assert!(err.is_err(), "--deep and --max-depth must conflict");
    }

    #[test]
    fn positional_and_flag_path_both_parse() {
        let positional = Cli::try_parse_from(["sa", "scan", "some-dir"]).unwrap();
        let flagged = Cli::try_parse_from(["sa", "scan", "-p", "some-dir"]).unwrap();
        for cli in [positional, flagged] {
            match cli.command {
                Commands::Scan {
                    path, path_flag, ..
                } => assert_eq!(
                    path_flag.or(path).as_deref(),
                    Some("some-dir"),
                    "both spellings must resolve to the same directory"
                ),
                _ => panic!("expected the scan subcommand"),
            }
        }
    }

    #[test]
    fn invalid_format_is_rejected_for_every_subcommand() {
        assert!(Cli::try_parse_from(["sa", "--format", "bogus", "history"]).is_err());
        assert!(Cli::try_parse_from(["sa", "--format", "bogus", "scan"]).is_err());
        assert!(Cli::try_parse_from(["sa", "--format", "markdown", "scan"]).is_ok());
    }
}
