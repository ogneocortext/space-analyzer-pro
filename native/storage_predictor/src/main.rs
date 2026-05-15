//! Storage Predictor CLI
//! 
//! ML-powered storage prediction and trend analysis for Space Analyzer Pro.

use clap::{Parser, Subcommand};
use anyhow::Result;
use std::path::PathBuf;
use std::time::Duration;
use chrono::{Utc, Duration as ChronoDuration};
use tracing::{info, error, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use storage_predictor::{StoragePredictor, ModelConfig, PredictionAlgorithm, StorageDataPoint};

#[derive(Parser)]
#[command(
    name = "storage-predictor",
    about = "ML-powered storage prediction and trend analysis engine",
    version = "1.0.0",
    author = "Space Analyzer Team"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Database file path
    #[arg(short, long)]
    database: Option<PathBuf>,

    /// Algorithm to use
    #[arg(short, long, default_value = "ensemble")]
    algorithm: PredictionAlgorithm,

    /// Training window in days
    #[arg(short, long, default_value = "30")]
    training_window: u32,

    /// Prediction horizon in days
    #[arg(short, long, default_value = "7")]
    horizon: u32,

    /// Output format (json, table)
    #[arg(short, long, default_value = "table")]
    output: String,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Train prediction models
    Train,
    /// Predict future storage usage
    Predict {
        /// Number of days to predict ahead
        #[arg(short, long, default_value = "7")]
        days: u32,
    },
    /// Detect anomalies in storage usage
    DetectAnomalies,
    /// Analyze storage trends
    AnalyzeTrends,
    /// Add current storage data point
    AddData {
        /// Total storage size in bytes
        #[arg(long)]
        total_size: u64,
        /// Used storage size in bytes
        #[arg(long)]
        used_size: u64,
        /// Number of files
        #[arg(long)]
        file_count: u64,
        /// Number of directories
        #[arg(long)]
        directory_count: u64,
        /// Largest file size in bytes
        #[arg(long)]
        largest_file_size: u64,
    },
    /// Show model performance metrics
    Metrics,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(&cli.verbose);

    // Create configuration
    let config = ModelConfig {
        algorithm: cli.algorithm,
        training_window_days: cli.training_window,
        prediction_horizon_days: cli.horizon,
        ..Default::default()
    };

    // Create predictor
    let mut predictor = StoragePredictor::new(config);

    // Add database if provided
    if let Some(db_path) = &cli.database {
        predictor = predictor.with_database(db_path.clone());
        // Load historical data
        predictor.load_data(cli.training_window).await?;
    }

    // Execute command
    match cli.command {
        Commands::Train => {
            train_models(&mut predictor).await?;
        }
        Commands::Predict { days } => {
            predict_storage(&mut predictor, days, &cli.output).await?;
        }
        Commands::DetectAnomalies => {
            detect_anomalies(&mut predictor, &cli.output).await?;
        }
        Commands::AnalyzeTrends => {
            analyze_trends(&mut predictor, &cli.output).await?;
        }
        Commands::AddData {
            total_size,
            used_size,
            file_count,
            directory_count,
            largest_file_size,
        } => {
            add_data_point(&mut predictor, total_size, used_size, file_count, directory_count, largest_file_size).await?;
        }
        Commands::Metrics => {
            show_metrics(&mut predictor).await?;
        }
    }

    Ok(())
}

async fn train_models(predictor: &mut StoragePredictor) -> Result<()> {
    info!("Training prediction models...");
    
    match predictor.train_models() {
        Ok(_) => {
            println!("✅ Models trained successfully!");
            println!("📊 Available models: linear_regression, decision_tree, ensemble");
        }
        Err(e) => {
            error!("Failed to train models: {}", e);
            return Err(e);
        }
    }

    Ok(())
}

async fn predict_storage(predictor: &mut StoragePredictor, days: u32, output_format: &str) -> Result<()> {
    info!("Predicting storage usage for {} days...", days);
    
    match predictor.predict(days) {
        Ok(predictions) => {
            print_predictions(&predictions, output_format);
        }
        Err(e) => {
            error!("Failed to generate predictions: {}", e);
            return Err(e);
        }
    }

    Ok(())
}

async fn detect_anomalies(predictor: &mut StoragePredictor, output_format: &str) -> Result<()> {
    info!("Detecting storage anomalies...");
    
    match predictor.detect_anomalies() {
        Ok(anomalies) => {
            print_anomalies(&anomalies, output_format);
        }
        Err(e) => {
            error!("Failed to detect anomalies: {}", e);
            return Err(e);
        }
    }

    Ok(())
}

async fn analyze_trends(predictor: &mut StoragePredictor, output_format: &str) -> Result<()> {
    info!("Analyzing storage trends...");
    
    match predictor.analyze_trends() {
        Ok(trends) => {
            print_trends(&trends, output_format);
        }
        Err(e) => {
            error!("Failed to analyze trends: {}", e);
            return Err(e);
        }
    }

    Ok(())
}

async fn add_data_point(
    predictor: &mut StoragePredictor,
    total_size: u64,
    used_size: u64,
    file_count: u64,
    directory_count: u64,
    largest_file_size: u64,
) -> Result<()> {
    let free_size = total_size.saturating_sub(used_size);
    let average_file_size = if file_count > 0 {
        used_size as f64 / file_count as f64
    } else {
        0.0
    };

    let data_point = StorageDataPoint {
        timestamp: Utc::now(),
        total_size,
        used_size,
        free_size,
        file_count,
        directory_count,
        largest_file_size,
        average_file_size,
    };

    predictor.add_data_point(data_point);
    
    println!("✅ Data point added successfully!");
    println!("📊 Total: {}, Used: {}, Free: {}", 
        format_bytes(total_size),
        format_bytes(used_size),
        format_bytes(free_size));
    println!("📁 Files: {}, Directories: {}", file_count, directory_count);

    // Save to database if configured
    if let Some(db_path) = &predictor.database_path {
        save_to_database(db_path, &data_point).await?;
    }

    Ok(())
}

async fn show_metrics(predictor: &mut StoragePredictor) -> Result<()> {
    println!("📊 Storage Predictor Metrics");
    println!("{}", "=".repeat(40));
    
    // Data statistics
    println!("Data Points: {}", predictor.data.len());
    
    if !predictor.data.is_empty() {
        let latest = &predictor.data[predictor.data.len() - 1];
        let earliest = &predictor.data[0];
        
        println!("Time Range: {} to {}", 
            earliest.timestamp.format("%Y-%m-%d"),
            latest.timestamp.format("%Y-%m-%d"));
        println!("Latest Usage: {} / {} ({:.1}%)", 
            format_bytes(latest.used_size),
            format_bytes(latest.total_size),
            (latest.used_size as f64 / latest.total_size as f64) * 100.0);
        
        // Model information
        println!("\n🤖 Available Models:");
        for model_name in predictor.models.keys() {
            println!("  - {}", model_name);
        }
        
        // Quick trend analysis
        if let Ok(trends) = predictor.analyze_trends() {
            println!("\n📈 Quick Trend Analysis:");
            println!("  Direction: {:?}", trends.trend_direction);
            println!("  Growth Rate: {}/day", format_bytes(trends.growth_rate_per_day as u64));
            if let Some(days_to_full) = trends.time_to_full_days {
                println!("  Time to Full: {} days", days_to_full);
            }
            println!("  Confidence: {:.1}%", trends.confidence * 100.0);
        }
    }

    Ok(())
}

fn print_predictions(predictions: &[storage_predictor::PredictionResult], output_format: &str) {
    match output_format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(predictions).unwrap());
        }
        _ => {
            println!("\n🔮 Storage Predictions");
            println!("{}", "=".repeat(80));
            println!("{:<15} {:<15} {:<15} {:<10} {:<15}", 
                "Date", "Used", "Free", "Confidence", "Model");
            println!("{}", "-".repeat(80));
            
            for pred in predictions {
                println!("{:<15} {:<15} {:<15} {:<10.1}% {:<15}",
                    pred.timestamp.format("%Y-%m-%d"),
                    format_bytes(pred.predicted_used_size),
                    format_bytes(pred.predicted_free_size),
                    pred.confidence * 100.0,
                    pred.model_used
                );
            }
        }
    }
}

fn print_anomalies(anomalies: &[storage_predictor::AnomalyResult], output_format: &str) {
    if anomalies.is_empty() {
        println!("✅ No anomalies detected in the storage data.");
        return;
    }

    match output_format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(anomalies).unwrap());
        }
        _ => {
            println!("\n⚠️  Storage Anomalies Detected");
            println!("{}", "=".repeat(80));
            println!("{:<15} {:<15} {:<10} {:<20} {:<15}", 
                "Date", "Type", "Severity", "Description", "Confidence");
            println!("{}", "-".repeat(80));
            
            for anomaly in anomalies {
                println!("{:<15} {:<15} {:<10} {:<20} {:<15.1}%",
                    anomaly.timestamp.format("%Y-%m-%d"),
                    format!("{:?}", anomaly.anomaly_type),
                    format!("{:?}", anomaly.severity),
                    truncate_string(&anomaly.description, 20),
                    anomaly.confidence * 100.0
                );
            }
        }
    }
}

fn print_trends(trends: &storage_predictor::TrendAnalysis, output_format: &str) {
    match output_format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(trends).unwrap());
        }
        _ => {
            println!("\n📈 Storage Trend Analysis");
            println!("{}", "=".repeat(50));
            println!("Trend Direction: {:?}", trends.trend_direction);
            println!("Growth Rate: {}/day", format_bytes(trends.growth_rate_per_day as u64));
            
            if let Some(days_to_full) = trends.time_to_full_days {
                println!("Time to Full: {} days", days_to_full);
            }
            
            println!("Confidence: {:.1}%", trends.confidence * 100.0);
            
            // Interpretation
            println!("\n💡 Interpretation:");
            match trends.trend_direction {
                storage_predictor::TrendDirection::Increasing => {
                    if let Some(days) = trends.time_to_full_days {
                        if days < 30 {
                            println!("⚠️  Storage will be full in less than a month!");
                        } else if days < 90 {
                            println!("📊 Storage will be full in {} days - consider cleanup.", days);
                        } else {
                            println!("✅ Storage growth is manageable.");
                        }
                    }
                }
                storage_predictor::TrendDirection::Decreasing => {
                    println!("📉 Storage usage is decreasing - good job!");
                }
                storage_predictor::TrendDirection::Stable => {
                    println!("⚖️  Storage usage is stable.");
                }
                storage_predictor::TrendDirection::Volatile => {
                    println!("🎢 Storage usage is volatile - monitor closely.");
                }
            }
        }
    }
}

async fn save_to_database(db_path: &PathBuf, data_point: &StorageDataPoint) -> Result<()> {
    use rusqlite::Connection;
    
    let conn = Connection::open(db_path)?;
    
    // Create table if it doesn't exist
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS storage_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            total_size INTEGER NOT NULL,
            used_size INTEGER NOT NULL,
            free_size INTEGER NOT NULL,
            file_count INTEGER NOT NULL,
            directory_count INTEGER NOT NULL,
            largest_file_size INTEGER NOT NULL,
            average_file_size REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        [],
    )?;

    // Insert data point
    conn.execute(
        r#"
        INSERT INTO storage_metrics 
        (timestamp, total_size, used_size, free_size, file_count, 
         directory_count, largest_file_size, average_file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        [
            &data_point.timestamp.to_string(),
            &data_point.total_size.to_string(),
            &data_point.used_size.to_string(),
            &data_point.free_size.to_string(),
            &data_point.file_count.to_string(),
            &data_point.directory_count.to_string(),
            &data_point.largest_file_size.to_string(),
            &data_point.average_file_size.to_string(),
        ],
    )?;

    println!("💾 Data saved to database: {}", db_path.display());
    Ok(())
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

    format!("{:.1}{}", size, UNITS[unit_index])
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}