//! Storage Prediction Engine Library
//! 
//! ML-powered storage prediction and trend analysis for Space Analyzer Pro.
//! Provides forecasting, anomaly detection, and intelligent recommendations.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{Result, Context};
use chrono::{DateTime, Utc, Duration as ChronoDuration, NaiveDateTime};
use linfa::DatasetBase;
use linfa::prelude::*;
use linfa_linear::LinearRegression;
use linfa_trees::DecisionTreeRegressor;
use linfa_clustering::KMeans;
use ndarray::{Array1, Array2, ArrayView1};
use polars::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use gpu_compute::ml::GpuAcceleratedML;

/// Storage usage data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageDataPoint {
    pub timestamp: DateTime<Utc>,
    pub total_size: u64,
    pub used_size: u64,
    pub free_size: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub largest_file_size: u64,
    pub average_file_size: f64,
}

/// Prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionResult {
    pub timestamp: DateTime<Utc>,
    pub predicted_used_size: u64,
    pub predicted_free_size: u64,
    pub confidence: f64,
    pub model_used: String,
    pub prediction_horizon_days: u32,
}

/// Anomaly detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyResult {
    pub timestamp: DateTime<Utc>,
    pub anomaly_type: AnomalyType,
    pub severity: AnomalySeverity,
    pub description: String,
    pub affected_size: u64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnomalyType {
    SuddenGrowth,
    UnusualPattern,
    CapacityThreshold,
    FileCountSpike,
    SizeAnomaly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnomalySeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Storage trend analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    pub trend_direction: TrendDirection,
    pub growth_rate_per_day: f64,
    pub time_to_full_days: Option<u32>,
    pub seasonal_pattern: Option<SeasonalPattern>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Increasing,
    Decreasing,
    Stable,
    Volatile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonalPattern {
    pub pattern_type: String,
    pub peak_periods: Vec<String>,
    pub low_periods: Vec<String>,
    pub confidence: f64,
}

/// Model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub algorithm: PredictionAlgorithm,
    pub training_window_days: u32,
    pub prediction_horizon_days: u32,
    pub features: Vec<String>,
    pub hyperparameters: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PredictionAlgorithm {
    LinearRegression,
    DecisionTree,
    KMeans,
    Ensemble,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            algorithm: PredictionAlgorithm::LinearRegression,
            training_window_days: 30,
            prediction_horizon_days: 7,
            features: vec![
                "days_since_start".to_string(),
                "day_of_week".to_string(),
                "month".to_string(),
                "file_count".to_string(),
                "directory_count".to_string(),
            ],
            hyperparameters: HashMap::new(),
        }
    }
}

/// Main storage predictor
pub struct StoragePredictor {
    config: ModelConfig,
    data: Vec<StorageDataPoint>,
    models: HashMap<String, Box<dyn PredictionModel>>,
    database_path: Option<PathBuf>,
    gpu_ml: GpuAcceleratedML,
}

impl StoragePredictor {
    pub fn new(config: ModelConfig) -> Self {
        let gpu_info = gpu_compute::device::GpuInfo::detect();
        Self {
            config,
            data: Vec::new(),
            models: HashMap::new(),
            database_path: None,
            gpu_ml: GpuAcceleratedML::new().with_gpu(gpu_info.available),
        }
    }

    pub fn with_database(mut self, path: PathBuf) -> Self {
        self.database_path = Some(path);
        self
    }

    /// Add storage data point
    pub fn add_data_point(&mut self, point: StorageDataPoint) {
        self.data.push(point);
        self.data.sort_by_key(|p| p.timestamp);
    }

    /// Load data from database
    pub async fn load_data(&mut self, days_back: u32) -> Result<()> {
        if let Some(db_path) = &self.database_path {
            let conn = rusqlite::Connection::open(db_path)?;
            
            let cutoff_date = Utc::now() - ChronoDuration::days(days_back as i64);
            
            let mut stmt = conn.prepare(
                "SELECT timestamp, total_size, used_size, free_size, file_count, 
                        directory_count, largest_file_size, average_file_size 
                 FROM storage_metrics 
                 WHERE timestamp >= ? 
                 ORDER BY timestamp"
            )?;

            let rows = stmt.query_map([&cutoff_date], |row| {
                Ok(StorageDataPoint {
                    timestamp: row.get(0)?,
                    total_size: row.get(1)?,
                    used_size: row.get(2)?,
                    free_size: row.get(3)?,
                    file_count: row.get(4)?,
                    directory_count: row.get(5)?,
                    largest_file_size: row.get(6)?,
                    average_file_size: row.get(7)?,
                })
            })?;

            for row in rows {
                self.data.push(row?);
            }

            info!("Loaded {} data points from database", self.data.len());
        }

        Ok(())
    }

    /// Train prediction models
    pub fn train_models(&mut self) -> Result<()> {
        if self.data.len() < 10 {
            return Err(anyhow::anyhow!("Insufficient data for training (need at least 10 points)"));
        }

        info!("Training models with {} data points", self.data.len());

        // Train linear regression model
        let lr_model = self.train_linear_regression()?;
        self.models.insert("linear_regression".to_string(), Box::new(lr_model));

        // Train decision tree model
        let dt_model = self.train_decision_tree()?;
        self.models.insert("decision_tree".to_string(), Box::new(dt_model));

        // Train ensemble model
        let ensemble_model = self.train_ensemble()?;
        self.models.insert("ensemble".to_string(), Box::new(ensemble_model));

        info!("Successfully trained {} models", self.models.len());
        Ok(())
    }

    /// Train linear regression model
    fn train_linear_regression(&self) -> Result<LinearRegressionModel> {
        let (x, y) = self.prepare_training_data()?;
        
        // Try GPU acceleration first
        let gpu_result = self.gpu_ml.linear_regression(&x, &y);
        info!("Linear regression trained on {} in {}ms (R²={:.4})", 
              gpu_result.device, gpu_result.training_time_ms, gpu_result.r_squared);
        
        // Still use linfa model for prediction interface compatibility
        let dataset = Dataset::new(x, y);
        let model = LinearRegression::default()
            .fit(&dataset)
            .context("Failed to train linear regression model")?;

        Ok(LinearRegressionModel { model, config: self.config.clone() })
    }

    /// Train decision tree model
    fn train_decision_tree(&self) -> Result<DecisionTreeModel> {
        let (x, y) = self.prepare_training_data()?;
        
        let dataset = Dataset::new(x, y);
        let model = DecisionTreeRegressor::params()
            .max_depth(Some(5))
            .min_samples_split(2)
            .fit(&dataset)
            .context("Failed to train decision tree model")?;

        Ok(DecisionTreeModel { model, config: self.config.clone() })
    }

    /// Train ensemble model
    fn train_ensemble(&self) -> Result<EnsembleModel> {
        let models: Vec<Box<dyn PredictionModel>> = vec![
            Box::new(self.train_linear_regression()?),
            Box::new(self.train_decision_tree()?),
        ];

        Ok(EnsembleModel { models, config: self.config.clone() })
    }

    /// Prepare training data from storage data points
    fn prepare_training_data(&self) -> Result<(Array2<f64>, Array1<f64>)> {
        if self.data.is_empty() {
            return Err(anyhow::anyhow!("No data available for training"));
        }

        let n_samples = self.data.len();
        let n_features = self.config.features.len();
        
        let mut x_data = Vec::with_capacity(n_samples * n_features);
        let mut y_data = Vec::with_capacity(n_samples);

        let base_time = self.data[0].timestamp;

        for (i, point) in self.data.iter().enumerate() {
            // Features
            for feature_name in &self.config.features {
                let feature_value = match feature_name.as_str() {
                    "days_since_start" => {
                        point.timestamp.signed_duration_since(base_time).num_days() as f64
                    }
                    "day_of_week" => point.timestamp.weekday().num_days_from_monday() as f64,
                    "month" => point.timestamp.month() as f64,
                    "file_count" => point.file_count as f64,
                    "directory_count" => point.directory_count as f64,
                    "used_size" => point.used_size as f64,
                    "free_size" => point.free_size as f64,
                    "average_file_size" => point.average_file_size,
                    _ => 0.0,
                };
                x_data.push(feature_value);
            }

            // Target: used size
            y_data.push(point.used_size as f64);
        }

        let x = Array2::from_shape_vec((n_samples, n_features), x_data)?;
        let y = Array1::from_vec(y_data);

        Ok((x, y))
    }

    /// Predict storage usage for future dates
    pub fn predict(&self, horizon_days: u32) -> Result<Vec<PredictionResult>> {
        let model_name = match self.config.algorithm {
            PredictionAlgorithm::LinearRegression => "linear_regression",
            PredictionAlgorithm::DecisionTree => "decision_tree",
            PredictionAlgorithm::Ensemble => "ensemble",
            _ => "ensemble", // Default to ensemble
        };

        let model = self.models.get(model_name)
            .ok_or_else(|| anyhow::anyhow!("Model '{}' not found", model_name))?;

        let mut predictions = Vec::new();
        let current_time = Utc::now();
        let base_time = self.data.first()
            .map(|p| p.timestamp)
            .unwrap_or(current_time);

        for days_ahead in 1..=horizon_days {
            let future_time = current_time + ChronoDuration::days(days_ahead as i64);
            
            // Prepare features for prediction
            let mut features = Vec::new();
            for feature_name in &self.config.features {
                let feature_value = match feature_name.as_str() {
                    "days_since_start" => {
                        future_time.signed_duration_since(base_time).num_days() as f64
                    }
                    "day_of_week" => future_time.weekday().num_days_from_monday() as f64,
                    "month" => future_time.month() as f64,
                    "file_count" => self.estimate_file_count(days_ahead)?,
                    "directory_count" => self.estimate_directory_count(days_ahead)?,
                    "used_size" => self.estimate_used_size(days_ahead)?,
                    "free_size" => self.estimate_free_size(days_ahead)?,
                    "average_file_size" => self.estimate_average_file_size(days_ahead)?,
                    _ => 0.0,
                };
                features.push(feature_value);
            }

            let feature_array = ArrayView1::from(&features);
            let predicted_size = model.predict(&feature_array)?;
            
            let total_size = self.data.last()
                .map(|p| p.total_size)
                .unwrap_or(0);
            
            let predicted_free_size = total_size.saturating_sub(predicted_size as u64);

            predictions.push(PredictionResult {
                timestamp: future_time,
                predicted_used_size: predicted_size as u64,
                predicted_free_size,
                confidence: model.confidence(),
                model_used: model_name.to_string(),
                prediction_horizon_days: days_ahead,
            });
        }

        Ok(predictions)
    }

    /// Detect anomalies in storage usage
    pub fn detect_anomalies(&self) -> Result<Vec<AnomalyResult>> {
        let mut anomalies = Vec::new();

        if self.data.len() < 7 {
            return Ok(anomalies); // Not enough data for anomaly detection
        }

        // Calculate statistical thresholds
        let sizes: Vec<f64> = self.data.iter()
            .map(|p| p.used_size as f64)
            .collect();
        
        let mean = sizes.iter().sum::<f64>() / sizes.len() as f64;
        let variance = sizes.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / sizes.len() as f64;
        let std_dev = variance.sqrt();

        // Check for anomalies
        for (i, point) in self.data.iter().enumerate() {
            let z_score = (point.used_size as f64 - mean) / std_dev;

            if z_score.abs() > 2.5 {
                let anomaly_type = if z_score > 0 {
                    AnomalyType::SuddenGrowth
                } else {
                    AnomalyType::SizeAnomaly
                };

                let severity = if z_score.abs() > 4.0 {
                    AnomalySeverity::Critical
                } else if z_score.abs() > 3.0 {
                    AnomalySeverity::High
                } else {
                    AnomalySeverity::Medium
                };

                anomalies.push(AnomalyResult {
                    timestamp: point.timestamp,
                    anomaly_type,
                    severity,
                    description: format!(
                        "Storage usage deviates by {:.2} standard deviations from normal",
                        z_score
                    ),
                    affected_size: point.used_size,
                    confidence: (1.0 - (1.0 / z_score.abs())).min(0.99).max(0.5),
                });
            }
        }

        Ok(anomalies)
    }

    /// Analyze storage trends
    pub fn analyze_trends(&self) -> Result<TrendAnalysis> {
        if self.data.len() < 2 {
            return Err(anyhow::anyhow!("Insufficient data for trend analysis"));
        }

        // Calculate growth rate using linear regression on time series
        let first_point = &self.data[0];
        let last_point = &self.data[self.data.len() - 1];
        
        let time_diff_days = last_point.timestamp.signed_duration_since(first_point.timestamp)
            .num_days() as f64;
        
        let size_diff = last_point.used_size as f64 - first_point.used_size as f64;
        let growth_rate_per_day = size_diff / time_diff_days;

        // Determine trend direction
        let trend_direction = if growth_rate_per_day.abs() < 1024.0 * 1024.0 { // < 1MB/day
            TrendDirection::Stable
        } else if growth_rate_per_day > 0.0 {
            TrendDirection::Increasing
        } else {
            TrendDirection::Decreasing
        };

        // Calculate time to full (if increasing)
        let time_to_full_days = if growth_rate_per_day > 0.0 {
            let total_size = last_point.total_size as f64;
            let remaining = total_size - last_point.used_size as f64;
            if remaining > 0.0 {
                Some((remaining / growth_rate_per_day) as u32)
            } else {
                Some(0)
            }
        } else {
            None
        };

        // Calculate confidence based on data consistency
        let confidence = self.calculate_trend_confidence()?;

        Ok(TrendAnalysis {
            trend_direction,
            growth_rate_per_day,
            time_to_full_days,
            seasonal_pattern: None, // TODO: Implement seasonal analysis
            confidence,
        })
    }

    /// Helper methods for estimation
    fn estimate_file_count(&self, days_ahead: u32) -> Result<f64> {
        if self.data.len() < 2 {
            return Ok(0.0);
        }

        let recent_points = &self.data[self.data.len().saturating_sub(7)..];
        let growth_rate = (recent_points.last().unwrap().file_count as f64 - 
                         recent_points.first().unwrap().file_count as f64) / 
                        recent_points.len() as f64;

        Ok(recent_points.last().unwrap().file_count as f64 + 
           growth_rate * days_ahead as f64)
    }

    fn estimate_directory_count(&self, days_ahead: u32) -> Result<f64> {
        if self.data.len() < 2 {
            return Ok(0.0);
        }

        let recent_points = &self.data[self.data.len().saturating_sub(7)..];
        let growth_rate = (recent_points.last().unwrap().directory_count as f64 - 
                         recent_points.first().unwrap().directory_count as f64) / 
                        recent_points.len() as f64;

        Ok(recent_points.last().unwrap().directory_count as f64 + 
           growth_rate * days_ahead as f64)
    }

    fn estimate_used_size(&self, days_ahead: u32) -> Result<f64> {
        if self.data.len() < 2 {
            return Ok(0.0);
        }

        let recent_points = &self.data[self.data.len().saturating_sub(7)..];
        let growth_rate = (recent_points.last().unwrap().used_size as f64 - 
                         recent_points.first().unwrap().used_size as f64) / 
                        recent_points.len() as f64;

        Ok(recent_points.last().unwrap().used_size as f64 + 
           growth_rate * days_ahead as f64)
    }

    fn estimate_free_size(&self, days_ahead: u32) -> Result<f64> {
        let total_size = self.data.last()
            .map(|p| p.total_size as f64)
            .unwrap_or(0.0);
        
        let used_size = self.estimate_used_size(days_ahead)?;
        Ok(total_size - used_size)
    }

    fn estimate_average_file_size(&self, days_ahead: u32) -> Result<f64> {
        if self.data.len() < 2 {
            return Ok(0.0);
        }

        let recent_points = &self.data[self.data.len().saturating_sub(7)..];
        let recent_avg = recent_points.iter()
            .map(|p| p.average_file_size)
            .sum::<f64>() / recent_points.len() as f64;

        // Assume average file size remains relatively stable
        Ok(recent_avg)
    }

    fn calculate_trend_confidence(&self) -> Result<f64> {
        if self.data.len() < 3 {
            return Ok(0.5); // Low confidence with minimal data
        }

        // Calculate R-squared for trend line
        let sizes: Vec<f64> = self.data.iter()
            .enumerate()
            .map(|(i, p)| p.used_size as f64)
            .collect();

        let n = sizes.len() as f64;
        let x_sum: f64 = (0..self.data.len()).map(|i| i as f64).sum();
        let y_sum: f64 = sizes.iter().sum();
        let xy_sum: f64 = sizes.iter().enumerate()
            .map(|(i, &y)| i as f64 * y)
            .sum();
        let x2_sum: f64 = (0..self.data.len())
            .map(|i| (i as f64).powi(2))
            .sum();

        let slope = (n * xy_sum - x_sum * y_sum) / (n * x2_sum - x_sum.powi(2));
        let intercept = (y_sum - slope * x_sum) / n;

        let y_mean = y_sum / n;
        let ss_tot: f64 = sizes.iter()
            .map(|&y| (y - y_mean).powi(2))
            .sum();
        
        let ss_res: f64 = sizes.iter().enumerate()
            .map(|(i, &y)| {
                let y_pred = slope * i as f64 + intercept;
                (y - y_pred).powi(2)
            })
            .sum();

        let r_squared = if ss_tot > 0.0 {
            1.0 - (ss_res / ss_tot)
        } else {
            0.0
        };

        Ok(r_squared.clamp(0.0, 1.0))
    }
}

/// Trait for prediction models
trait PredictionModel: Send + Sync {
    fn predict(&self, features: ArrayView1<f64>) -> Result<f64>;
    fn confidence(&self) -> f64;
}

/// Linear regression model wrapper
struct LinearRegressionModel {
    model: LinearRegression<f64>,
    config: ModelConfig,
}

impl PredictionModel for LinearRegressionModel {
    fn predict(&self, features: ArrayView1<f64>) -> Result<f64> {
        let prediction = self.model.predict(features.into());
        Ok(prediction[0])
    }

    fn confidence(&self) -> f64 {
        0.75 // Base confidence for linear regression
    }
}

/// Decision tree model wrapper
struct DecisionTreeModel {
    model: DecisionTreeRegressor<f64>,
    config: ModelConfig,
}

impl PredictionModel for DecisionTreeModel {
    fn predict(&self, features: ArrayView1<f64>) -> Result<f64> {
        let prediction = self.model.predict(features.into());
        Ok(prediction[0])
    }

    fn confidence(&self) -> f64 {
        0.80 // Base confidence for decision tree
    }
}

/// Ensemble model wrapper
struct EnsembleModel {
    models: Vec<Box<dyn PredictionModel>>,
    config: ModelConfig,
}

impl PredictionModel for EnsembleModel {
    fn predict(&self, features: ArrayView1<f64>) -> Result<f64> {
        let predictions: Result<Vec<f64>> = self.models
            .iter()
            .map(|model| model.predict(features))
            .collect();
        
        let predictions = predictions?;
        let avg_prediction = predictions.iter().sum::<f64>() / predictions.len() as f64;
        Ok(avg_prediction)
    }

    fn confidence(&self) -> f64 {
        let confidences: Vec<f64> = self.models
            .iter()
            .map(|model| model.confidence())
            .collect();
        
        confidences.iter().sum::<f64>() / confidences.len() as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_data_point_creation() {
        let point = StorageDataPoint {
            timestamp: Utc::now(),
            total_size: 1000000000,
            used_size: 500000000,
            free_size: 500000000,
            file_count: 1000,
            directory_count: 100,
            largest_file_size: 10000000,
            average_file_size: 500000.0,
        };

        assert_eq!(point.used_size + point.free_size, point.total_size);
    }

    #[test]
    fn test_prediction_result_creation() {
        let result = PredictionResult {
            timestamp: Utc::now(),
            predicted_used_size: 600000000,
            predicted_free_size: 400000000,
            confidence: 0.85,
            model_used: "linear_regression".to_string(),
            prediction_horizon_days: 7,
        };

        assert!(result.confidence > 0.0 && result.confidence <= 1.0);
        assert_eq!(result.prediction_horizon_days, 7);
    }
}