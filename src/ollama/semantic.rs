//! Semantic search feature using Ollama embeddings.

use std::time::Instant;

use super::client::OllamaClient;
use crate::embedding_service::{self};
use crate::ollama::models::{SemanticSearchInput, SemanticSearchOutput};

/// Embed a list of files and a query, then return top-K matches by
/// cosine similarity. Only one round-trip is made to Ollama (the query
/// embed), assuming the file embeddings were pre-computed by the
/// caller. The caller can pre-compute file embeddings once and re-use
/// them for many queries — that's the data-flow win.
pub async fn semantic_search(
    client: &OllamaClient,
    model: &str,
    input: SemanticSearchInput,
) -> Result<SemanticSearchOutput, String> {
    let started = Instant::now();

    let normalized_query = format!(
        "{}{}",
        embedding_service::EMBED_QUERY_PREFIX,
        input.query.to_lowercase()
    );

    // Build descriptions for files (caller may have cached these too).
    let descriptions: Vec<String> = input
        .files
        .iter()
        .map(|(p, s, e)| embedding_service::file_to_description(p, *s, e).to_lowercase())
        .collect();

    if descriptions.is_empty() {
        return Err("semantic_search: files list is empty".to_string());
    }

    // Batch-embed the query + all file descriptions in a single call.
    // This sends N+1 strings to the model and gets N+1 vectors back.
    let mut batch = vec![normalized_query];
    batch.extend(descriptions);

    let (mut vectors, usage) = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .embed(batch)
        .await
        .map_err(|e| e.to_string())?;

    if vectors.is_empty() {
        return Err("semantic_search: model returned no vectors".to_string());
    }
    let query_vec = vectors.remove(0);
    let file_vecs = vectors;
    let query_dim = query_vec.len();

    let stored: Vec<(String, u64, String, Vec<f32>)> = input
        .files
        .iter()
        .zip(file_vecs)
        .map(|((p, s, e), v)| (p.clone(), *s, e.clone(), v))
        .collect();

    let mut matches = embedding_service::search_files(&query_vec, &stored, input.top_k);
    // Truncate to top_k defensively in case upstream search changed
    matches.truncate(input.top_k);

    Ok(SemanticSearchOutput {
        matches,
        query_dim,
        files_searched: input.files.len(),
        duration_ms: started.elapsed().as_millis(),
        query_tokens: usage.prompt_tokens,
    })
}
