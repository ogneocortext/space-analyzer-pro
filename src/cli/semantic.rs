//! `embed` and `semantic-search` subcommands: build and query semantic
//! embeddings for natural-language file search.

use crate::cli::args::OutputFormat;
use crate::cli::helpers;
use serde_json::Value;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::database::FileEmbeddingRecord;
use space_analyzer_pro_desktop::embedding_service::{embed_files, embed_query, search_files};
use space_analyzer_pro_desktop::error::{AppError, AppResult};
use space_analyzer_pro_desktop::gui_common::ScanReport;
use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use std::path::PathBuf;
use walkdir::WalkDir;

type EmbeddedFile = (String, u64, String, Vec<f32>);

/// Normalize a path for comparison: unify separators to `/`, drop a trailing
/// separator, and lowercase so `C:\X`, `C:\X\`, and `C:/x` compare equal.
fn normalize_path_for_match(p: &str) -> String {
    p.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

/// Collect `(path, size, extension)` tuples for a directory, honoring the size
/// window, the `file_limit` cap, and the hidden-files toggle. Used to feed the
/// embedding pipeline.
///
/// To keep the index representative on large trees, files are walked up to a
/// bounded collection cap (16× `file_limit`) and then strided-sampled down to
/// `file_limit`. A naive "take the first N" would only ever cover the
/// depth-first-first files (often a single subdirectory); striding over a
/// path-sorted list spreads the sample across the whole tree.
fn collect_files(
    root: &PathBuf,
    include_hidden: bool,
    min_size: Option<u64>,
    max_size: Option<u64>,
    file_limit: usize,
) -> Vec<(String, u64, String)> {
    let file_limit = file_limit.max(1);
    // Bound memory on whole-drive walks: never hold more than this many path
    // tuples while walking; the sample is drawn from whatever was collected.
    let collect_cap = file_limit.saturating_mul(16).max(file_limit);

    let mut collected: Vec<(String, u64, String)> = Vec::new();
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
        let raw = path.to_string_lossy().to_string();
        // Strip the `\\?\` long-path prefix Windows/walkdir emits so the
        // stored path is the friendly form the GUI should display.
        let path_str = raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string();
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();
        collected.push((path_str, size, ext));
        if collected.len() >= collect_cap {
            break;
        }
    }

    if collected.len() <= file_limit {
        return collected;
    }

    // Deterministic sample spread evenly across the (path-sorted) tree so the
    // index is representative rather than only covering the depth-first-first
    // files. Picks exactly `file_limit` entries at proportional positions.
    collected.sort_by(|a, b| a.0.cmp(&b.0));
    let step = collected.len() as f64 / file_limit as f64;
    let mut out = Vec::with_capacity(file_limit);
    for i in 0..file_limit {
        let idx = ((i as f64) * step).round() as usize;
        let idx = idx.min(collected.len() - 1);
        out.push(collected[idx].clone());
    }
    out
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
    if_not_indexed: bool,
    format: OutputFormat,
) -> AppResult<()> {
    let raw_path = path.unwrap_or_else(|| ".".to_string());
    let scan_path = helpers::resolve_scan_path(&raw_path)?;
    let display = helpers::display_path(&scan_path);

    let db = Database::default_open()
        .ok()
        .ok_or_else(|| AppError::Validation("Could not open embedded database".to_string()))?;
    let settings = db.load_settings();

    let min = min_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    let mut max = max_size
        .as_ref()
        .map(|s| helpers::parse_size(s))
        .transpose()?;
    // When the caller did not set an explicit upper bound, default to the
    // configured large-file threshold so oversized binaries (which embed
    // poorly and waste tokens) are skipped rather than sent to the model.
    if max.is_none() && settings.large_file_threshold_mb > 0 {
        let threshold = settings
            .large_file_threshold_mb
            .saturating_mul(1024)
            .saturating_mul(1024);
        max = Some(threshold);
        eprintln!(
            "[EMBED] Skipping files larger than {} MiB (large_file_threshold_mb)",
            settings.large_file_threshold_mb
        );
    }
    helpers::validate_size_window(min, max)?;

    let files = collect_files(
        &scan_path,
        include_hidden,
        min,
        max,
        settings.embedding_file_limit,
    );
    if files.is_empty() {
        return Err(AppError::Validation(format!(
            "No files found under {display} matching the size criteria"
        )));
    }

    // Issue #3: an explicitly-supplied scan id must actually belong to this
    // path. Otherwise we could attach folder A's vectors to a scan record that
    // represents folder B.
    if let Some(requested_id) = scan_id {
        match db.get_scan_by_id(requested_id) {
            Ok(Some(rec)) => {
                if normalize_path_for_match(&rec.path)
                    != normalize_path_for_match(&display)
                {
                    return Err(AppError::Validation(format!(
                        "Scan #{requested_id} indexes `{}`, which does not match the requested embed path `{}`",
                        rec.path, display
                    )));
                }
            }
            Ok(None) => {
                return Err(AppError::Validation(format!(
                    "No scan record found with id {requested_id}"
                )))
            }
            Err(e) => {
                return Err(AppError::Validation(format!(
                    "Failed to read scan #{requested_id}: {e}"
                )))
            }
        }
    }

    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| AppError::Validation(format!("Failed to start async runtime: {e}")))?;
    let client = OllamaClient::new(&settings.ollama_url, &settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?
        .with_model(&settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?;

    // Resolve the scan id, creating an index-only placeholder record when none
    // is supplied. The placeholder is tagged so the History UI hides it and
    // overflow pruning leaves it alone.
    let scan_id = match scan_id {
        Some(id) => id,
        None => {
            let mut result = ScanReport::new();
            result.path = display.clone();
            result.total_files = files.len();
            result.total_size_bytes = files.iter().map(|(_, s, _)| *s).sum();
            result.is_index_only = true;
            db.save_scan(&result, false, false, 5)
                .map_err(|e| AppError::Validation(format!("Failed to create scan record: {e}")))?
        }
    };

    // Issue #1: reuse a fresh existing index instead of rebuilding it. A rebuild
    // re-runs the whole Ollama job and clobbers any index already built for this
    // scan (e.g. by the GUI). Only reuse when the stored model matches the
    // current one, otherwise the index is stale and must be rebuilt.
    if if_not_indexed {
        if let Some(stored_model) = db
            .get_embedding_model(scan_id)
            .map_err(|e| AppError::Validation(format!("Failed to read embedding model: {e}")))?
        {
            if stored_model == settings.embedding_model {
                let existing = db
                    .count_embeddings_for_scan(scan_id)
                    .map_err(|e| AppError::Validation(format!("Failed to count embeddings: {e}")))?;
                if existing > 0 {
                    if format == OutputFormat::Json {
                        let response = serde_json::json!({
                            "scan_id": scan_id,
                            "embedded": existing,
                            "model": settings.embedding_model,
                            "path": display,
                            "reused": true,
                        });
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&response).unwrap_or_default()
                        );
                    } else {
                        println!(
                            "Reused existing index of {existing} file(s) for scan #{scan_id} ({display}) using {}",
                            settings.embedding_model
                        );
                    }
                    return Ok(());
                }
            }
        }
    }

    eprintln!(
        "[EMBED] Generating embeddings for {} file(s) via {} (batch size {})",
        files.len(),
        settings.embedding_model,
        settings.embedding_batch_size
    );
    let embeddings = rt
        .block_on(embed_files(&client, &files, settings.embedding_batch_size))
        .map_err(AppError::Validation)?;

    let n_files = files.len();
    let records: Vec<EmbeddedFile> = files
        .into_iter()
        .zip(embeddings)
        .map(|((p, s, e), v)| (p, s, e, v))
        .collect();

    // Issue #5: `embed_files` already guarantees a 1:1 vector count, but guard
    // explicitly so a desync fails loudly instead of silently dropping entries.
    if records.len() != n_files {
        return Err(AppError::Validation(format!(
            "Embedding mismatch: collected {n_files} files but produced {} vectors",
            records.len()
        )));
    }

    let count = db
        .save_embeddings(scan_id, &settings.embedding_model, &records)
        .map_err(|e| AppError::Validation(format!("Failed to store embeddings: {e}")))?;

    if format == OutputFormat::Json {
        let response = serde_json::json!({
            "scan_id": scan_id,
            "embedded": count,
            "model": settings.embedding_model,
            "path": display,
            "reused": false,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&response).unwrap_or_default()
        );
    } else {
        println!(
            "Embedded {count} file(s) for scan #{scan_id} ({display}) using {}",
            settings.embedding_model
        );
    }
    Ok(())
}

/// Deserialize stored embedding vectors and run a cosine-similarity search.
fn load_stored_embeddings(db: &Database, scan_id: i64) -> AppResult<Vec<EmbeddedFile>> {
    let rows: Vec<FileEmbeddingRecord> = db.get_embeddings_for_scan(scan_id).map_err(|e| {
        AppError::Validation(format!(
            "Failed to load embeddings for scan #{scan_id}: {e}"
        ))
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
///
/// `min_score` (when set) drops matches whose cosine similarity is below the
/// floor. This suppresses the "central-document" noise that dominates when
/// embedding scores are compressed into a narrow band: a query still returns
/// its genuinely closest files, while a generic file that only scores mid-pack
/// (e.g. a notes file that appears in every query) no longer pollutes the list.
pub fn run_search(
    query: String,
    scan_id: i64,
    top: usize,
    min_score: Option<f32>,
    format: OutputFormat,
) -> AppResult<()> {
    let db = Database::default_open()
        .ok()
        .ok_or_else(|| AppError::Validation("Could not open embedded database".to_string()))?;

    if db
        .get_scan_by_id(scan_id)
        .map_err(|e| AppError::Validation(e.to_string()))?
        .is_none()
    {
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

    let settings = db.load_settings();

    // Detect index/model drift before embedding the query. Comparing the
    // stamped model (not just vector dimension) catches the case where the
    // configured model changed but still produces the same dimension, which
    // would otherwise silently degrade every similarity score.
    if let Some(stored_model) = db
        .get_embedding_model(scan_id)
        .map_err(|e| AppError::Validation(format!("Failed to read embedding model: {e}")))?
    {
        if stored_model != settings.embedding_model {
            return Err(AppError::Validation(format!(
                "The semantic index for scan #{scan_id} was built with embedding model `{}`, \
                 but the current model is `{}`. Re-run `embed` to rebuild the index before searching.",
                stored_model, settings.embedding_model
            )));
        }
    }
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| AppError::Validation(format!("Failed to start async runtime: {e}")))?;
    let client = OllamaClient::new(&settings.ollama_url, &settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?
        .with_model(&settings.embedding_model)
        .map_err(|e| AppError::Validation(format!("Ollama client error: {e}")))?;

    let query_embedding = rt
        .block_on(embed_query(&client, &query))
        .map_err(AppError::Validation)?;

    // Guard against a stale index built with a different model or version.
    // Stored vectors and the live query must share a dimension; otherwise
    // every cosine similarity degrades to 0.0 and the query silently returns
    // nothing useful. Surface it instead of masking it.
    if let Some(stored_dim) = stored.first().map(|(_, _, _, v)| v.len()) {
        let query_dim = query_embedding.len();
        if stored_dim != query_dim {
            return Err(AppError::Validation(format!(
                "The semantic index for scan #{scan_id} was built at dimension {stored_dim}, \
                 but the current embedding model `{}` produces dimension {query_dim}. \
                 Re-run `embed` to rebuild the index before searching.",
                settings.embedding_model
            )));
        }
    }

    let mut results = search_files(&query_embedding, &stored, top);
    if let Some(floor) = min_score {
        // Clamp the floor to a sane range and drop sub-threshold matches.
        let floor = floor.clamp(0.0, 1.0);
        results.retain(|r| r.similarity >= floor);
    }

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
            "min_score": min_score,
            "results": json_results,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&response).unwrap_or_default()
        );
    } else {
        if results.is_empty() {
            println!(
                "No files matched the query{}",
                min_score
                    .map(|f| format!(" above the {:.0}% similarity floor", f * 100.0))
                    .unwrap_or_default()
            );
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
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::collect_files;
    use space_analyzer_pro_desktop::embedding_service::embed_files;
    use space_analyzer_pro_desktop::ollama::client::OllamaClient;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    static DIR_SEQ: AtomicU64 = AtomicU64::new(0);

    /// Each call gets a unique temp directory so tests can't contaminate each
    /// other (a shared name plus a silently-failing `remove_dir_all` caused
    /// earlier runs to accumulate files across tests).
    fn make_temp_dir() -> PathBuf {
        let seq = DIR_SEQ.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("sa_semtest_{}_{}", std::process::id(), seq));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn write_file(dir: &Path, name: &str, size: usize) {
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, vec![b'x'; size]).expect("write test file");
    }

    #[test]
    fn collect_files_respects_file_limit() {
        let dir = make_temp_dir();
        for i in 0..5 {
            write_file(&dir, &format!("f{}.txt", i), 10);
        }
        let files = collect_files(&dir, false, None, None, 99);
        assert_eq!(files.len(), 5, "all files should be collected");

        let limited = collect_files(&dir, false, None, None, 2);
        assert_eq!(limited.len(), 2, "file_limit must cap the returned count");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn collect_files_respects_size_window() {
        let dir = make_temp_dir();
        write_file(&dir, "small.txt", 10);
        write_file(&dir, "mid.txt", 100);
        write_file(&dir, "big.txt", 1000);
        // min=50, max=500 -> only the 100-byte file qualifies
        let files = collect_files(&dir, false, Some(50), Some(500), 100);
        assert_eq!(files.len(), 1, "only mid-sized file should pass the window");
        assert_eq!(files[0].1, 100);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn collect_files_skips_dotfiles_when_hidden_disabled() {
        let dir = make_temp_dir();
        write_file(&dir, "visible.txt", 10);
        write_file(&dir, ".hidden.txt", 10);
        let files = collect_files(&dir, false, None, None, 100);
        assert_eq!(
            files.len(),
            1,
            "dotfile must be skipped when include_hidden=false"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    // Live test: requires a running Ollama with `nomic-embed-text:v1.5`.
    // Run with `cargo test --bin space-analyzer-cli -- --ignored`.
    #[test]
    #[ignore]
    fn embed_files_batches_without_losing_vectors() {
        let dir = make_temp_dir();
        let mut files: Vec<(String, u64, String)> = Vec::new();
        for i in 0..5 {
            let name = format!("doc{}.txt", i);
            write_file(&dir, &name, 12 + i);
            files.push((
                dir.join(&name).to_string_lossy().to_string(),
                (12 + i) as u64,
                "txt".to_string(),
            ));
        }

        let client = OllamaClient::new("http://127.0.0.1:11434", "nomic-embed-text:v1.5")
            .expect("Ollama client build failed");

        let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
        // Single large batch vs small batches: vector counts must match.
        let single = rt
            .block_on(embed_files(&client, &files, 1000))
            .expect("embed (single batch)");
        let batched = rt
            .block_on(embed_files(&client, &files, 2))
            .expect("embed (batched)");

        assert_eq!(single.len(), 5, "single batch should return 5 vectors");
        assert_eq!(batched.len(), 5, "batched path should return 5 vectors");
        assert!(!single[0].is_empty(), "vectors must be non-empty");
        assert_eq!(
            single[0].len(),
            batched[0].len(),
            "dimension must be consistent across batch sizes"
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
