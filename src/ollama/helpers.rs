use base64::Engine;

use crate::ollama::types::ToolDefinition;

pub fn split_thinking(response: &crate::ollama::types::ChatResponse) -> (Option<String>, String) {
    let thinking = response
        .message
        .thinking
        .as_ref()
        .filter(|s| !s.is_empty())
        .cloned();
    let content = response.message.content.clone();
    (thinking, content)
}

pub fn fmt_table(rows: &[(String, String)], headers: (&str, &str)) -> String {
    let mut out = format!("| {} | {} |\n|---|---|\n", headers.0, headers.1);
    for (a, b) in rows {
        out.push_str(&format!("| {} | {} |\n", a, b));
    }
    out
}

pub fn encode_image_for_ollama(bytes: &[u8], _max_dim: u32) -> Result<(String, u64), String> {
    let is_png = bytes.len() >= 8 && &bytes[..8] == b"\x89PNG\r\n\x1a\n";
    let is_jpeg = bytes.len() >= 3 && &bytes[..3] == b"\xFF\xD8\xFF";
    if !is_png && !is_jpeg {
        return Err(format!(
            "unsupported image format (first bytes: {:02X?}, need PNG or JPEG)",
            &bytes[..bytes.len().min(8)]
        ));
    }
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    let sent = b64.len() as u64;
    Ok((b64, sent))
}

pub fn resolve_tool_choice(question: &str, tools: &[ToolDefinition]) -> String {
    let q_lower = question.to_lowercase();
    let domain_keywords = [
        "scan",
        "volume",
        "drive",
        "workflow",
        "duplicate",
        "dedup",
        "recycle",
        "trend",
        "prediction",
        "history",
        "cleanup",
    ];
    let has_domain_keyword = domain_keywords.iter().any(|k| q_lower.contains(k));
    let has_tool_name = tools
        .iter()
        .any(|t| q_lower.contains(&t.function.name.to_lowercase()));
    if tools.is_empty() || q_lower.contains("hello") || q_lower.contains("hi ") {
        "auto".to_string()
    } else if has_domain_keyword || has_tool_name {
        "required".to_string()
    } else {
        "auto".to_string()
    }
}
