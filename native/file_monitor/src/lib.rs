//! Real-time File System Monitor Library
//! 
//! High-performance file system monitoring with event batching, database integration,
//! and real-time change detection for Space Analyzer Pro.

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Result, Context};
use chrono::{DateTime, Utc};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

/// File system event types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileSystemEvent {
    Created { path: PathBuf, size: u64, modified: DateTime<Utc> },
    Modified { path: PathBuf, size: u64, modified: DateTime<Utc> },
    Deleted { path: PathBuf, modified: DateTime<Utc> },
    Renamed { from: PathBuf, to: PathBuf, modified: DateTime<Utc> },
    PermissionChanged { path: PathBuf, modified: DateTime<Utc> },
}

impl FileSystemEvent {
    pub fn path(&self) -> &Path {
        match self {
            FileSystemEvent::Created { path, .. } => path,
            FileSystemEvent::Modified { path, .. } => path,
            FileSystemEvent::Deleted { path, .. } => path,
            FileSystemEvent::Renamed { from, .. } => from,
            FileSystemEvent::PermissionChanged { path, .. } => path,
        }
    }

    pub fn timestamp(&self) -> DateTime<Utc> {
        match self {
            FileSystemEvent::Created { modified, .. } => *modified,
            FileSystemEvent::Modified { modified, .. } => *modified,
            FileSystemEvent::Deleted { modified, .. } => *modified,
            FileSystemEvent::Renamed { modified, .. } => *modified,
            FileSystemEvent::PermissionChanged { modified, .. } => *modified,
        }
    }
}

/// Monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub watch_paths: Vec<PathBuf>,
    pub recursive: bool,
    pub debounce_duration: Duration,
    pub batch_size: usize,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub database_path: Option<PathBuf>,
    pub api_port: Option<u16>,
    pub log_level: String,
}

impl Default for MonitorConfig {
    fn default() -> Self {
        Self {
            watch_paths: vec![PathBuf::from(".")],
            recursive: true,
            debounce_duration: Duration::from_millis(500),
            batch_size: 100,
            include_patterns: vec![],
            exclude_patterns: vec![
                "*.tmp".to_string(),
                "*.log".to_string(),
                "*.cache".to_string(),
                "node_modules".to_string(),
                ".git".to_string(),
                "__pycache__".to_string(),
            ],
            database_path: Some(PathBuf::from("file_monitor.db")),
            api_port: Some(8080),
            log_level: "info".to_string(),
        }
    }
}

/// Event batch for processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventBatch {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub events: Vec<FileSystemEvent>,
    pub processing_duration: Duration,
}

/// Statistics for monitoring
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct MonitorStats {
    pub events_processed: u64,
    pub events_filtered: u64,
    pub batches_processed: u64,
    pub files_created: u64,
    pub files_modified: u64,
    pub files_deleted: u64,
    pub files_renamed: u64,
    pub average_batch_size: f64,
    pub uptime: Duration,
}

/// Database interface for event storage
#[async_trait::async_trait]
pub trait EventStorage: Send + Sync {
    async fn store_events(&self, batch: &EventBatch) -> Result<()>;
    async fn get_events(&self, since: DateTime<Utc>, limit: Option<usize>) -> Result<Vec<FileSystemEvent>>;
    async fn get_stats(&self) -> Result<MonitorStats>;
}

/// SQLite implementation of event storage
pub struct SqliteEventStorage {
    pool: sqlx::SqlitePool,
}

impl SqliteEventStorage {
    pub async fn new(database_path: &Path) -> Result<Self> {
        let database_url = format!("sqlite:{}", database_path.display());
        
        let pool = sqlx::SqlitePool::connect(&database_url).await
            .with_context(|| "Failed to connect to database")?;

        // Initialize database schema
        sqlx::migrate!("./migrations").run(&pool).await
            .with_context(|| "Failed to run database migrations")?;

        Ok(Self { pool })
    }
}

#[async_trait::async_trait]
impl EventStorage for SqliteEventStorage {
    async fn store_events(&self, batch: &EventBatch) -> Result<()> {
        let mut tx = self.pool.begin().await
            .with_context(|| "Failed to begin transaction")?;

        for event in &batch.events {
            let (event_type, path, size_opt) = match event {
                FileSystemEvent::Created { path, size, .. } => ("created", path, Some(*size)),
                FileSystemEvent::Modified { path, size, .. } => ("modified", path, Some(*size)),
                FileSystemEvent::Deleted { path, .. } => ("deleted", path, None),
                FileSystemEvent::Renamed { from, to, .. } => ("renamed", from, None),
                FileSystemEvent::PermissionChanged { path, .. } => ("permission_changed", path, None),
            };

            let query = sqlx::query!(
                r#"
                INSERT INTO file_events 
                (batch_id, timestamp, event_type, path, size, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
                "#,
                batch.id,
                event.timestamp,
                event_type,
                path.to_string_lossy(),
                size_opt,
                serde_json::to_string(event).unwrap_or_default()
            );

            query.execute(&mut *tx).await
                .with_context(|| "Failed to insert event")?;
        }

        tx.commit().await
            .with_context(|| "Failed to commit transaction")?;

        Ok(())
    }

    async fn get_events(&self, since: DateTime<Utc>, limit: Option<usize>) -> Result<Vec<FileSystemEvent>> {
        let mut query = sqlx::query!(
            "SELECT metadata FROM file_events WHERE timestamp >= ? ORDER BY timestamp DESC",
            since
        );

        if let Some(limit) = limit {
            query = query.limit(limit as i64);
        }

        let rows = query.fetch_all(&self.pool).await
            .with_context(|| "Failed to fetch events")?;

        let mut events = Vec::new();
        for row in rows {
            if let Some(metadata) = row.metadata {
                if let Ok(event) = serde_json::from_str::<FileSystemEvent>(&metadata) {
                    events.push(event);
                }
            }
        }

        Ok(events)
    }

    async fn get_stats(&self) -> Result<MonitorStats> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_events,
                SUM(CASE WHEN event_type = 'created' THEN 1 ELSE 0 END) as files_created,
                SUM(CASE WHEN event_type = 'modified' THEN 1 ELSE 0 END) as files_modified,
                SUM(CASE WHEN event_type = 'deleted' THEN 1 ELSE 0 END) as files_deleted,
                SUM(CASE WHEN event_type = 'renamed' THEN 1 ELSE 0 END) as files_renamed
            FROM file_events
            "#
        )
        .fetch_one(&self.pool)
        .await
        .with_context(|| "Failed to fetch stats")?;

        Ok(MonitorStats {
            events_processed: stats.total_events.unwrap_or(0) as u64,
            files_created: stats.files_created.unwrap_or(0) as u64,
            files_modified: stats.files_modified.unwrap_or(0) as u64,
            files_deleted: stats.files_deleted.unwrap_or(0) as u64,
            files_renamed: stats.files_renamed.unwrap_or(0) as u64,
            ..Default::default()
        })
    }
}

/// Main file system monitor
pub struct FileMonitor {
    config: MonitorConfig,
    storage: Option<Box<dyn EventStorage>>,
    event_sender: mpsc::UnboundedSender<FileSystemEvent>,
    event_receiver: Arc<RwLock<Option<mpsc::UnboundedReceiver<FileSystemEvent>>>>,
    stats: Arc<RwLock<MonitorStats>>,
    start_time: Instant,
}

impl FileMonitor {
    pub fn new(config: MonitorConfig) -> Self {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        
        Self {
            config,
            storage: None,
            event_sender,
            event_receiver: Arc::new(RwLock::new(Some(event_receiver))),
            stats: Arc::new(RwLock::new(MonitorStats::default())),
            start_time: Instant::now(),
        }
    }

    pub async fn with_storage(mut self, storage: Box<dyn EventStorage>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Start monitoring the configured paths
    pub async fn start(&self) -> Result<()> {
        info!("Starting file system monitor...");
        
        // Initialize storage if configured
        if let Some(database_path) = &self.config.database_path {
            let storage = SqliteEventStorage::new(database_path).await?;
            // Note: In a real implementation, we'd need to handle this differently
            // since we can't store the Box<dyn EventStorage> in self after construction
        }

        // Create debouncer for event batching
        let (tx, mut rx) = mpsc::channel::<DebounceEventResult>(1000);
        let event_sender = self.event_sender.clone();

        let mut debouncer: Debouncer<RecommendedWatcher, FileIdMap> = new_debouncer(
            self.config.debounce_duration,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        if let Err(e) = tx.blocking_send(events) {
                            error!("Failed to send debounced events: {}", e);
                        }
                    }
                    Err(errors) => {
                        for error in errors {
                            error!("File system error: {:?}", error);
                        }
                    }
                }
            },
        )?;

        // Watch all configured paths
        for path in &self.config.watch_paths {
            info!("Watching path: {}", path.display());
            debouncer.watch(path, if self.config.recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            })?;
        }

        // Start event processing task
        let stats = self.stats.clone();
        let config = self.config.clone();
        let receiver = self.event_receiver.clone();
        
        tokio::spawn(async move {
            let mut receiver_lock = receiver.write().await;
            if let Some(mut rx) = receiver_lock.take() {
                let mut event_buffer = Vec::with_capacity(config.batch_size);
                let mut last_flush = Instant::now();

                while let Some(event) = rx.recv().await {
                    if self.should_process_event(&event) {
                        event_buffer.push(event);

                        // Flush buffer if it's full or enough time has passed
                        if event_buffer.len() >= config.batch_size || 
                           last_flush.elapsed() >= Duration::from_secs(5) {
                            
                            if let Err(e) = self.process_event_batch(event_buffer.clone()).await {
                                error!("Failed to process event batch: {}", e);
                            }
                            
                            event_buffer.clear();
                            last_flush = Instant::now();
                        }
                    } else {
                        // Update filtered stats
                        let mut stats = stats.write().await;
                        stats.events_filtered += 1;
                    }
                }

                // Process remaining events
                if !event_buffer.is_empty() {
                    if let Err(e) = self.process_event_batch(event_buffer).await {
                        error!("Failed to process final event batch: {}", e);
                    }
                }
            }
        });

        info!("File system monitor started successfully");
        Ok(())
    }

    /// Process a batch of events
    async fn process_event_batch(&self, events: Vec<FileSystemEvent>) -> Result<()> {
        let batch = EventBatch {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            events: events.clone(),
            processing_duration: Duration::from_millis(0),
        };

        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.events_processed += events.len() as u64;
            stats.batches_processed += 1;
            stats.average_batch_size = (stats.average_batch_size * (stats.batches_processed - 1) as f64 
                + events.len() as f64) / stats.batches_processed as f64;

            for event in &events {
                match event {
                    FileSystemEvent::Created { .. } => stats.files_created += 1,
                    FileSystemEvent::Modified { .. } => stats.files_modified += 1,
                    FileSystemEvent::Deleted { .. } => stats.files_deleted += 1,
                    FileSystemEvent::Renamed { .. } => stats.files_renamed += 1,
                    FileSystemEvent::PermissionChanged { .. } => {}
                }
            }
        }

        // Store events if storage is configured
        if let Some(storage) = &self.storage {
            storage.store_events(&batch).await?;
        }

        debug!("Processed event batch with {} events", events.len());
        Ok(())
    }

    /// Check if an event should be processed based on filters
    fn should_process_event(&self, event: &FileSystemEvent) -> bool {
        let path = event.path();
        let path_str = path.to_string_lossy();

        // Check exclude patterns
        for pattern in &self.config.exclude_patterns {
            if path_str.contains(pattern) {
                return false;
            }
        }

        // Check include patterns (if any specified)
        if !self.config.include_patterns.is_empty() {
            for pattern in &self.config.include_patterns {
                if path_str.contains(pattern) {
                    return true;
                }
            }
            return false;
        }

        true
    }

    /// Get current monitoring statistics
    pub async fn get_stats(&self) -> MonitorStats {
        let mut stats = self.stats.read().await.clone();
        stats.uptime = self.start_time.elapsed();
        stats
    }

    /// Get recent events
    pub async fn get_recent_events(&self, limit: Option<usize>) -> Result<Vec<FileSystemEvent>> {
        if let Some(storage) = &self.storage {
            storage.get_events(Utc::now() - Duration::from_secs(3600), limit).await
        } else {
            Ok(Vec::new())
        }
    }
}

impl Default for FileMonitor {
    fn default() -> Self {
        Self::new(MonitorConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_event_filtering() {
        let config = MonitorConfig {
            exclude_patterns: vec!["*.tmp".to_string()],
            include_patterns: vec![],
            ..Default::default()
        };

        let monitor = FileMonitor::new(config);

        let temp_dir = TempDir::new().unwrap();
        let tmp_file = temp_dir.path().join("test.tmp");
        let txt_file = temp_dir.path().join("test.txt");

        let tmp_event = FileSystemEvent::Created {
            path: tmp_file,
            size: 100,
            modified: Utc::now(),
        };

        let txt_event = FileSystemEvent::Created {
            path: txt_file,
            size: 200,
            modified: Utc::now(),
        };

        assert!(!monitor.should_process_event(&tmp_event));
        assert!(monitor.should_process_event(&txt_event));
    }

    #[test]
    fn test_event_path_extraction() {
        let path = PathBuf::from("/test/file.txt");
        let event = FileSystemEvent::Modified {
            path: path.clone(),
            size: 1000,
            modified: Utc::now(),
        };

        assert_eq!(event.path(), &path);
    }
}