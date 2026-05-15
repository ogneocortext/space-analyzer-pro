//! File Deduplicator CLI
//! 
//! High-performance file deduplication tool with BLAKE3 hashing and hard link support.
//! Provides command-line interface for easy use and integration.

use clap::{Parser, Subcommand};
use anyhow::Result;
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use std::path::PathBuf;
use std::time::Duration;

use file_deduplicator::{FileDeduplicator, DeduplicationConfig, DeduplicationResult};

#[derive(Parser)]
#[command(
    name = "file-deduplicator",
    about = "High-performance file deduplicator with BLAKE3 hashing and hard link support",
    version = "1.0.0",
    author = "Space Analyzer Team"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Directory to scan for duplicates
    #[arg(short, long, default_value = ".")]
    directory: PathBuf,

    /// Minimum file size to consider (in bytes)
    #[arg(short, long, default_value = "1024")]
    min_size: u64,

    /// Maximum file size to consider (in bytes)
    #[arg(short, long)]
    max_size: Option<u64>,

    /// Follow symbolic links
    #[arg(short, long)]
    follow_symlinks: bool,

    /// Patterns to exclude (comma-separated)
    #[arg(short, long, value_delimiter = ',')]
    exclude: Vec<String>,

    /// Patterns to include (comma-separated)
    #[arg(short = 'I', long, value_delimiter = ',')]
    include: Vec<String>,

    /// Number of parallel jobs
    #[arg(short, long)]
    jobs: Option<usize>,

    /// Dry run (don't actually deduplicate)
    #[arg(long)]
    dry_run: bool,

    /// Create hard links for deduplication
    #[arg(long)]
    hard_links: bool,

    /// Output format (json, table)
    #[arg(short, long, default_value = "table")]
    output: String,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Scan for duplicate files
    Scan,
    /// Deduplicate files
    Deduplicate,
    /// Run complete process (scan + deduplicate)
    Run,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Create configuration
    let config = DeduplicationConfig {
        min_file_size: cli.min_size,
        max_file_size: cli.max_size,
        follow_symlinks: cli.follow_symlinks,
        exclude_patterns: cli.exclude,
        include_patterns: cli.include,
        dry_run: cli.dry_run,
        create_hard_links: cli.hard_links,
        parallel_jobs: cli.jobs,
    };

    // Create deduplicator
    let mut deduplicator = FileDeduplicator::with_config(config);

    // Setup progress bar if verbose
    if cli.verbose {
        let pb = ProgressBar::new_spinner();
        pb.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} [{elapsed_precise}] {msg}")
                .unwrap()
        );
        pb.set_message("Initializing...");
        pb.enable_steady_tick(Duration::from_millis(100));

        deduplicator.set_progress_callback(move |count| {
            pb.set_message(format!("Processed {} files", count));
        });
    }

    // Execute command
    match cli.command {
        Commands::Scan => {
            println!("🔍 {}", "Scanning for duplicate files...".bold().blue());
            let files = deduplicator.scan_directory(&cli.directory)?;
            let duplicate_groups = deduplicator.find_duplicates(files);
            
            print_results(&duplicate_groups, &cli.output, cli.dry_run);
        }
        Commands::Deduplicate => {
            if cli.dry_run {
                println!("🔍 {}", "Dry run mode - no files will be modified".bold().yellow());
            }
            
            println!("🔗 {}", "Deduplicating files...".bold().green());
            let files = deduplicator.scan_directory(&cli.directory)?;
            let duplicate_groups = deduplicator.find_duplicates(files);
            let result = deduplicator.deduplicate(&duplicate_groups)?;
            
            print_deduplication_result(&result, &cli.output);
        }
        Commands::Run => {
            if cli.dry_run {
                println!("🔍 {}", "Dry run mode - no files will be modified".bold().yellow());
            }
            
            println!("🚀 {}", "Running complete deduplication process...".bold().magenta());
            let result = deduplicator.run(&cli.directory)?;
            
            print_deduplication_result(&result, &cli.output);
        }
    }

    Ok(())
}

fn print_results(duplicate_groups: &[file_deduplicator::DuplicateGroup], output_format: &str, dry_run: bool) {
    if duplicate_groups.is_empty() {
        println!("✅ {}", "No duplicate files found!".bold().green());
        return;
    }

    match output_format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(duplicate_groups).unwrap());
        }
        _ => {
            println!("\n{}", "Duplicate Files Found:".bold().underline());
            println!("{}", "=".repeat(50));
            
            let mut total_duplicates = 0;
            let mut total_size = 0u64;

            for (i, group) in duplicate_groups.iter().enumerate() {
                println!("\n{}. Group {} ({} files, {})", 
                    i + 1,
                    group.hash[..8].to_string().bright_black(),
                    group.files.len(),
                    format_bytes(group.size)
                );
                
                for file in &group.files {
                    println!("   📄 {}", file.path.display());
                    println!("      Size: {}, Modified: {}", 
                        format_bytes(file.size),
                        file.modified.format("%Y-%m-%d %H:%M:%S")
                    );
                }
                
                total_duplicates += group.files.len() - 1;
                total_size += group.size * (group.files.len() - 1) as u64;
            }

            println!("\n{}", "Summary:".bold());
            println!("  Duplicate groups: {}", duplicate_groups.len());
            println!("  Total duplicate files: {}", total_duplicates);
            println!("  Potential space savings: {}", format_bytes(total_size));
            
            if dry_run {
                println!("\n{}", "💡 Run with --no-dry-run to actually deduplicate files".bold().yellow());
            }
        }
    }
}

fn print_deduplication_result(result: &DeduplicationResult, output_format: &str) {
    match output_format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(result).unwrap());
        }
        _ => {
            println!("\n{}", "Deduplication Results:".bold().underline());
            println!("{}", "=".repeat(50));
            
            println!("📁 Files scanned: {}", result.total_files_scanned);
            println!("🔄 Duplicate groups: {}", result.duplicate_groups.len());
            println!("✅ Files processed: {}", result.files_processed);
            
            if result.space_saved > 0 {
                println!("💾 Space saved: {}", format_bytes(result.space_saved));
            }
            
            if !result.errors.is_empty() {
                println!("\n{}", "Errors:".bold().red());
                for error in &result.errors {
                    println!("  ❌ {}", error);
                }
            }
            
            if !result.duplicate_groups.is_empty() {
                println!("\n{}", "Deduplicated Groups:".bold());
                for (i, group) in result.duplicate_groups.iter().enumerate() {
                    if group.files.len() > 1 {
                        println!("  {}. {} ({} files)", 
                            i + 1,
                            group.hash[..8].to_string().bright_black(),
                            group.files.len()
                        );
                    }
                }
            }
        }
    }
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    format!("{:.2} {}", size, UNITS[unit_index])
}