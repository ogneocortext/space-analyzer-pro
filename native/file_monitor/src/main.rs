//! File Monitor CLI
//! 
//! Real-time file system monitoring with event batching, database integration,
//! and web API for Space Analyzer Pro.

use clap::{Parser, Subcommand};
use anyhow::Result;
use std::path::PathBuf;
use std::time::Duration;
use tracing::{info, error, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use file_monitor::{FileMonitor, MonitorConfig, SqliteEventStorage};

#[derive(Parser)]
#[command(
    name = "file-monitor",
    about = "Real-time file system monitoring with event batching and database integration",
    version = "1.0.0",
    author = "Space Analyzer Team"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Paths to watch (comma-separated)
    #[arg(short, long, value_delimiter = ',')]
    paths: Vec<PathBuf>,

    /// Watch recursively
    #[arg(short, long)]
    recursive: bool,

    /// Debounce duration in milliseconds
    #[arg(short, long, default_value = "500")]
    debounce: u64,

    /// Batch size for event processing
    #[arg(short, long, default_value = "100")]
    batch_size: usize,

    /// Include patterns (comma-separated)
    #[arg(short = 'I', long, value_delimiter = ',')]
    include: Vec<String>,

    /// Exclude patterns (comma-separated)
    #[arg(short, long, value_delimiter = ',')]
    exclude: Vec<String>,

    /// Database file path
    #[arg(short, long)]
    database: Option<PathBuf>,

    /// API server port
    #[arg(short, long)]
    port: Option<u16>,

    /// Log level
    #[arg(short, long, default_value = "info")]
    log_level: String,

    /// Run in foreground
    #[arg(long)]
    foreground: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start monitoring
    Start,
    /// Show recent events
    Events {
        /// Number of events to show
        #[arg(short, long, default_value = "50")]
        count: usize,
    },
    /// Show monitoring statistics
    Stats,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(&cli.log_level);

    // Create configuration
    let config = MonitorConfig {
        watch_paths: if cli.paths.is_empty() {
            vec![PathBuf::from(".")]
        } else {
            cli.paths
        },
        recursive: cli.recursive,
        debounce_duration: Duration::from_millis(cli.debounce),
        batch_size: cli.batch_size,
        include_patterns: cli.include,
        exclude_patterns: cli.exclude,
        database_path: cli.database,
        api_port: cli.port,
        log_level: cli.log_level,
    };

    // Execute command
    match cli.command {
        Commands::Start => {
            start_monitor(config).await?;
        }
        Commands::Events { count } => {
            show_events(config, count).await?;
        }
        Commands::Stats => {
            show_stats(config).await?;
        }
    }

    Ok(())
}

async fn start_monitor(config: MonitorConfig) -> Result<()> {
    info!("Starting file system monitor...");
    info!("Watch paths: {:?}", config.watch_paths);
    info!("Recursive: {}", config.recursive);
    info!("Debounce: {:?}", config.debounce_duration);

    let monitor = FileMonitor::new(config);

    // Add storage if database is configured
    let monitor = if let Some(database_path) = &monitor.config.database_path {
        let storage = SqliteEventStorage::new(database_path).await?;
        monitor.with_storage(Box::new(storage))
    } else {
        monitor
    };

    // Start monitoring
    monitor.start().await?;

    // Start API server if port is configured
    if let Some(port) = monitor.config.api_port {
        start_api_server(monitor, port).await?;
    }

    // Keep the process running
    info!("File monitor is running. Press Ctrl+C to stop.");
    
    tokio::signal::ctrl_c().await?;
    info!("Received shutdown signal, stopping monitor...");

    Ok(())
}

async fn show_events(config: MonitorConfig, count: usize) -> Result<()> {
    if let Some(database_path) = &config.database_path {
        let storage = SqliteEventStorage::new(database_path).await?;
        let events = storage.get_events(
            chrono::Utc::now() - Duration::from_secs(3600), // Last hour
            Some(count)
        ).await?;

        if events.is_empty() {
            println!("No recent events found.");
        } else {
            println!("Recent file system events:");
            println!("{}", "=".repeat(80));
            
            for event in events {
                match event {
                    file_monitor::FileSystemEvent::Created { path, size, modified } => {
                        println!("📁 CREATED  {} ({} bytes) at {}", 
                            path.display(), size, modified.format("%H:%M:%S"));
                    }
                    file_monitor::FileSystemEvent::Modified { path, size, modified } => {
                        println!("✏️  MODIFIED {} ({} bytes) at {}", 
                            path.display(), size, modified.format("%H:%M:%S"));
                    }
                    file_monitor::FileSystemEvent::Deleted { path, modified } => {
                        println!("🗑️  DELETED   {} at {}", 
                            path.display(), modified.format("%H:%M:%S"));
                    }
                    file_monitor::FileSystemEvent::Renamed { from, to, modified } => {
                        println!("🔄 RENAMED   {} → {} at {}", 
                            from.display(), to.display(), modified.format("%H:%M:%S"));
                    }
                    file_monitor::FileSystemEvent::PermissionChanged { path, modified } => {
                        println!("🔐 PERM      {} at {}", 
                            path.display(), modified.format("%H:%M:%S"));
                    }
                }
            }
        }
    } else {
        println!("No database configured. Use --database option to store events.");
    }

    Ok(())
}

async fn show_stats(config: MonitorConfig) -> Result<()> {
    if let Some(database_path) = &config.database_path {
        let storage = SqliteEventStorage::new(database_path).await?;
        let stats = storage.get_stats().await?;

        println!("File Monitor Statistics:");
        println!("{}", "=".repeat(40));
        println!("Events processed: {}", stats.events_processed);
        println!("Events filtered: {}", stats.events_filtered);
        println!("Batches processed: {}", stats.batches_processed);
        println!("Files created: {}", stats.files_created);
        println!("Files modified: {}", stats.files_modified);
        println!("Files deleted: {}", stats.files_deleted);
        println!("Files renamed: {}", stats.files_renamed);
        println!("Average batch size: {:.2}", stats.average_batch_size);
        println!("Uptime: {:?}", stats.uptime);
    } else {
        println!("No database configured. Use --database option to store events.");
    }

    Ok(())
}

async fn start_api_server(monitor: FileMonitor, port: u16) -> Result<()> {
    use axum::{
        extract::{Path, Query},
        http::StatusCode,
        response::Json,
        routing::{get, post},
        Router,
    };
    use serde::Deserialize;
    use std::collections::HashMap;

    #[derive(Deserialize)]
    struct EventQuery {
        since: Option<String>,
        limit: Option<usize>,
    }

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/events", get(get_events))
        .route("/stats", get(get_stats))
        .route("/config", get(get_config))
        .with_state(monitor);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("API server listening on port {}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": "file-monitor"
    }))
}

async fn get_events(
    axum::extract::State(monitor): axum::extract::State<FileMonitor>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let limit = params.get("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(50);

    match monitor.get_recent_events(Some(limit)).await {
        Ok(events) => Ok(Json(serde_json::json!({
            "events": events,
            "count": events.len()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_stats(
    axum::extract::State(monitor): axum::extract::State<FileMonitor>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let stats = monitor.get_stats().await;
    Ok(Json(serde_json::json!(stats)))
}

async fn get_config(
    axum::extract::State(monitor): axum::extract::State<FileMonitor>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!(monitor.config))
}

fn init_logging(level: &str) {
    let filter = match level.to_lowercase().as_str() {
        "trace" => "trace",
        "debug" => "debug",
        "info" => "info",
        "warn" => "warn",
        "error" => "error",
        _ => "info",
    };

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(filter)))
        .with(tracing_subscriber::fmt::layer())
        .init();
}