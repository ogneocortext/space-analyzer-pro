use axum::{
    routing::{get, post},
    Router,
    response::{Html, Sse},
    extract::{Json, State, Query},
    response::sse::Event,
};
use std::net::SocketAddr;
use std::convert::Infallible;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use axum::serve;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, NaiveDateTime};
use scan_engine::{FileScanner, ScanOptions, get_system_info, SystemInfo};
use file_deduplicator::{FileDeduplicator, DeduplicationResult};
use reqwest::Client as HttpClient;
use tokio_stream::wrappers::ReceiverStream;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRequest {
    pub path: String,
    pub max_depth: Option<usize>,
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    pub include_hidden: Option<bool>,
    pub follow_symlinks: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DedupRequest {
    pub path: String,
    pub min_file_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: Option<String>,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
}

#[derive(Debug, Deserialize)]
pub struct LargeFilesQuery {
    pub path: Option<String>,
    pub min_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct CleanupQuery {
    pub path: Option<String>,
    pub min_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
struct ScanProgressSse {
    files_scanned: u64,
    directories_scanned: u64,
    total_size: u64,
    current_file: String,
    percentage: f32,
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

async fn get_system(_http_client: State<HttpClient>) -> axum::Json<SystemInfo> {
    let info = get_system_info();
    axum::Json(info)
}

async fn start_scan(
    _http_client: State<HttpClient>,
    Json(req): Json<ScanRequest>,
) -> axum::Json<scan_engine::ScanReport> {
    let options = ScanOptions {
        max_depth: req.max_depth,
        min_size: req.min_size,
        max_size: req.max_size,
        include_hidden: req.include_hidden.unwrap_or(false),
        follow_symlinks: req.follow_symlinks.unwrap_or(false),
        size_buckets: true,
        gpu_acceleration: true,
        cuda_enabled: false,
    };

    let scanner = FileScanner::new();
    let result = scanner.scan_directory_sync(&req.path, options);
    match result {
        Ok(scan_result) => axum::Json(scan_result),
        Err(e) => {
            tracing::error!("Scan failed: {}", e);
            axum::Json(scan_engine::ScanReport {
                total_files: 0,
                total_directories: 0,
                total_size: 0,
                file_types: Default::default(),
                extension_sizes: Default::default(),
                size_distribution: Default::default(),
                largest_files: Vec::new(),
                empty_directories: Vec::new(),
                errors: vec![e.to_string()],
                subdirectories: Vec::new(),
            })
        }
    }
}

async fn stream_scan(
    Query(params): Query<ScanRequest>,
) -> Sse<ReceiverStream<Result<Event, Infallible>>> {
    let (tx, rx) = tokio::sync::mpsc::channel(128);

    let path = params.path.clone();
    let options = ScanOptions {
        max_depth: params.max_depth,
        min_size: params.min_size,
        max_size: params.max_size,
        include_hidden: params.include_hidden.unwrap_or(false),
        follow_symlinks: params.follow_symlinks.unwrap_or(false),
        size_buckets: true,
        gpu_acceleration: true,
        cuda_enabled: false,
    };

    tokio::task::spawn_blocking(move || {
        let scanner = FileScanner::new();
        let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

        {
            let progress_tx = tx.clone();
            let cancel_for_callback = cancel.clone();
            let callback = move |progress: scan_engine::ScanProgress| {
                if progress_tx.is_closed() {
                    cancel_for_callback.store(true, std::sync::atomic::Ordering::Relaxed);
                    return;
                }

                let event = Event::default()
                    .event("progress")
                    .json_data(&ScanProgressSse {
                        files_scanned: progress.files_scanned,
                        directories_scanned: progress.directories_scanned,
                        total_size: progress.total_size,
                        current_file: progress.current_file,
                        percentage: progress.percentage,
                    });

                match event {
                    Ok(ev) => {
                        let _ = progress_tx.blocking_send(Ok(ev));
                    }
                    Err(_) => {}
                }
            };

            let result = scanner.scan_with_progress_sync(&path, options, callback, &cancel);

            let final_event = match result {
                Ok(scan_result) => Event::default()
                    .event("complete")
                    .json_data(&scan_result),
                Err(e) => Event::default()
                    .event("error")
                    .json_data(&serde_json::json!({"error": e.to_string()})),
            };

            if let Ok(ev) = final_event {
                let _ = tx.blocking_send(Ok(ev));
            }
        }
    });

    Sse::new(ReceiverStream::new(rx))
}

async fn find_duplicates(
    _http_client: State<HttpClient>,
    Json(req): Json<DedupRequest>,
) -> axum::Json<DeduplicationResult> {
    let dedup = FileDeduplicator::new();
    let files = dedup.scan_directory(&req.path).unwrap_or_default();
    let groups = dedup.find_duplicates(files);
    let result = DeduplicationResult {
        total_files_scanned: 0,
        duplicate_groups: groups,
        space_saved: 0,
        files_processed: 0,
        errors: Vec::new(),
    };
    axum::Json(result)
}

async fn ai_chat(
    _http_client: State<HttpClient>,
    Json(req): Json<ChatRequest>,
) -> axum::Json<ChatResponse> {
    let model = req.model.unwrap_or_else(|| "qwen3:8b".to_string());
    let base_url = std::env::var("OLLAMA_HOST")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    
    let ollama_req = serde_json::json!({
        "model": model,
        "messages": req.messages,
        "stream": false
    });

    let client = HttpClient::new();
    let response = client
        .post(format!("{}/api/chat", base_url))
        .json(&ollama_req)
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            let message = ChatMessage {
                role: body["message"]["role"].as_str().unwrap_or("assistant").to_string(),
                content: body["message"]["content"].as_str().unwrap_or("").to_string(),
            };
            axum::Json(ChatResponse {
                message,
                done: body["done"].as_bool().unwrap_or(false),
            })
        }
        _ => {
            axum::Json(ChatResponse {
                message: ChatMessage {
                    role: "assistant".to_string(),
                    content: "Error: Failed to connect to Ollama. Is it running?".to_string(),
                },
                done: true,
            })
        }
    }
}

async fn get_large_files(
    Query(params): Query<LargeFilesQuery>,
) -> axum::Json<Vec<scan_engine::FileInfo>> {
    let path = params.path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });
    let options = ScanOptions {
        max_depth: Some(2),
        min_size: params.min_size.or(Some(100 * 1024 * 1024)), // default 100MB
        max_size: None,
        include_hidden: false,
        follow_symlinks: false,
        size_buckets: false,
        gpu_acceleration: true,
        cuda_enabled: false,
    };

    let scanner = FileScanner::new();
    let result = scanner.scan_directory_sync(&path, options);
    match result {
        Ok(scan_result) => axum::Json(scan_result.largest_files),
        Err(_) => axum::Json(Vec::new()),
    }
}

async fn get_cleanup_suggestions(
    Query(params): Query<CleanupQuery>,
) -> axum::Json<Vec<String>> {
    let path = params.path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });
    let options = ScanOptions {
        max_depth: None,
        min_size: None,
        max_size: None,
        include_hidden: true,
        follow_symlinks: false,
        size_buckets: false,
        gpu_acceleration: true,
        cuda_enabled: false,
    };

    let scanner = FileScanner::new();
    let result = scanner.scan_directory_sync(&path, options);
    match result {
        Ok(scan_result) => {
            let mut suggestions = Vec::new();

            let now = Utc::now();
            let six_months_ago = now - chrono::Duration::days(180);
            let mut old_file_count = 0u64;
            let mut old_file_size: u64 = 0;
            let mut temp_path_files: Vec<(String, u64)> = Vec::new();
            let mut log_files: Vec<(String, u64)> = Vec::new();
            let mut build_artifact_dirs: Vec<String> = Vec::new();

            for info in &scan_result.largest_files {
                let size = info.size;
                let path_lower = info.path.to_lowercase();

                if path_lower.contains("/temp/") || path_lower.contains("/cache/") || path_lower.contains("/tmp/") || path_lower.contains("/appdata/local/temp/") {
                    temp_path_files.push((info.path.clone(), size));
                }

                if info.extension == "log" || info.name.to_lowercase().ends_with(".log") {
                    log_files.push((info.path.clone(), size));
                }

                if let Ok(ndt) = NaiveDateTime::parse_from_str(&format!("{} 00:00:00", info.modified.as_deref().unwrap_or("1970-01-01")), "%Y-%m-%d %H:%M:%S") {
                    let modified_dt: DateTime<Utc> = DateTime::from_naive_utc_and_offset(ndt, Utc);
                    if modified_dt < six_months_ago {
                        old_file_count += 1;
                        old_file_size += size;
                    }
                }
            }

            for dir in &scan_result.subdirectories {
                let dir_lower = dir.path.to_lowercase();
                if dir_lower.contains("/node_modules/") || dir_lower.contains("/target/") || dir_lower.contains("/build/") || dir_lower.contains("/dist/") || dir_lower.contains("/.git/") || dir_lower.contains("/__pycache__/") || dir_lower.contains("/.cache/") {
                    build_artifact_dirs.push(dir.path.clone());
                }
            }

            if !scan_result.largest_files.is_empty() {
                suggestions.push(format!(
                    "Found {} large files totaling {}. Consider moving old media to external storage.",
                    scan_result.largest_files.len(),
                    scan_engine::format_bytes(scan_result.largest_files.iter().map(|f| f.size).sum())
                ));
            }

            if !scan_result.empty_directories.is_empty() {
                suggestions.push(format!(
                    "Found {} empty directories that can be safely removed.",
                    scan_result.empty_directories.len()
                ));
                for dir in scan_result.empty_directories.iter().take(5) {
                    suggestions.push(format!("  - {}", dir));
                }
            }

            if !temp_path_files.is_empty() {
                let total_temp_size: u64 = temp_path_files.iter().map(|(_, s)| *s).sum();
                suggestions.push(format!(
                    "Found {} files in temp/cache directories totaling {}.",
                    temp_path_files.len(),
                    scan_engine::format_bytes(total_temp_size)
                ));
                for (path, size) in temp_path_files.iter().take(5) {
                    suggestions.push(format!("  - {} ({})", path, scan_engine::format_bytes(*size)));
                }
            }

            if old_file_count > 0 {
                suggestions.push(format!(
                    "Found {} old files (not modified in 6+ months) totaling {} that may be archived or removed.",
                    old_file_count,
                    scan_engine::format_bytes(old_file_size)
                ));
            }

            if !log_files.is_empty() {
                let total_log_size: u64 = log_files.iter().map(|(_, s)| *s).sum();
                suggestions.push(format!(
                    "Found {} log files totaling {}. Consider archiving or deleting old logs.",
                    log_files.len(),
                    scan_engine::format_bytes(total_log_size)
                ));
            }

            if !build_artifact_dirs.is_empty() {
                suggestions.push(format!(
                    "Found {} build artifact directories (node_modules, target, build, dist, .git, __pycache__, .cache). These can often be regenerated or safely removed if no longer needed.",
                    build_artifact_dirs.len()
                ));
                for dir in build_artifact_dirs.iter().take(5) {
                    suggestions.push(format!("  - {}", dir));
                }
            }

            if let Some((ext, count)) = scan_result.file_types.iter().max_by_key(|(_, c)| *c) {
                if *count > 1000 {
                    suggestions.push(format!(
                        "High concentration of .{} files ({} items). Consider archiving old {} files.",
                        ext, count, ext
                    ));
                }
            }

            if scan_result.errors.len() > 5 {
                suggestions.push(format!(
                    "{} permission/path errors encountered during scan. Review access rights to ensure all relevant areas were scanned.",
                    scan_result.errors.len()
                ));
            }

            if suggestions.is_empty() {
                suggestions.push("No immediate cleanup suggestions. System looks tidy!".to_string());
            }

            axum::Json(suggestions)
        }
        Err(e) => {
            axum::Json(vec![format!("Scan failed: {}", e)])
        }
    }
}

pub async fn run() {
    let http_client = HttpClient::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(5))
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .pool_max_idle_per_host(4)
        .build()
        .unwrap();

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let assets_path = std::path::Path::new(manifest_dir).join("static");
    let fallback_path = assets_path.clone();
    
    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/system", get(get_system))
        .route("/api/scan", post(start_scan))
        .route("/api/scan/stream", get(stream_scan))
        .route("/api/dedup", post(find_duplicates))
        .route("/api/ai/chat", post(ai_chat))
        .route("/api/large-files", get(get_large_files))
        .route("/api/cleanup/suggestions", get(get_cleanup_suggestions))
        .fallback_service(ServeDir::new(&assets_path).fallback(get(move || async move {
            Html(std::fs::read_to_string(fallback_path.join("index.html"))
                .unwrap_or_else(|_| "<h1>Space Analyzer Pro</h1><p>Frontend not found</p>".to_string()))
        })))
        .layer(CorsLayer::permissive())
        .with_state(http_client);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 Server running on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}