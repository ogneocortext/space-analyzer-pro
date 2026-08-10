use chrono::DateTime;
use clap::Args;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;

use crate::cli::args::OutputFormat;

/// Arguments for the `predict` subcommand.
#[derive(Debug, Args)]
pub struct PredictArgs {
    /// Number of days to project ahead
    #[arg(long, default_value = "30")]
    pub days: usize,

    /// Maximum number of historical scans to use for the trend
    #[arg(long, default_value = "50")]
    pub limit: usize,
}

const GB: f64 = 1024.0 * 1024.0 * 1024.0;

/// Project future disk usage from the scan-history size trend using linear
/// regression. Mirrors the WinUI "Storage Forecast" dashboard card: it returns
/// the current size, the projected size after `days`, the daily growth rate
/// (all in GB), and how many scans were used. The WinUI card consumes this
/// output directly (with a local heuristic fallback when the CLI is
/// unavailable).
pub fn run(args: PredictArgs, output_format: OutputFormat) -> AppResult<()> {
    let response = if let Ok(db) = Database::default_open() {
        match db.get_storage_trend(args.limit) {
            Ok(trend) if trend.len() >= 2 => {
                let mut points: Vec<(f64, f64)> = Vec::new();
                for (ts, size) in &trend {
                    if let Ok(dt) = DateTime::parse_from_rfc3339(ts) {
                        points.push((dt.timestamp() as f64, *size as f64));
                    }
                }

                if points.len() < 2 {
                    serde_json::json!({
                        "current_size_gb": 0.0_f64,
                        "predicted_size_gb": 0.0_f64,
                        "growth_rate_gb_per_day": 0.0_f64,
                        "scans_used": trend.len() as i32,
                        "first_scan": trend.first().map(|(t, _)| t.clone()).unwrap_or_default(),
                        "last_scan": trend.last().map(|(t, _)| t.clone()).unwrap_or_default(),
                        "has_enough_data": false,
                    })
                } else {
                    let n = points.len() as f64;
                    let mut sum_x = 0.0;
                    let mut sum_y = 0.0;
                    let mut sum_xy = 0.0;
                    let mut sum_x2 = 0.0;
                    for (x, y) in &points {
                        sum_x += x;
                        sum_y += y;
                        sum_xy += x * y;
                        sum_x2 += x * x;
                    }
                    let denom = n * sum_x2 - sum_x * sum_x;
                    let slope = if denom.abs() < 1e-9 {
                        0.0
                    } else {
                        (n * sum_xy - sum_x * sum_y) / denom
                    };
                    let intercept = (sum_y - slope * sum_x) / n;
                    let last_ts = points.last().map(|(x, _)| *x).unwrap_or(0.0);
                    let future_ts = last_ts + (args.days as f64) * 86400.0;
                    let predicted_bytes = slope * future_ts + intercept;
                    let current_bytes = points.last().map(|(_, y)| *y).unwrap_or(0.0);
                    let growth_per_day_bytes = slope * 86400.0;

                    serde_json::json!({
                        "current_size_gb": current_bytes / GB,
                        "predicted_size_gb": (predicted_bytes / GB).max(0.0),
                        "growth_rate_gb_per_day": growth_per_day_bytes / GB,
                        "scans_used": points.len() as i32,
                        "first_scan": trend.first().map(|(t, _)| t.clone()).unwrap_or_default(),
                        "last_scan": trend.last().map(|(t, _)| t.clone()).unwrap_or_default(),
                        "has_enough_data": true,
                    })
                }
            }
            Ok(trend) => serde_json::json!({
                "current_size_gb": 0.0_f64,
                "predicted_size_gb": 0.0_f64,
                "growth_rate_gb_per_day": 0.0_f64,
                "scans_used": trend.len() as i32,
                "first_scan": String::new(),
                "last_scan": String::new(),
                "has_enough_data": false,
            }),
            Err(_) => serde_json::json!({
                "current_size_gb": 0.0_f64,
                "predicted_size_gb": 0.0_f64,
                "growth_rate_gb_per_day": 0.0_f64,
                "scans_used": 0,
                "first_scan": String::new(),
                "last_scan": String::new(),
                "has_enough_data": false,
            }),
        }
    } else {
        serde_json::json!({
            "current_size_gb": 0.0_f64,
            "predicted_size_gb": 0.0_f64,
            "growth_rate_gb_per_day": 0.0_f64,
            "scans_used": 0,
            "first_scan": String::new(),
            "last_scan": String::new(),
            "has_enough_data": false,
        })
    };

    if output_format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
    } else if response["has_enough_data"].as_bool().unwrap_or(false) {
        println!(
            "Current: {:.1} GB | In {} days: {:.1} GB | Trend: {:.2} GB/day",
            response["current_size_gb"].as_f64().unwrap_or(0.0),
            args.days,
            response["predicted_size_gb"].as_f64().unwrap_or(0.0),
            response["growth_rate_gb_per_day"].as_f64().unwrap_or(0.0),
        );
    } else {
        println!("Not enough history (need at least 2 scans) to project growth.");
    }

    Ok(())
}
