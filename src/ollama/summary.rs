//! Scan summary feature using Ollama completion.

use std::time::Instant;

use super::client::OllamaClient;
use crate::ollama::helpers::fmt_table;
use crate::ollama::helpers::split_thinking;
use crate::ollama::models::{ScanSummaryInput, ScanSummaryOutput};

/// Ask the model for a 2-3 sentence summary of a scan. The prompt is
/// deliberately compact: only the top-10 largest files and the
/// top-10 file types, formatted as a small markdown table. We never
/// send the full file list (which could be millions of entries).
pub async fn summarize_scan(
    client: &OllamaClient,
    model: &str,
    input: ScanSummaryInput,
) -> Result<ScanSummaryOutput, String> {
    let started = Instant::now();

    let size_mb = input.total_size_bytes as f64 / 1_048_576.0;
    let reclaimable_mb = input.potential_cleanup_bytes.unwrap_or(0) as f64 / 1_048_576.0;
    let scan_path = input.path.as_deref().unwrap_or("(unknown)");
    let mut top_files: Vec<(String, String)> = input
        .top_files
        .iter()
        .take(10)
        .map(|file| {
            let name = file
                .path
                .rsplit(['\\', '/'])
                .next()
                .unwrap_or(&file.path)
                .to_string();
            (name, format!("{:.1} MB", file.size as f64 / 1_048_576.0))
        })
        .collect();
    if top_files.is_empty() {
        top_files.push(("(none)".to_string(), "-".to_string()));
    }
    let files_table = fmt_table(&top_files, ("File", "Size"));

    let mut types: Vec<(String, String)> = input
        .file_types
        .iter()
        .take(10)
        .map(|(ext, bytes)| (format!(".{}", ext), format!("{:.1} MB", *bytes as f64 / 1_048_576.0)))
        .collect();
    if types.is_empty() {
        types.push(("(none)".to_string(), "-".to_string()));
    }
    let types_table = fmt_table(&types, ("Extension", "Size"));

    let system = "You are a concise disk-space analyst. \
        Summarize scans in 2-3 short sentences. \
        Highlight the largest space hogs and any obvious cleanup wins. \
        Provide up to 3 key insights as a JSON array. \
        Do not use bullet points in the summary text.";

    let user = format!(
        "Scan of: {}\n\
         - Total files: {}\n\
         - Total size: {:.1} MB\n\
         - Reclaimable: {:.1} MB\n\n\
         Top largest files:\n{}\n\n\
         File-type breakdown by size:\n{}",
        scan_path, input.total_files, size_mb, reclaimable_mb, files_table, types_table
    );

    // Structured output schema constrains the model to return parseable JSON
    let format_schema = serde_json::json!({
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "2-3 sentence scan summary highlighting largest space hogs and cleanup wins"
            },
            "key_insights": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Up to 3 key observations about the scan"
            }
        },
        "required": ["summary"]
    });

    let request = crate::ollama::types::ChatRequest {
        model: model.to_string(),
        messages: vec![
            crate::ollama::types::ChatMessage::system(system),
            crate::ollama::types::ChatMessage::user(user),
        ],
        stream: Some(false),
        options: Some(crate::ollama::types::OllamaOptions::default()),
        think: Some(crate::ollama::types::TopLevelThink::Bool(true)),
        keep_alive: Some("2m".to_string()),
        format: Some(format_schema),
        tools: None,
        tool_choice: None,
    };

    let response = client
        .with_model(model)
        .map_err(|e| e.to_string())?
        .post_chat(&request)
        .await
        .map_err(|e| format!("summarize_scan: {}", e))?;

    let (_thinking, content) = split_thinking(&response);
    if content.trim().is_empty() {
        return Err("summarize_scan: model returned empty content".to_string());
    }

    let parsed = serde_json::from_str::<serde_json::Value>(&content).ok();
    let summary = parsed
        .as_ref()
        .and_then(|v| v.get("summary").and_then(|s| s.as_str().map(String::from)))
        .unwrap_or(content);
    let key_insights = parsed
        .as_ref()
        .and_then(|v| v.get("key_insights"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(ScanSummaryOutput {
        summary,
        key_insights,
        prompt_tokens: response.prompt_eval_count.unwrap_or(0),
        completion_tokens: response.eval_count.unwrap_or(0),
        duration_ms: started.elapsed().as_millis(),
    })
}
