use crate::scanner::FileScanner;
use crate::{DirectoryAnalysis, ScanProgress};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::Emitter;
use std::io::ErrorKind;

/// Structured error types for user-friendly error handling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum TauriError {
    /// Path not found error
    PathNotFound {
        path: String,
        suggestion: String,
    },
    /// Permission denied error
    PermissionDenied {
        path: String,
        suggestion: String,
    },
    /// Path is not a directory
    NotADirectory {
        path: String,
        suggestion: String,
    },
    /// I/O error during operation
    IoError {
        operation: String,
        message: String,
        suggestion: String,
    },
    /// Scan was cancelled
    Cancelled {
        message: String,
    },
    /// General operation error
    OperationFailed {
        operation: String,
        message: String,
        suggestion: String,
    },
}

impl TauriError {
    /// Convert IO error to TauriError with context
    fn from_io_error(error: std::io::Error, operation: &str, path: &str) -> Self {
        match error.kind() {
            ErrorKind::NotFound => TauriError::PathNotFound {
                path: path.to_string(),
                suggestion: format!("Check if the path '{}' exists and is accessible", path),
            },
            ErrorKind::PermissionDenied => TauriError::PermissionDenied {
                path: path.to_string(),
                suggestion: "Try running the application as administrator or check folder permissions".to_string(),
            },
            ErrorKind::InvalidInput => TauriError::NotADirectory {
                path: path.to_string(),
                suggestion: "The specified path is not a directory. Please select a folder to analyze.".to_string(),
            },
            _ => TauriError::IoError {
                operation: operation.to_string(),
                message: error.to_string(),
                suggestion: "Please try again or contact support if the issue persists".to_string(),
            },
        }
    }

    /// Get user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            TauriError::PathNotFound { path, .. } => format!("Path not found: {}", path),
            TauriError::PermissionDenied { path, .. } => format!("Access denied: {}", path),
            TauriError::NotADirectory { path, .. } => format!("Not a directory: {}", path),
            TauriError::IoError { operation, message, .. } => format!("{} failed: {}", operation, message),
            TauriError::Cancelled { message } => message.clone(),
            TauriError::OperationFailed { operation, message, .. } => format!("{} failed: {}", operation, message),
        }
    }

    /// Get recovery suggestion
    pub fn suggestion(&self) -> String {
        match self {
            TauriError::PathNotFound { suggestion, .. } => suggestion.clone(),
            TauriError::PermissionDenied { suggestion, .. } => suggestion.clone(),
            TauriError::NotADirectory { suggestion, .. } => suggestion.clone(),
            TauriError::IoError { suggestion, .. } => suggestion.clone(),
            TauriError::Cancelled { .. } => "The operation was cancelled. You can try again.".to_string(),
            TauriError::OperationFailed { suggestion, .. } => suggestion.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub total_memory: u64,
    pub used_memory: u64,
    pub cpu_count: usize,
    pub os_name: String,
    pub os_version: String,
    pub hostname: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDetails {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub accessed: Option<String>,
    pub is_directory: bool,
    pub extension: String,
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub success: bool,
    pub deleted_count: u32,
    pub failed_paths: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub filesystem: String,
    pub is_removable: bool,
}

static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

// In-memory error log storage for desktop mode
use std::sync::Mutex;
use once_cell::sync::Lazy;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLogEntry {
    pub id: String,
    pub timestamp: String,
    pub error_type: String,
    pub message: String,
    pub stack: Option<String>,
    pub source: String,
    pub url: Option<String>,
    pub component: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLogStats {
    pub total: usize,
    pub recent: usize,
}

static ERROR_LOGS: Lazy<Mutex<Vec<ErrorLogEntry>>> = Lazy::new(|| Mutex::new(Vec::new()));
const MAX_ERROR_LOGS: usize = 1000;

#[tauri::command]
pub fn analyze_directory(path: String) -> Result<DirectoryAnalysis, TauriError> {
    let start_time = Instant::now();

    // Validate path exists
    if !std::path::Path::new(&path).exists() {
        return Err(TauriError::PathNotFound {
            path: path.clone(),
            suggestion: format!("Check if the path '{}' exists and is accessible", path),
        });
    }

    // Validate path is a directory
    if !std::path::Path::new(&path).is_dir() {
        return Err(TauriError::NotADirectory {
            path: path.clone(),
            suggestion: "The specified path is not a directory. Please select a folder to analyze.".to_string(),
        });
    }

    let mut analysis = DirectoryAnalysis::default();
    analysis.path = path.clone();

    let scanner = FileScanner::new();
    match scanner.scan_directory_sync(&path) {
        Ok(result) => {
            analysis.total_files = result.total_files;
            analysis.total_directories = result.total_directories;
            analysis.total_size = result.total_size;
            analysis.file_types = result.file_types;
            analysis.largest_files = result.largest_files;
            analysis.empty_directories = result.empty_directories;
            analysis.analysis_time_ms = start_time.elapsed().as_millis() as u64;
            Ok(analysis)
        }
        Err(e) => {
            eprintln!("Scan error in analyze_directory: {}", e);
            Err(TauriError::OperationFailed {
                operation: "scan".to_string(),
                message: e,
                suggestion: "Please try again with a different directory or contact support".to_string(),
            })
        }
    }
}

#[tauri::command]
pub async fn analyze_directory_with_progress(
    app: tauri::AppHandle,
    path: String,
) -> Result<DirectoryAnalysis, String> {
    use tokio::sync::mpsc::unbounded_channel;
    use std::time::{Instant, SystemTime};

    let start_time = Instant::now();

    CANCEL_FLAG.store(false, Ordering::Relaxed);

    // Create unbounded channel for progress updates
    let (tx, mut rx) = unbounded_channel::<ScanProgress>();

    // Spawn async task to forward progress events to frontend
    let app_clone = app.clone();
    let progress_forwarder = tokio::spawn(async move {
        while let Some(progress) = rx.recv().await {
            let _ = app_clone.emit("scan-progress", &progress);
        }
    });

    // Run scan in blocking task
    let path_clone = path.clone();
    let result = tokio::task::spawn_blocking(move || {
        let scanner = FileScanner::new();
        let tx_clone = tx.clone();

        // Blocking progress callback with rate limiting (max 20 updates/sec)
        let last_emit = Arc::new(AtomicU64::new(0));
        let last_emit_clone = last_emit.clone();
        let progress_callback = move |progress: ScanProgress| {
            let now = SystemTime::now();
            let last_emit_ms = last_emit_clone.load(Ordering::Relaxed);
            let now_ms = now.duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            if now_ms.saturating_sub(last_emit_ms) >= 50 || progress.completed {
                let _ = tx_clone.send(progress);
                last_emit_clone.store(now_ms, Ordering::Relaxed);
            }
        };

        // Use blocking runtime
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            scanner
                .scan_directory_with_progress(&path_clone, progress_callback, &CANCEL_FLAG)
                .await
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    // Stop progress forwarder
    let _ = progress_forwarder.await;

    match result {
        Ok(scan_result) => {
            let analysis = DirectoryAnalysis {
                path: path.clone(),
                total_files: scan_result.total_files,
                total_directories: scan_result.total_directories,
                total_size: scan_result.total_size,
                analysis_time_ms: start_time.elapsed().as_millis() as u64,
                file_types: scan_result.file_types,
                largest_files: scan_result.largest_files,
                empty_directories: scan_result.empty_directories,
                errors: scan_result.errors,
            };
            Ok(analysis)
        }
        Err(e) => Err(format!("Scan failed: {}", e)),
    }
}

#[tauri::command]
pub fn cancel_analysis() -> Result<(), String> {
    CANCEL_FLAG.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn report_error(error: ErrorLogEntry) -> Result<(), String> {
    let mut logs = ERROR_LOGS.lock().map_err(|e| e.to_string())?;
    logs.push(error);
    // Keep only the most recent errors
    if logs.len() > MAX_ERROR_LOGS {
        logs.remove(0);
    }
    Ok(())
}

#[tauri::command]
pub fn get_error_logs(limit: Option<usize>) -> Result<Vec<ErrorLogEntry>, String> {
    let logs = ERROR_LOGS.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);
    let result: Vec<_> = logs.iter().rev().take(limit).cloned().collect();
    Ok(result)
}

#[tauri::command]
pub fn get_error_stats() -> Result<ErrorLogStats, String> {
    let logs = ERROR_LOGS.lock().map_err(|e| e.to_string())?;
    let total = logs.len();
    let recent = logs.iter().filter(|e| {
        if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&e.timestamp) {
            let one_hour_ago = chrono::Utc::now() - chrono::Duration::hours(1);
            ts > one_hour_ago
        } else {
            false
        }
    }).count();
    Ok(ErrorLogStats { total, recent })
}

#[tauri::command]
pub fn clear_error_logs() -> Result<(), String> {
    let mut logs = ERROR_LOGS.lock().map_err(|e| e.to_string())?;
    logs.clear();
    Ok(())
}

#[tauri::command]
pub fn delete_error_logs(ids: Vec<String>) -> Result<(), String> {
    let mut logs = ERROR_LOGS.lock().map_err(|e| e.to_string())?;
    logs.retain(|e| !ids.contains(&e.id));
    Ok(())
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let info = SystemInfo {
        total_memory: 0,
        used_memory: 0,
        cpu_count: 0,
        os_name: "Windows".to_string(),
        os_version: "Unknown".to_string(),
        hostname: "Unknown".to_string(),
    };

    Ok(info)
}

#[tauri::command]
pub async fn open_file_location(path: String) -> Result<(), String> {
    let _parent = std::path::Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_file_details(path: String) -> Result<FileDetails, TauriError> {
    use std::time::UNIX_EPOCH;

    let metadata = std::fs::metadata(&path)
        .map_err(|e| TauriError::from_io_error(e, "get metadata", &path))?;

    let format_time = |time: Result<std::time::SystemTime, _>| -> Option<String> {
        time.ok().map(|t| {
            let duration = t.duration_since(UNIX_EPOCH).unwrap_or_default();
            let datetime = chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)?;
            Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
        })?
    };

    let path_obj = std::path::Path::new(&path);
    let extension = path_obj
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    Ok(FileDetails {
        path: path.clone(),
        name: path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string(),
        size: metadata.len(),
        created: format_time(metadata.created()),
        modified: format_time(metadata.modified()),
        accessed: format_time(metadata.accessed()),
        is_directory: metadata.is_dir(),
        extension,
        permissions: None,
    })
}

#[tauri::command]
pub fn delete_files(paths: Vec<String>) -> Result<DeleteResult, String> {
    let mut result = DeleteResult {
        success: true,
        deleted_count: 0,
        failed_paths: Vec::new(),
        error: None,
    };

    for path in paths {
        match std::fs::remove_file(&path) {
            Ok(_) => {
                result.deleted_count += 1;
            }
            Err(e) => {
                result.success = false;
                result.failed_paths.push(format!("{}: {}", path, e));
            }
        }
    }

    if !result.failed_paths.is_empty() && result.deleted_count == 0 {
        result.error = Some("Failed to delete all files".to_string());
    }

    Ok(result)
}

#[tauri::command]
pub fn get_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    // Simplified cross-platform drive detection
    #[cfg(target_os = "windows")]
    {
        // Basic Windows drive detection without Windows API
        for letter in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", letter as char);
            if std::path::Path::new(&drive_path).exists() {
                drives.push(DriveInfo {
                    name: format!("Drive ({}:)", letter as char),
                    path: drive_path,
                    total_space: 0,
                    available_space: 0,
                    used_space: 0,
                    filesystem: "Unknown".to_string(),
                    is_removable: false,
                });
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        drives.push(DriveInfo {
            name: "Root".to_string(),
            path: "/".to_string(),
            total_space: 0,
            available_space: 0,
            used_space: 0,
            filesystem: "Unknown".to_string(),
            is_removable: false,
        });
    }

    Ok(drives)
}

