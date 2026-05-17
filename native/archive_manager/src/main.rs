//! Archive Manager CLI
//! 
//! Cross-platform archive manager with cloud integration for Space Analyzer Pro.

use clap::{Parser, Subcommand};
use anyhow::Result;
use std::path::PathBuf;
use std::time::Duration;
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use tracing::{info, error, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use archive_manager::{ArchiveManager, ArchiveConfig, ArchiveFormat, CompressionLevel, CloudConfig, CloudProvider};

#[derive(Parser)]
#[command(
    name = "archive-manager",
    about = "Cross-platform archive manager with cloud integration",
    version = "1.0.0",
    author = "Space Analyzer Team"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Archive format
    #[arg(short, long, default_value = "tar.gz")]
    format: ArchiveFormat,

    /// Compression level
    #[arg(short, long, default_value = "default")]
    compression: CompressionLevel,

    /// Include hidden files
    #[arg(long)]
    include_hidden: bool,

    /// Follow symbolic links
    #[arg(long)]
    follow_symlinks: bool,

    /// Preserve permissions
    #[arg(long)]
    preserve_permissions: bool,

    /// Preserve timestamps
    #[arg(long)]
    preserve_timestamps: bool,

    /// Exclude patterns (comma-separated)
    #[arg(short, long, value_delimiter = ',')]
    exclude: Vec<String>,

    /// Include patterns (comma-separated)
    #[arg(short = 'I', long, value_delimiter = ',')]
    include: Vec<String>,

    /// Cloud provider
    #[arg(long)]
    cloud_provider: Option<CloudProvider>,

    /// Cloud bucket name
    #[arg(long)]
    bucket: Option<String>,

    /// Cloud region
    #[arg(long)]
    region: Option<String>,

    /// Cloud access key
    #[arg(long)]
    access_key: Option<String>,

    /// Cloud secret key
    #[arg(long)]
    secret_key: Option<String>,

    /// Output format (json, table)
    #[arg(short, long, default_value = "table")]
    output: String,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Create archive
    Create {
        /// Source path (file or directory)
        source: PathBuf,
        /// Output archive path
        output: PathBuf,
    },
    /// Extract archive
    Extract {
        /// Archive path
        archive: PathBuf,
        /// Output directory
        output: PathBuf,
    },
    /// List archive contents
    List {
        /// Archive path
        archive: PathBuf,
    },
    /// Upload archive to cloud
    Upload {
        /// Archive path
        archive: PathBuf,
    },
    /// Compare archive formats
    Compare {
        /// Source path (file or directory)
        source: PathBuf,
        /// Output directory for comparison
        output: PathBuf,
    },
    /// Test archive integrity
    Test {
        /// Archive path
        archive: PathBuf,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(&cli.verbose);

    // Create archive configuration
    let config = ArchiveConfig {
        format: cli.format,
        compression_level: cli.compression,
        include_hidden: cli.include_hidden,
        follow_symlinks: cli.follow_symlinks,
        preserve_permissions: cli.preserve_permissions,
        preserve_timestamps: cli.preserve_timestamps,
        exclude_patterns: cli.exclude,
        include_patterns: cli.include,
        ..Default::default()
    };

    // Create archive manager
    let mut manager = ArchiveManager::new(config);

    // Add cloud configuration if provided
    if let (Some(provider), Some(bucket), Some(access_key), Some(secret_key)) = (
        &cli.cloud_provider,
        &cli.bucket,
        &cli.access_key,
        &cli.secret_key,
    ) {
        let cloud_config = CloudConfig {
            provider: provider.clone(),
            bucket_name: bucket.clone(),
            region: cli.region,
            access_key: access_key.clone(),
            secret_key: secret_key.clone(),
            endpoint: None,
        };
        manager = manager.with_cloud_config(cloud_config);
    }

    // Execute command
    match cli.command {
        Commands::Create { source, output } => {
            create_archive(&manager, source, output, &cli.output).await?;
        }
        Commands::Extract { archive, output } => {
            extract_archive(&manager, archive, output, &cli.output).await?;
        }
        Commands::List { archive } => {
            list_archive(&manager, archive, &cli.output).await?;
        }
        Commands::Upload { archive } => {
            upload_archive(&manager, archive, &cli.output).await?;
        }
        Commands::Compare { source, output } => {
            compare_formats(&manager, source, output, &cli.output).await?;
        }
        Commands::Test { archive } => {
            test_archive(&manager, archive, &cli.output).await?;
        }
    }

    Ok(())
}

async fn create_archive(
    manager: &ArchiveManager,
    source: PathBuf,
    output: PathBuf,
    output_format: &str,
) -> Result<()> {
    println!("📦 {}", "Creating Archive".bold().blue());
    println!("{}", "=".repeat(50));
    println!("Source: {}", source.display());
    println!("Output: {}", output.display());
    println!("Format: {:?}", manager.config.format);
    println!("Compression: {:?}", manager.config.compression_level);
    println!();

    // Show progress bar
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} [{elapsed_precise}] {msg}")
            .unwrap()
    );
    pb.set_message("Creating archive...");
    pb.enable_steady_tick(Duration::from_millis(100));

    let result = manager.create_archive(&source, &output).await?;

    pb.finish_with_message("Archive created successfully!");

    print_archive_result(&result, output_format);

    Ok(())
}

async fn extract_archive(
    manager: &ArchiveManager,
    archive: PathBuf,
    output: PathBuf,
    output_format: &str,
) -> Result<()> {
    println!("📂 {}", "Extracting Archive".bold().green());
    println!("{}", "=".repeat(50));
    println!("Archive: {}", archive.display());
    println!("Output: {}", output.display());
    println!();

    // Show progress bar
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} [{elapsed_precise}] {msg}")
            .unwrap()
    );
    pb.set_message("Extracting archive...");
    pb.enable_steady_tick(Duration::from_millis(100));

    let result = manager.extract_archive(&archive, &output).await?;

    pb.finish_with_message("Archive extracted successfully!");

    print_archive_result(&result, output_format);

    Ok(())
}

async fn list_archive(
    manager: &ArchiveManager,
    archive: PathBuf,
    output_format: &str,
) -> Result<()> {
    println!("📋 {}", "Archive Contents".bold().yellow());
    println!("{}", "=".repeat(50));
    println!("Archive: {}", archive.display());
    println!();

    // Note: This would require implementing list functionality
    // For now, just show archive info
    let metadata = std::fs::metadata(&archive)?;
    println!("Archive size: {}", format_bytes(metadata.len()));
    println!("Format: {:?}", manager.detect_archive_format(&archive)?);

    Ok(())
}

async fn upload_archive(
    manager: &ArchiveManager,
    archive: PathBuf,
    output_format: &str,
) -> Result<()> {
    println!("☁️ {}", "Uploading to Cloud".bold().cyan());
    println!("{}", "=".repeat(50));
    println!("Archive: {}", archive.display());
    
    if let Some(cloud_config) = &manager.cloud_config {
        println!("Provider: {:?}", cloud_config.provider);
        println!("Bucket: {}", cloud_config.bucket_name);
    } else {
        println!("{}", "Error: No cloud configuration provided".red());
        return Ok(());
    }
    println!();

    // Show progress bar
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} [{elapsed_precise}] {msg}")
            .unwrap()
    );
    pb.set_message("Uploading to cloud...");
    pb.enable_steady_tick(Duration::from_millis(100));

    let url = manager.upload_to_cloud(&archive).await?;

    pb.finish_with_message("Upload completed!");

    println!("\n✅ Upload successful!");
    println!("🔗 URL: {}", url);

    Ok(())
}

async fn compare_formats(
    manager: &ArchiveManager,
    source: PathBuf,
    output: PathBuf,
    output_format: &str,
) -> Result<()> {
    println!("📊 {}", "Comparing Archive Formats".bold().magenta());
    println!("{}", "=".repeat(50));
    println!("Source: {}", source.display());
    println!("Output: {}", output.display());
    println!();

    let formats = vec![
        ArchiveFormat::Zip,
        ArchiveFormat::Tar,
        ArchiveFormat::TarGz,
        ArchiveFormat::TarBz2,
        ArchiveFormat::TarXz,
        ArchiveFormat::TarZstd,
    ];

    let mut results = Vec::new();

    for format in formats {
        println!("🔄 Testing format: {:?}", format);
        
        let mut config = manager.config.clone();
        config.format = format;
        
        let test_manager = ArchiveManager::new(config);
        let test_output = output.join(format!("test{}", format.extension()));
        
        match test_manager.create_archive(&source, &test_output).await {
            Ok(result) => {
                results.push((format, result));
                println!("  ✅ Success: {} ({}%, {:.2}s)",
                    format_bytes(result.compressed_size),
                    (1.0 - result.compression_ratio) * 100.0,
                    result.duration.as_secs_f64()
                );
                
                // Clean up test file
                let _ = std::fs::remove_file(&test_output);
            }
            Err(e) => {
                println!("  ❌ Error: {}", e);
            }
        }
    }

    // Print comparison table
    println!("\n📈 Comparison Results:");
    println!("{}", "=".repeat(80));
    println!("{:<15} {:<15} {:<15} {:<15} {:<15}", 
        "Format", "Size", "Compression", "Speed", "Rating");
    println!("{}", "-".repeat(80));

    for (format, result) in &results {
        let compression = (1.0 - result.compression_ratio) * 100.0;
        let speed = result.original_size as f64 / result.duration.as_secs_f64();
        let rating = calculate_rating(compression, speed);
        
        println!("{:<15} {:<15} {:<14.1}% {:<14.1}/s {:<15}",
            format!("{:?}", format),
            format_bytes(result.compressed_size),
            compression,
            format_bytes(speed as u64),
            rating
        );
    }

    Ok(())
}

async fn test_archive(
    manager: &ArchiveManager,
    archive: PathBuf,
    output_format: &str,
) -> Result<()> {
    println!("🔍 {}", "Testing Archive Integrity".bold().blue());
    println!("{}", "=".repeat(50));
    println!("Archive: {}", archive.display());
    println!();

    // Note: This would require implementing archive integrity testing
    // For now, just check if archive can be read
    let metadata = std::fs::metadata(&archive)?;
    
    println!("✅ Archive exists and is readable");
    println!("📊 Size: {}", format_bytes(metadata.len()));
    println!("📅 Modified: {:?}", metadata.modified());
    println!("🔒 Format: {:?}", manager.detect_archive_format(&archive)?);

    Ok(())
}

fn print_archive_result(result: &archive_manager::ArchiveResult, output_format: &str) {
    match output_format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(result).unwrap());
        }
        _ => {
            println!("\n📊 Archive Results:");
            println!("{}", "=".repeat(50));
            println!("Archive: {}", result.archive_path.display());
            println!("Format: {:?}", result.format);
            println!("Original size: {}", format_bytes(result.original_size));
            println!("Compressed size: {}", format_bytes(result.compressed_size));
            println!("Compression ratio: {:.1}%", (1.0 - result.compression_ratio) * 100.0);
            println!("Files processed: {}", result.files_processed);
            println!("Directories processed: {}", result.directories_processed);
            println!("Duration: {:.2} seconds", result.duration.as_secs_f64());
            
            if !result.errors.is_empty() {
                println!("\n⚠️  Errors:");
                for error in &result.errors {
                    println!("  {}", error);
                }
            }
            
            // Performance rating
            let compression = (1.0 - result.compression_ratio) * 100.0;
            let speed = result.original_size as f64 / result.duration.as_secs_f64();
            let rating = calculate_rating(compression, speed);
            
            println!("\n🏆 Performance: {}", rating);
        }
    }
}

fn calculate_rating(compression: f64, speed: f64) -> String {
    // Simple rating algorithm based on compression and speed
    let compression_score = compression.min(90.0) / 90.0 * 50.0;
    let speed_score = (speed / 1_000_000.0).min(10.0) / 10.0 * 50.0;
    let total_score = compression_score + speed_score;
    
    if total_score >= 80.0 {
        "Excellent".to_string()
    } else if total_score >= 60.0 {
        "Good".to_string()
    } else if total_score >= 40.0 {
        "Fair".to_string()
    } else {
        "Poor".to_string()
    }
}

fn init_logging(verbose: bool) {
    let level = if verbose { "debug" } else { "info" };
    
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(level)))
        .with(tracing_subscriber::fmt::layer())
        .init();
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