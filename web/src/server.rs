use axum::{
    routing::{get, post},
    Router,
    response::Html,
    extract::{Json, State, Query},
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use axum::serve;
use serde::{Deserialize, Serialize};
use shared_scanner::{FileScanner, ScanOptions, get_system_info, SystemInfo};
use file_deduplicator::{FileDeduplicator, DeduplicationResult};
use reqwest::Client as HttpClient;

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
) -> axum::Json<shared_scanner::ScanResult> {
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
            axum::Json(shared_scanner::ScanResult {
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
) -> axum::Json<Vec<shared_scanner::FileInfo>> {
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
        max_depth: Some(2),
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
            
            // Large files
            if !scan_result.largest_files.is_empty() {
                suggestions.push(format!(
                    "Found {} large files (>{}). Consider moving old media to external storage.",
                    scan_result.largest_files.len(),
                    shared_scanner::format_bytes(params.min_size.unwrap_or(100 * 1024 * 1024))
                ));
            }
            
            // Empty directories
            if !scan_result.empty_directories.is_empty() {
                suggestions.push(format!(
                    "Found {} empty directories that can be removed.",
                    scan_result.empty_directories.len()
                ));
                for dir in scan_result.empty_directories.iter().take(5) {
                    suggestions.push(format!("  - {}", dir));
                }
            }
            
            // Temp/cache files
            let temp_extensions: Vec<_> = scan_result
                .file_types
                .keys()
                .filter(|ext| {
                    let ext_lower = ext.to_lowercase();
                    ext_lower == "tmp" || ext_lower == "temp" || ext_lower == "cache" || ext_lower == "log"
                })
                .collect();
            if !temp_extensions.is_empty() {
                suggestions.push(format!(
                    "Found {} temp/cache/log file types that may be safe to clean.",
                    temp_extensions.len()
                ));
            }
            
            // High concentration of one file type
            if let Some((ext, count)) = scan_result.file_types.iter().max_by_key(|(_, c)| *c) {
                if *count > 1000 {
                    suggestions.push(format!(
                        "High concentration of .{} files ({} items). Consider archiving old {} files.",
                        ext, count, ext
                    ));
                }
            }
            
            // Errors during scan
            if !scan_result.errors.is_empty() {
                suggestions.push(format!(
                    "{} permission/path errors encountered during scan. Review access rights.",
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