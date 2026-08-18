//! Space Analyzer Pro - Ollama Feature Smoke Test
//!
//! Exercises the five capability-driven features in `ollama::features`
//! against the real Ollama 0.30.5 server. Prints the full data flow
//! for each feature (request size, response, tokens, duration) so you
//! can see exactly what is sent and returned.
//!
//! USAGE:
//!   cargo run --bin ollama-features --release
//!   cargo run --bin ollama-features --release -- --url http://other-host:11434
//!   cargo run --bin ollama-features --release -- --image /path/to/screenshot.png
//!
//! FEATURES DEMOED:
//!   1. semantic_search    (embedding)  — nomic-embed-text:v1.5
//!   2. summarize_scan     (completion) — qwen3.5:4b
//!   3. cleanup_plan       (thinking)   — qwen3.5:4b
//!   4. describe_screenshot(vision)     — qwen3-vl:4b
//!   5. agentic_question   (tools)      — qwen3.5:4b

use std::path::PathBuf;
use std::time::{Duration, Instant};

use space_analyzer_pro_desktop::ollama::agentic::agentic_question;
use space_analyzer_pro_desktop::ollama::cleanup::cleanup_plan;
use space_analyzer_pro_desktop::ollama::models::{AgenticStep, StepKind};
use space_analyzer_pro_desktop::ollama::screenshot::describe_screenshot;
use space_analyzer_pro_desktop::ollama::semantic::semantic_search;
use space_analyzer_pro_desktop::ollama::summary::summarize_scan;
use space_analyzer_pro_desktop::ollama::{
    OllamaClient, OllamaClientBuilder, OperationTimeouts, ToolDefinition, ToolParameters,
    SYSTEM_PROMPT_ANALYSIS,
};

const DEFAULT_URL: &str = "http://127.0.0.1:11434";
const DEFAULT_IMAGE: &str = "assets/screenshots/design/prod_analysis_desktop.png";
const PER_REQUEST_TIMEOUT: Duration = Duration::from_secs(600);

struct App {
    url: String,
    image: PathBuf,
    started: Instant,
}

impl App {
    fn new() -> Self {
        let args: Vec<String> = std::env::args().collect();
        let url = flag_value(&args, "--url").unwrap_or_else(|| DEFAULT_URL.to_string());
        let image = flag_value(&args, "--image")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_IMAGE));
        Self {
            url,
            image,
            started: Instant::now(),
        }
    }

    fn header(&self, title: &str) {
        println!();
        println!("============================================================");
        println!("  {title}");
        println!("  URL: {}", self.url);
        println!("============================================================");
    }

    fn client(&self, model: &str) -> OllamaClient {
        OllamaClient::new(&self.url, model).expect("client builder failed")
    }

    fn client_with_timeout(&self, model: &str, timeout: Duration) -> OllamaClient {
        // Override BOTH the global HTTP timeout and the per-operation
        // chat timeout. The chat one is what `post_chat` reads, so
        // setting only the global one wouldn't help.
        let timeouts = OperationTimeouts {
            chat: timeout,
            ..OperationTimeouts::default()
        };
        OllamaClientBuilder::new(&self.url, model)
            .timeout(timeout)
            .with_operation_timeouts(timeouts)
            .build()
            .expect("client builder failed")
    }
}

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() {
    let app = App::new();
    println!("============================================================");
    println!("  Space Analyzer Pro - Ollama Feature Smoke Test");
    println!("  Started: {:?}", app.started.elapsed().as_secs_f32());
    println!("============================================================");

    if !app.image.exists() {
        eprintln!(
            "[WARN] Default screenshot path does not exist: {}",
            app.image.display()
        );
        eprintln!("       Use --image to point at a PNG/JPEG file.");
    }

    // Probe the server
    let probe = app.client("unused");
    match probe.get_version().await {
        Ok(v) => println!("[OK]  Ollama v{v}"),
        Err(e) => {
            println!("[FAIL] /api/version -> {e}");
            std::process::exit(2);
        }
    }

    let _ = tokio::time::timeout(PER_REQUEST_TIMEOUT, feature_semantic_search(&app)).await;
    let _ = tokio::time::timeout(PER_REQUEST_TIMEOUT, feature_summarize_scan(&app)).await;
    let _ = tokio::time::timeout(PER_REQUEST_TIMEOUT, feature_cleanup_plan(&app)).await;
    if app.image.exists() {
        let _ = tokio::time::timeout(PER_REQUEST_TIMEOUT, feature_describe_screenshot(&app)).await;
    } else {
        println!(
            "\n[SKIP] describe_screenshot (no image at {})",
            app.image.display()
        );
    }
    let _ = tokio::time::timeout(PER_REQUEST_TIMEOUT, feature_agentic_question(&app)).await;

    println!("\n============================================================");
    println!(
        "  All features ran in {:.1}s",
        app.started.elapsed().as_secs_f32()
    );
    println!("============================================================");
}

// ─── Feature 1: semantic_search (embedding) ──────────────────────

async fn feature_semantic_search(app: &App) {
    app.header("Feature 1: semantic_search  (capability: embedding)");

    // Mock a "scan" of 8 files spread across common categories.
    let files: Vec<(String, u64, String)> = vec![
        (
            "C:\\Users\\me\\Documents\\taxes_2024.pdf".into(),
            1_500_000,
            "pdf".into(),
        ),
        (
            "C:\\Users\\me\\Documents\\vacation_photos\\beach.jpg".into(),
            3_200_000,
            "jpg".into(),
        ),
        (
            "C:\\Users\\me\\Downloads\\installer_v3.exe".into(),
            80_000_000,
            "exe".into(),
        ),
        (
            "C:\\Users\\me\\Videos\\birthday_party.mp4".into(),
            850_000_000,
            "mp4".into(),
        ),
        (
            "C:\\Users\\me\\Documents\\mortgage_statement.pdf".into(),
            400_000,
            "pdf".into(),
        ),
        (
            "C:\\Program Files\\SomeApp\\app.exe".into(),
            220_000_000,
            "exe".into(),
        ),
        (
            "C:\\Users\\me\\Music\\song.mp3".into(),
            7_000_000,
            "mp3".into(),
        ),
        (
            "C:\\Users\\me\\Documents\\resume_2025.docx".into(),
            90_000,
            "docx".into(),
        ),
    ];

    let client = app.client("nomic-embed-text:v1.5");
    let query = "What file is most relevant to my US tax filing?".to_string();

    let out = match semantic_search(
        &client,
        "nomic-embed-text:v1.5",
        space_analyzer_pro_desktop::ollama::models::SemanticSearchInput {
            query: query.clone(),
            files: files.clone(),
            top_k: 3,
        },
    )
    .await
    {
        Ok(o) => o,
        Err(e) => {
            println!("[FAIL] {e}");
            return;
        }
    };

    println!("Query:    \"{query}\"");
    println!("Indexed:  {} files", out.files_searched);
    println!(
        "Vector:   {} dims, {} embed-call tokens used",
        out.query_dim, out.query_tokens
    );
    println!(
        "Top-{} matches ({} ms):",
        out.matches.len(),
        out.duration_ms
    );
    for (i, m) in out.matches.iter().enumerate() {
        println!(
            "  {}.  sim={:.4}  {:>8}  {}  {}",
            i + 1,
            m.similarity,
            human_bytes(m.file_size),
            m.file_extension,
            m.file_path
        );
    }
}

// ─── Feature 2: summarize_scan (completion) ─────────────────────

async fn feature_summarize_scan(app: &App) {
    app.header("Feature 2: summarize_scan  (capability: completion)");

    let input = space_analyzer_pro_desktop::ollama::models::ScanSummaryInput {
        total_files: 14_523,
        total_size_bytes: 487_000_000_000,             // ~454 GB
        potential_cleanup_bytes: Some(42_000_000_000), // ~39 GB reclaimable
        path: Some("C:\\Users\\me".to_string()),
        top_files: vec![
            space_analyzer_pro_desktop::gui_common::LargestFileEntry {
                path: "C:\\Users\\me\\Videos\\birthday_party.mp4".to_string(),
                size: 28_000_000_000,
            },
            space_analyzer_pro_desktop::gui_common::LargestFileEntry {
                path: "C:\\Users\\me\\.cache\\docker\\image.tar".to_string(),
                size: 12_500_000_000,
            },
            space_analyzer_pro_desktop::gui_common::LargestFileEntry {
                path: "C:\\Users\\me\\Downloads\\installer_v3.exe".to_string(),
                size: 1_800_000_000,
            },
            space_analyzer_pro_desktop::gui_common::LargestFileEntry {
                path: "C:\\Program Files\\SomeApp\\app.exe".to_string(),
                size: 850_000_000,
            },
            space_analyzer_pro_desktop::gui_common::LargestFileEntry {
                path: "C:\\Users\\me\\Documents\\taxes_2024.pdf".to_string(),
                size: 12_000_000,
            },
        ],
        file_types: vec![
            ("mp4".to_string(), 180_000_000_000),
            ("exe".to_string(), 24_000_000_000),
            ("pdf".to_string(), 3_200_000_000),
            ("jpg".to_string(), 1_100_000_000),
            ("tmp".to_string(), 850_000_000),
        ],
    };

    let payload_bytes = serde_json::to_string(&serde_json::json!({
        "total_files": input.total_files,
        "total_size_bytes": input.total_size_bytes,
        "potential_cleanup_bytes": input.potential_cleanup_bytes,
        "path": input.path,
        "top_files": input.top_files,
        "file_types": input.file_types,
    }))
    .unwrap()
    .len();

    println!(
        "Payload:  {payload_bytes} bytes (top-5 + 5 type buckets; the full scan is never sent)"
    );

    let client = app.client("qwen3.5:4b");
    let out = match summarize_scan(&client, "qwen3.5:4b", input).await {
        Ok(o) => o,
        Err(e) => {
            println!("[FAIL] {e}");
            return;
        }
    };

    println!(
        "Tokens:   prompt={} completion={}",
        out.prompt_tokens, out.completion_tokens
    );
    println!("Duration: {} ms", out.duration_ms);
    println!("--- summary ---");
    println!("{}", out.summary);
    if !out.key_insights.is_empty() {
        println!("--- key insights ---");
        for insight in &out.key_insights {
            println!("• {insight}");
        }
    }
    println!("--- end ---");
}

// ─── Feature 3: cleanup_plan (thinking) ──────────────────────────

async fn feature_cleanup_plan(app: &App) {
    app.header("Feature 3: cleanup_plan  (capability: thinking)");

    let input = space_analyzer_pro_desktop::ollama::models::CleanupPlanInput {
        question: "My D: drive is 95% full (1.9 TB / 2 TB). Give me a plan to free 200 GB."
            .to_string(),
        context: Some(
            "Largest folders: Users\\me\\Videos (480 GB), \
             Users\\me\\.cache (95 GB), Program Files (210 GB), \
             Windows\\Installer (62 GB). Last full scan: 3 days ago."
                .to_string(),
        ),
    };

    let client = app.client_with_timeout("qwen3.5:4b", Duration::from_secs(600));
    let out = match cleanup_plan(&client, "qwen3.5:4b", input).await {
        Ok(o) => o,
        Err(e) => {
            println!("[FAIL] {e}");
            return;
        }
    };

    println!(
        "Tokens:   prompt={} completion={}",
        out.prompt_tokens, out.completion_tokens
    );
    println!("Duration: {} ms", out.duration_ms);
    if let Some(thought) = &out.thinking {
        let preview = truncate(thought, 320);
        println!("--- model thinking ({} chars) ---", thought.len());
        println!("{preview}");
        println!("--- end thinking ---");
    } else {
        println!("(no chain-of-thought emitted)");
    }
    println!("\n--- plan ---");
    println!("{}", out.plan);
    println!("--- end ---");
}

// ─── Feature 4: describe_screenshot (vision) ────────────────────

async fn feature_describe_screenshot(app: &App) {
    app.header("Feature 4: describe_screenshot  (capability: vision)");

    let input = space_analyzer_pro_desktop::ollama::models::ScreenshotInput {
        image_path: app.image.to_string_lossy().to_string(),
        question:
            "This is a screenshot of a disk-usage analysis. Summarise the top 3 findings in 2 sentences."
                .to_string(),
        max_dim: 1024,
    };

    println!(
        "Image:    {} ({} bytes)",
        app.image.display(),
        std::fs::metadata(&app.image).map(|m| m.len()).unwrap_or(0)
    );

    let client = app.client("qwen3-vl:4b");
    let out = match describe_screenshot(&client, "qwen3-vl:4b", input).await {
        Ok(o) => o,
        Err(e) => {
            println!("[FAIL] {e}");
            return;
        }
    };

    println!(
        "Payload:  sent={} bytes (orig {} bytes), ratio {:.0}%",
        out.sent_bytes,
        out.original_bytes,
        if out.original_bytes == 0 {
            0.0
        } else {
            100.0 * out.sent_bytes as f64 / out.original_bytes as f64
        }
    );
    println!(
        "Tokens:   prompt={} completion={}",
        out.prompt_tokens, out.completion_tokens
    );
    println!("Duration: {} ms", out.duration_ms);
    println!("--- answer ---");
    println!("{}", out.answer);
    println!("--- end ---");
}

// ─── Feature 5: agentic_question (tools) ────────────────────────

async fn feature_agentic_question(app: &App) {
    app.header("Feature 5: agentic_question  (capability: tools)");

    // Build a tiny mock tool set so we can run the loop without
    // requiring a real scan. Each tool returns a short canned string.
    let tools = vec![
        ToolDefinition::new(
            "get_disk_volumes",
            "Get disk volume information. Returns text only.",
            ToolParameters::empty(),
        ),
        ToolDefinition::new(
            "get_largest_files",
            "Get the largest files. Optional 'count' parameter (default 5).",
            ToolParameters::new(
                serde_json::json!({
                    "count": { "type": "integer", "description": "How many (default 5)" }
                }),
                vec![],
            ),
        ),
        ToolDefinition::new(
            "get_file_type_breakdown",
            "Get file-type counts (e.g. '.mp4: 23, .pdf: 612').",
            ToolParameters::empty(),
        ),
    ];

    let execute: space_analyzer_pro_desktop::ollama::agentic::ToolExecutor = Box::new(
        |call: &space_analyzer_pro_desktop::ollama::ToolCall| -> String {
            match call.function.name.as_str() {
                "get_disk_volumes" => {
                    "Volumes:\n  C:  450 GB free of 1.0 TB (NTFS)\n  D:   12 GB free of 2.0 TB (NTFS)\n  E:  780 GB free of 1.5 TB (NTFS)".to_string()
                }
                "get_largest_files" => {
                    let n = call
                        .function
                        .arguments
                        .get("count")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(5) as usize;
                    let samples = [
                        "D:\\Users\\me\\Videos\\birthday_party.mp4  28.0 GB",
                        "D:\\Users\\me\\.cache\\docker\\image.tar      12.5 GB",
                        "D:\\Program Files\\SomeApp\\app.exe           850 MB",
                        "D:\\Users\\me\\Downloads\\installer_v3.exe     1.8 GB",
                        "D:\\Users\\me\\Documents\\taxes_2024.pdf       12 MB",
                    ];
                    samples
                        .iter()
                        .take(n.clamp(1, samples.len()))
                        .map(|s| s.to_string())
                        .collect::<Vec<_>>()
                        .join("\n")
                }
                "get_file_type_breakdown" => {
                    "Top types:\n  .mp4:  23  (480 GB)\n  .exe:  47  (210 GB)\n  .pdf: 612  (90 MB)\n  .jpg: 4100 (210 MB)\n  .tmp: 1240 (95 GB)".to_string()
                }
                other => format!("(mock) tool '{other}' not implemented"),
            }
        },
    );

    let question =
        "My D: drive is 95% full. Which files and file types are the biggest space hogs?";

    let client = app.client("qwen3.5:4b");

    // Debug: print the raw response for a single tool-call round so
    // we can see exactly what qwen3.5:4b returns. This runs once,
    // before the multi-round loop.
    {
        use space_analyzer_pro_desktop::ollama::types::{ChatMessage, ChatRequest, OllamaOptions};
        let req = ChatRequest {
            model: "qwen3.5:4b".to_string(),
            messages: vec![
                ChatMessage::system(
                    "You are a disk-space analyst. Use the available tools to answer. \
                     When you have enough info, reply with a short text answer.",
                ),
                ChatMessage::user(question),
            ],
            stream: Some(false),
            options: Some(OllamaOptions::default()),
            think: None,
            keep_alive: Some("2m".to_string()),
            format: None,
            tools: Some(tools.clone()),
            tool_choice: Some("auto".to_string()),
        };
        match client.post_chat_raw(&req).await {
            Ok((status, raw)) => {
                println!(
                    "[debug] HTTP {status} | raw response ({} bytes):",
                    raw.len()
                );
                // Print the entire response so we can see why parsing fails.
                println!("{raw}");
                println!("--- end raw ---");
                // Try parsing it the same way the OllamaClient does.
                match serde_json::from_str::<space_analyzer_pro_desktop::ollama::types::ChatResponse>(
                    &raw,
                ) {
                    Ok(parsed) => println!(
                        "[debug] Re-parse OK. tool_calls={:?}, content_len={}",
                        parsed.message.tool_calls.as_ref().map(|c| c.len()),
                        parsed.message.content.len()
                    ),
                    Err(e) => println!("[debug] Re-parse FAIL: {e}"),
                }
            }
            Err(e) => println!("[debug] post_chat_raw error: {e}"),
        }
    }

    let out = match agentic_question(&client, "qwen3.5:4b", question, tools, execute, 6).await {
        Ok(o) => o,
        Err(e) => {
            println!("[FAIL] {e}");
            return;
        }
    };

    println!("Question: \"{question}\"");
    println!(
        "Rounds:   {} | prompt={} completion={} | {} ms",
        out.rounds, out.total_prompt_tokens, out.total_completion_tokens, out.duration_ms
    );
    println!("--- loop ---");
    for (i, step) in out.steps.iter().enumerate() {
        print_step(i + 1, step);
    }
    println!("--- end ---");
    println!("\n--- final answer ---");
    println!("{}", out.final_answer);
    println!("--- end ---");
    // SYSTEM_PROMPT_ANALYSIS is imported to make sure the lib is
    // linked; we don't use it directly here.
    let _ = SYSTEM_PROMPT_ANALYSIS;
}

// ─── helpers ─────────────────────────────────────────────────────

fn print_step(idx: usize, step: &AgenticStep) {
    let tag = match step.kind {
        StepKind::ModelText => "model",
        StepKind::ModelToolCall => "model",
        StepKind::ToolResult => "tool ",
    };
    let dur = if step.duration_ms == 0 {
        String::new()
    } else {
        format!(" ({} ms)", step.duration_ms)
    };
    if let Some(name) = &step.tool_name {
        let args = step
            .tool_args
            .as_ref()
            .map(|v| v.to_string())
            .unwrap_or_default();
        println!("  {idx}. [{tag}]{dur} {name}({args})");
    } else {
        println!("  {idx}. [{tag}]{dur} {}", truncate(&step.text, 200));
    }
}

fn flag_value(args: &[String], name: &str) -> Option<String> {
    let eq = format!("{name}=");
    let mut iter = args.iter().skip(1);
    while let Some(a) = iter.next() {
        if a == name {
            return iter.next().cloned();
        }
        if let Some(v) = a.strip_prefix(&eq) {
            return Some(v.to_string());
        }
    }
    None
}

fn human_bytes(b: u64) -> String {
    if b == 0 {
        return "-".to_string();
    }
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = b as f64;
    let mut idx = 0;
    while size >= 1024.0 && idx < UNITS.len() - 1 {
        size /= 1024.0;
        idx += 1;
    }
    if idx == 0 {
        format!("{} {}", size as u64, UNITS[idx])
    } else {
        format!("{:.2} {}", size, UNITS[idx])
    }
}

fn truncate(s: &str, max: usize) -> String {
    let clean: String = s.chars().filter(|c| *c != '\n' && *c != '\r').collect();
    if clean.chars().count() <= max {
        clean
    } else {
        let mut out: String = clean.chars().take(max).collect();
        out.push('…');
        out
    }
}
