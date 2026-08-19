use crate::cli::helpers;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;
use space_analyzer_pro_desktop::gui_common::ScanReport;
use space_analyzer_pro_desktop::ollama::agentic::{agentic_question, ToolExecutor};
use space_analyzer_pro_desktop::ollama::client::OllamaClient;
use space_analyzer_pro_desktop::tool_registry::ToolRegistry;

pub fn run_ai_question(question: &str, result: ScanReport) -> AppResult<()> {
    ask_with_report(question, result)
}

/// Ask the local Ollama model a free-form question about a previously saved
/// scan, using read-only tool-calling (scan history, disk volumes, system
/// resources, storage trend, bloat findings, recommendations, file
/// classification). Reconstructs the scan report from the embedded database so
/// the agent can reason over real data without re-scanning the filesystem.
pub fn run_ask(question: &str, scan_id: Option<i64>) -> AppResult<()> {
    let db = Database::default_open().ok();
    let record = match &db {
        Some(db) => {
            let id_opt = match scan_id {
                Some(id) => Some(id),
                None => db.get_latest_scan_id().ok().flatten(),
            };
            match id_opt {
                Some(id) => db
                    .get_scan_by_id(id)
                    .map_err(|e| {
                        space_analyzer_pro_desktop::error::AppError::Validation(format!(
                            "Failed to load scan {id}: {e}"
                        ))
                    })?,
                None => None,
            }
        }
        None => None,
    };

    let record = record.ok_or_else(|| {
        space_analyzer_pro_desktop::error::AppError::Validation(
            scan_id
                .map(|id| format!("No scan found with id {id}"))
                .unwrap_or_else(|| "No scan history found. Run a scan first.".to_string()),
        )
    })?;

    let report = ScanReport::from_history_record(&record);

    eprintln!(
        "Asking about saved scan #{} ({})...",
        record.id, record.path
    );

    ask_with_report(question, report)
}

fn ask_with_report(question: &str, result: ScanReport) -> AppResult<()> {
    let settings = Database::default_open()
        .ok()
        .as_ref()
        .map(|db| db.load_settings())
        .unwrap_or_default();

    let rt =
        tokio::runtime::Runtime::new().expect("Failed to create async runtime for AI question");

    let probe = OllamaClient::new(&settings.ollama_url, "list-models")
        .expect("Failed to create Ollama discovery client");

    let model = rt
        .block_on(probe.list_models())
        .ok()
        .and_then(|models| {
            let local: Vec<_> = models.iter().filter(|m| m.remote_host.is_none()).collect();
            if let Some(m) = local
                .iter()
                .find(|m| m.capabilities.iter().any(|c| c == "tools"))
            {
                return Some(m.name.clone());
            }
            if let Some(m) = local
                .iter()
                .find(|m| m.capabilities.iter().any(|c| c == "completion"))
            {
                return Some(m.name.clone());
            }
            local.first().map(|m| m.name.clone())
        })
        .unwrap_or_else(|| {
            eprintln!(
                "Warning: no Ollama models discovered at {}, falling back to '{}'",
                settings.ollama_url, settings.ollama_model
            );
            settings.ollama_model.clone()
        });

    let registry = ToolRegistry::new(Some(result.clone()));
    let tools = registry.get_definitions().to_vec();

    let executor: ToolExecutor = Box::new(move |call| {
        let local_db = Database::default_open().ok();
        let r = registry.execute_tool(call, Some(&result), local_db.as_ref());
        r.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string())
    });

    let chat_client = probe
        .with_model(&model)
        .expect("Failed to create Ollama client with selected model")
        .with_cache(settings.to_prompt_cache_config());
    match rt.block_on(agentic_question(
        &chat_client,
        &model,
        question,
        tools,
        executor,
        5,
    )) {
        Ok(output) => {
            println!("{}", output.final_answer);
            Ok(())
        }
        Err(e) => Err(space_analyzer_pro_desktop::error::AppError::Validation(
            format!("AI question failed: {e}"),
        )),
    }
}

pub fn handle_disk_info(path: Option<String>) -> AppResult<()> {
    let disks = match &path {
        Some(p) => {
            let resolved = helpers::resolve_scan_path(p).ok();
            let target = resolved.as_deref().map(helpers::display_path);
            match target {
                Some(t) => helpers::get_disk_info(&t).into_iter().collect::<Vec<_>>(),
                None => Vec::new(),
            }
        }
        None => helpers::get_all_disks(),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&disks).unwrap_or_default()
    );
    Ok(())
}
