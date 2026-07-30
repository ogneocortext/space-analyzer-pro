use space_analyzer_pro_desktop::ollama;

use super::types::{ModelPerformanceMetrics, OllamaModelInfo};

/// Classify an Ollama model into a UI-friendly `OllamaModelInfo`.
///
/// Uses the capability list reported by Ollama 0.30+ (`/api/tags` returns
/// `["completion", "tools", "thinking", "vision", "embedding", "insert"]`) as
/// the primary signal. Falls back to name-substring heuristics only when the
/// server omits the field (older Ollama versions).
///
/// Cloud models are filtered out at the discovery layer before this function
/// is called, so we don't need to handle them here.
///
/// The previous version of this function only matched a handful of model
/// names (`qwen3:8b`, `mistral:7b`, `functionary`, …) and assigned empty
/// capability lists to anything else — so a user with `qwen3.5:4b`,
/// `gemma3:4b`, or `llama3.1:8b` saw the model in the list but with no
/// indication of what it could do. That was the root cause of the
/// "model selector status is completely broken" symptom.
pub fn classify_model(info: &ollama::ModelInfo) -> OllamaModelInfo {
    let name = &info.name;
    let name_lower = name.to_lowercase();
    let mut capabilities = Vec::new();
    let mut recommended_for = "General chat and analysis".to_string();
    let mut tooltip = String::new();
    let mut vram_requirement = "8+ GB VRAM".to_string();

    let size_str = format!("{:.1} GB", info.size as f64 / 1_073_741_824.0);

    let caps_lower: Vec<String> = info.capabilities.iter().map(|s| s.to_lowercase()).collect();
    let has_cap = |needle: &str| caps_lower.iter().any(|c| c == needle);

    // Translate server-reported capabilities into UI strings.
    if has_cap("embedding") {
        capabilities.push("Semantic Embeddings".to_string());
        capabilities.push("Vector Search".to_string());
        capabilities.push("Similarity Detection".to_string());
        recommended_for =
            "Semantic file search, finding similar files, content-based queries".to_string();
        vram_requirement = "Lightweight (~250-500 MB)".to_string();
        tooltip = format!(
            "{} is an embedding model. It converts text into vectors for semantic search \
             and finding similar files. Set it as the Smart Search embedding model in Settings.",
            name
        );
    }

    if has_cap("vision") {
        capabilities.push("Vision-Language".to_string());
        capabilities.push("Image Analysis".to_string());
        capabilities.push("Screenshot Understanding".to_string());
        // Only override the recommendation if we don't already have something
        // more specific (e.g. embedding).
        if recommended_for.starts_with("General") {
            recommended_for =
                "Screenshot analysis, image understanding, visual file identification".to_string();
        }
        vram_requirement = "Moderate (~3-5 GB VRAM)".to_string();
        tooltip = format!(
            "{} understands images and screenshots. Use it to analyze UI screenshots, \
             identify visual patterns, or review design assets.",
            name
        );
    }

    if has_cap("tools") {
        capabilities.push("Tool Calling".to_string());
        capabilities.push("Agentic Workflows".to_string());
        capabilities.push("Function Execution".to_string());
        if recommended_for.starts_with("General") {
            recommended_for = "Automated workflows, file operations, system tasks".to_string();
        }
        if tooltip.is_empty() {
            tooltip = format!(
                "{} supports tool calling and agentic workflows. It can execute file \
                 operations, run scans, and automate repetitive tasks.",
                name
            );
        }
    }

    if has_cap("thinking") {
        capabilities.push("Advanced Reasoning".to_string());
        capabilities.push("Complex Analysis".to_string());
        if recommended_for.starts_with("General") {
            recommended_for = "Complex analysis tasks, multi-step reasoning".to_string();
        }
        if tooltip.is_empty() {
            tooltip = format!(
                "{} supports the Ollama 0.30+ \"thinking\" feature: it reasons step by step \
                 before answering. Best for complex queries and analysis tasks.",
                name
            );
        } else {
            tooltip.push_str(
                "\n\nSupports Ollama 0.30+ thinking mode — enable in Settings to see \
                 step-by-step reasoning.",
            );
        }
    }

    if has_cap("insert") {
        capabilities.push("Text Insertion (fill-in-middle)".to_string());
    }

    if has_cap("completion") {
        // Only add general chat if we don't have a more specific category.
        if capabilities.is_empty() {
            capabilities.push("General Chat".to_string());
            capabilities.push("Text Analysis".to_string());
            recommended_for = "Lightweight general-purpose assistant, quick answers".to_string();
            vram_requirement = "4-5 GB VRAM (typical 7B-8B model)".to_string();
            tooltip = format!(
                "{} is a general-purpose chat model. Use it for quick questions and analysis.",
                name
            );
        } else {
            capabilities.push("General Chat".to_string());
        }
    }

    // Fall back to name-substring heuristics ONLY when the server gave us no
    // capabilities at all. This keeps older Ollama versions functional.
    if info.capabilities.is_empty() {
        if name_lower.contains("embed") || name_lower.contains("nomic") {
            capabilities.push("Semantic Embeddings".to_string());
            capabilities.push("Vector Search".to_string());
            recommended_for = "Semantic file search, content-based queries".to_string();
        } else if name_lower.contains("vision") || name_lower.contains("vl") {
            capabilities.push("Vision-Language".to_string());
            capabilities.push("Image Analysis".to_string());
        } else if name_lower.contains("coder") || name_lower.contains("code") {
            capabilities.push("Code Generation".to_string());
            capabilities.push("Complex Analysis".to_string());
        } else {
            // Truly unknown — give the user a hint about what to do.
            capabilities.push("General Chat".to_string());
            recommended_for = format!(
                "Capabilities not reported by Ollama — upgrade to 0.30+ to see exact features \
                 for {}",
                name
            );
        }
    }

    // Add context length to the tooltip if reported.
    if let Some(ctx) = info.details.as_ref().and_then(|d| d.context_length) {
        tooltip.push_str(&format!("\n\nContext window: {}K tokens.", ctx / 1024));
    }

    // Add parameter size if reported.
    if let Some(params) = info.details.as_ref().map(|d| &d.parameter_size) {
        if !params.is_empty() {
            tooltip.push_str(&format!(" Size: {}.", params));
        }
    }

    // Warn about models that may exceed 8GB VRAM.
    if info.size > 8_589_934_592 {
        vram_requirement = format!(
            "{} GB - May require CPU offload on 8GB GPU",
            info.size / 1_073_741_824
        );
        tooltip.push_str(
            "\n\n[!] This model exceeds 8GB VRAM and will use CPU offload, reducing performance.",
        );
    }

    OllamaModelInfo {
        name: name.clone(),
        size: size_str,
        capabilities,
        recommended_for,
        vram_requirement,
        tooltip,
        performance_metrics: ModelPerformanceMetrics::default(),
        is_running: false,
        vram_usage_mb: None,
        cpu_usage_percent: None,
    }
}
