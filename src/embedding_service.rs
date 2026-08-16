//! Embedding service for semantic file search
//!
//! Provides cosine similarity search over file path embeddings,
//! enabling natural language queries like "find my large video files".

use super::gui_common::formatting;
use super::ollama::OllamaClient;

/// nomic-embed-text is trained for asymmetric retrieval: documents and
/// queries live in different subspaces and must be tagged with task
/// prefixes so the model knows which side of the pair each string is.
/// Omitting these prefixes collapses both into the same (document) space
/// and badly degrades query relevance. See the nomic-embed-text model card.
pub const EMBED_DOC_PREFIX: &str = "search_document: ";
pub const EMBED_QUERY_PREFIX: &str = "search_query: ";

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
        "{}{} ({}) {} {}",
        EMBED_DOC_PREFIX, filename, extension, size_label, file_path
    )
}

/// Embed a batch of file descriptions using Ollama.
///
/// Files are sent in chunks of `batch_size` rather than all at once, so a
/// large corpus (the embed pipeline can collect up to `embedding_file_limit`
/// entries) becomes many bounded requests instead of one unbounded payload.
/// This keeps memory flat and turns an all-or-nothing failure into a
/// per-chunk error with partial progress already persisted upstream.
pub async fn embed_files(
    client: &OllamaClient,
    files: &[(String, u64, String)],
    batch_size: usize,
) -> Result<Vec<Vec<f32>>, String> {
    let batch_size = batch_size.max(1);
    let mut embeddings: Vec<Vec<f32>> = Vec::with_capacity(files.len());

    for chunk in files.chunks(batch_size) {
        let descriptions: Vec<String> = chunk
            .iter()
            .map(|(path, size, ext)| file_to_description(path, *size, ext))
            .map(|s| s.to_lowercase()) // nomic-embed-text 0.30+ lowercases inputs
            .collect();

        let (chunk_embeddings, _) = client
            .embed(descriptions)
            .await
            .map_err(|e| format!("Embedding failed: {}", e))?;

        embeddings.extend(chunk_embeddings);
    }

    Ok(embeddings)
}

/// Embed a search query
pub async fn embed_query(client: &OllamaClient, query: &str) -> Result<Vec<f32>, String> {
    // nomic-embed-text is asymmetric: tag the query with the matching
    // task prefix and lowercase it (0.30+ lowercases inputs anyway).
    let normalized_query = format!("{}{}", EMBED_QUERY_PREFIX, query.to_lowercase());
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
