//! `embed` and `semantic-search` subcommands: build and query semantic
//! embeddings for natural-language file search.

use crate::cli::args::OutputFormat;
use crate::cli::helpers;
use serde_json::Value;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::database::FileEmbeddingRecord;
use space_analyzer_pro_desktop::embedding_service::{embed_files, embed_query, search_files};
use space_analyzer_pro_desktop::error::{AppError, AppResult};
use space_analyzer_pro_desktop::gui_common::ScanResult;
use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use std::path::PathBuf;
use walkdir::WalkDir;

const MAX_EMBED_FILES: usize = 100_000;

/// Collect `(path, size, extension)` tuples for a directory, honoring the size
/// window and the hidden-files toggle. Used to feed the embedding pipeline.
fn collect_files(
    root: &PathBuf,
    include_hidden: bool,
    min_size: Option<u64>,
    max_size: Option<u64>,
) -> Vec<(String, u64, String)> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if !include_hidden {
            // Skip entries with a hidden ancestor or a dot-file name.
            if path
                .components()
                .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
            {
                continue;
            }
        }
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = metadata.len();
        if let Some(min) = min_size {
            if size < min {
                continue;
            }
        }
        if let Some(max) = max_size {
            if size > max {
                continue;
            }
        }
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();
        files.push((path.to_string_lossy().to_string(), size, ext));
        if files.len() >= MAX_EMBED_FILES {
            break;
        }
    }
    files
}

/// Run the `embed` subcommand: scan a directory, embed every file via Ollama,
/// and persist the vectors under a scan id.
pub fn run_embed(
    path: Option<String>,
    scan_id: Option<i64>,
    min_size: Option<String>,
    max_size: Option<String>,
    include_hidden: bool,
    _no_gpu: bool,
    format: OutputFormat,
) -> AppResult<()> {
    let raw_path = path.unwrap_or_else(|| ".".to_string());
    let scan_path = helpers::resolve_scan_path(&raw_path)?;
    let display = helpers::display_path(&scan_path);

    let min = min_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    let max = max_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    helpers::validate_size_window(min, max)?;

    let files = collect_files(&scan_path, include_hidden, min, max);
    if files.is_empty() {
        return Err(AppError::Validation(format!(
            "No files found under {display} matching the size criteria"
        )));
    }

    let settings = Database::default_open()
        .ok()
        .as_ref()
        .map(|db| db.load_settings())
        .unwrap_or_default();

    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| AppError::Validation(format!("Failed to start async runtime: {e}")))?;
    let client = OllamaClient::new(&settings.ollama_url, &settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?
        .with_model(&settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?;

    eprintln!(
        "[EMBED] Generating embeddings for {} file(s) via {}",
        files.len(),
        settings.embedding_model
    );
    let embeddings = rt
        .block_on(embed_files(&client, &files))
        .map_err(|e| AppError::Validation(e))?;

    let db = Database::default_open()
        .ok()
        .ok_or_else(|| AppError::Validation("Could not open embedded database".to_string()))?;

    let scan_id = match scan_id {
        Some(id) => id,
        None => {
            let mut result = ScanResult::new();
            result.path = display.clone();
            result.total_files = files.len();
            result.total_size_bytes = files.iter().map(|(_, s, _)| *s).sum();
            db.save_scan(&result, false, false, 5).map_err(|e| {
                AppError::Validation(format!("Failed to create scan record: {e}"))
            })?
        }
    };

    let records: Vec<(String, u64, String, Vec<f32>)> = files
        .into_iter()
        .zip(embeddings)
        .map(|((p, s, e), v)| (p, s, e, v))
        .collect();

    let count = db
        .save_embeddings(scan_id, &records)
        .map_err(|e| AppError::Validation(format!("Failed to store embeddings: {e}")))?;

    if format == OutputFormat::Json {
        let response = serde_json::json!({
            "scan_id": scan_id,
            "embedded": count,
            "model": settings.embedding_model,
            "path": display,
        });
        println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
    } else {
        println!(
            "Embedded {count} file(s) for scan #{scan_id} ({display}) using {}",
            settings.embedding_model
        );
    }
    Ok(())
}

/// Deserialize stored embedding vectors and run a cosine-similarity search.
fn load_stored_embeddings(
    db: &Database,
    scan_id: i64,
) -> AppResult<Vec<(String, u64, String, Vec<f32>)>> {
    let rows: Vec<FileEmbeddingRecord> = db.get_embeddings_for_scan(scan_id).map_err(|e| {
        AppError::Validation(format!("Failed to load embeddings for scan #{scan_id}: {e}"))
    })?;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let vec: Vec<f32> = serde_json::from_str(&row.embedding_json)
            .map_err(|e| AppError::Validation(format!("Corrupt embedding record: {e}")))?;
        out.push((row.file_path, row.file_size, row.file_extension, vec));
    }
    Ok(out)
}

/// Run the `semantic-search` subcommand.
pub fn run_search(query: String, scan_id: i64, top: usize, format: OutputFormat) -> AppResult<()> {
    let db = Database::default_open()
        .ok()
        .ok_or_else(|| AppError::Validation("Could not open embedded database".to_string()))?;

    if db.get_scan_by_id(scan_id).map_err(|e| AppError::Validation(e.to_string()))?.is_none() {
        return Err(AppError::Validation(format!(
            "No scan record found with id {scan_id}"
        )));
    }

    let stored = load_stored_embeddings(&db, scan_id)?;
    if stored.is_empty() {
        return Err(AppError::Validation(format!(
            "No embeddings stored for scan #{scan_id}. Run `embed` first."
        )));
    }

    let settings = db
        .load_settings();
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| AppError::Validation(format!("Failed to start async runtime: {e}")))?;
    let client = OllamaClient::new(&settings.ollama_url, &settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?
        .with_model(&settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?;

    let query_embedding = rt
        .block_on(embed_query(&client, &query))
        .map_err(|e| AppError::Validation(e))?;

    let results = search_files(&query_embedding, &stored, top);

    if format == OutputFormat::Json {
        let json_results: Vec<Value> = results
            .iter()
            .map(|r| {
                serde_json::json!({
                    "file_path": r.file_path,
                    "file_size": r.file_size,
                    "file_extension": r.file_extension,
                    "similarity": r.similarity,
                })
            })
            .collect();
        let response = serde_json::json!({
            "query": query,
            "scan_id": scan_id,
            "results": json_results,
        });
        println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
    } else {
        println!("Top {} matches for: \"{}\"", results.len(), query);
        for (i, r) in results.iter().enumerate() {
            println!(
                "  {}. {} ({:.1}% similar) [{}]",
                i + 1,
                r.file_path,
                r.similarity * 100.0,
                r.file_extension
            );
        }
    }
    Ok(())
}
