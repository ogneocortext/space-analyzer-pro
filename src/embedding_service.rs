//! Embedding service for semantic file search
//!
//! Provides cosine similarity search over file path embeddings,
//! enabling natural language queries like "find my large video files".

use super::gui_common::formatting;
use super::ollama::OllamaClient;

/// A search result with similarity score
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub file_path: String,
    pub file_size: u64,
    pub file_extension: String,
    pub similarity: f32,
}

/// Compute cosine similarity between two vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom < 1e-8 {
        0.0
    } else {
        dot / denom
    }
}

/// Create a text description of a file for embedding
pub fn file_to_description(file_path: &str, file_size: u64, extension: &str) -> String {
    let size_label = formatting::format_bytes(file_size);

    // Extract just the filename from the path
    let filename = file_path
        .rsplit('\\')
        .next()
        .or_else(|| file_path.rsplit('/').next())
        .unwrap_or(file_path);

    format!(
        "File: {} ({}) {} {}",
        filename, extension, size_label, file_path
    )
}

/// Embed a batch of file descriptions using Ollama
pub async fn embed_files(
    client: &OllamaClient,
    files: &[(String, u64, String)],
) -> Result<Vec<Vec<f32>>, String> {
    let descriptions: Vec<String> = files
        .iter()
        .map(|(path, size, ext)| file_to_description(path, *size, ext))
        .map(|s| s.to_lowercase()) // nomic-embed-text 0.30+ lowercases inputs
        .collect();

    let (embeddings, _) = client
        .embed(descriptions)
        .await
        .map_err(|e| format!("Embedding failed: {}", e))?;

    Ok(embeddings)
}

/// Embed a search query
pub async fn embed_query(client: &OllamaClient, query: &str) -> Result<Vec<f32>, String> {
    // nomic-embed-text 0.30+ lowercases inputs; normalize query to match stored embeddings
    let normalized_query = query.to_lowercase();
    let (embeddings, _) = client
        .embed(vec![normalized_query])
        .await
        .map_err(|e| format!("Query embedding failed: {}", e))?;

    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| "No embedding returned for query".to_string())
}

/// Search for files matching a query using pre-loaded embeddings
pub fn search_files(
    query_embedding: &[f32],
    stored_embeddings: &[(String, u64, String, Vec<f32>)],
    top_k: usize,
) -> Vec<SearchResult> {
    let mut scores: Vec<SearchResult> = stored_embeddings
        .iter()
        .map(|(path, size, ext, embedding)| SearchResult {
            file_path: path.clone(),
            file_size: *size,
            file_extension: ext.clone(),
            similarity: cosine_similarity(query_embedding, embedding),
        })
        .collect();

    // Sort by similarity descending
    scores.sort_by(|a, b| {
        b.similarity
            .partial_cmp(&a.similarity)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Return top K
    scores.truncate(top_k);
    scores
}
