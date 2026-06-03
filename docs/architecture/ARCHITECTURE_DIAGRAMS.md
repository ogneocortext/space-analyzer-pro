# Architecture Diagrams

> Auto-generated from the codebase — update when the architecture changes.

## 1. Workspace Crate Dependency Graph

```mermaid
graph TB
    subgraph workspace["Workspace Crates"]
        root["space-analyzer-pro-desktop<br/>v3.2.0"]
        ss["shared-scanner<br/>lib (rlib)"]
        gc["gpu-compute<br/>lib (rlib)"]
        fd["file-deduplicator<br/>bin + lib (cdylib)"]
        nm["node_modules_cleaner<br/>bin"]
        ns["native/scanner (space-analyzer)<br/>bin + lib (cdylib)"]
    end

    subgraph excluded["Excluded from Workspace"]
        sp["storage-predictor<br/>bin + lib (cdylib)"]
        am["archive-manager<br/>bin + lib (cdylib)"]
        fm["file-monitor<br/>bin + lib (cdylib)"]
    end

    subgraph tools["Extra Tools"]
        ds["design-screenshot<br/>bin"]
    end

    subgraph python["Python AI Services"]
        ai_svc["ai-service/<br/>FastAPI + ML"]
        py_ai["server/python-ai-service/<br/>Flask + Ollama"]
    end

    root --> ss
    root --> gc
    root --> fd
    ss --> gc
    fd --> gc
    sp --> gc

    style root fill:#1a5276,color:#fff,stroke:#2e86c1
    style gc fill:#7d3c98,color:#fff,stroke:#af7ac5
    style ss fill:#1e8449,color:#fff,stroke:#58d68d
    style fd fill:#b03a2e,color:#fff,stroke:#e74c3c
    style nm fill:#6c3483,color:#fff,stroke:#af7ac5
    style ns fill:#d4ac0d,color:#000,stroke:#f4d03f
```

## 2. Binary Targets

```mermaid
graph LR
    subgraph bins["Rust Binary Targets"]
        gui["space-analyzer-gui<br/>src/gui/mod.rs"]
        cli["space-analyzer-pro<br/>src/main.rs"]
        scanner["native/scanner<br/>space-analyzer"]
        dedup["file-deduplicator"]
        nm2["node_modules_cleaner"]
        sp2["storage-predictor"]
        am2["archive-manager"]
        fm2["file-monitor"]
    end

    gui -->|"eframe + egui 0.34"| desktop["Desktop GUI App"]
    cli -->|"clap CLI"| terminal["Terminal Scanner"]
    scanner -->|"NAPI bindings"| node["Node.js Addon"]
    dedup -->|"cdylib"| napi_dedup["NAPI Addon"]

    style gui fill:#1a5276,color:#fff
    style cli fill:#2e86c1,color:#fff
```

## 3. GUI Module Hierarchy

```mermaid
graph TB
    subgraph level0["Crate Root — src/gui/mod.rs"]
        main["fn main()<br/>eframe::run_native"]
        app["SpaceAnalyzerApp<br/>struct + impl Default + impl App"]
        icons["mod icons<br/>(inline)"]
    end

    subgraph level1["Sibling Modules (use super::*)"]
        scan["mod scan<br/>start_scan, render_scan"]
        dashboard["mod dashboard<br/>dashboard UI + trend chart"]
        history["mod history<br/>history list UI"]
        settings["mod settings<br/>settings UI + save"]
        system["mod system<br/>system info UI"]
        workflow_render["mod workflow_render<br/>workflow editor + actions"]
        embeddings["mod embeddings<br/>smart search UI + indexing"]
        dedup["mod dedup<br/>dedup UI + SimpleDeduplicator"]
    end

    subgraph level2["AI Sub-modules (use super::super::*)"]
        ai_mod["ai/mod.rs"]
        chat["ai/chat.rs<br/>send_chat, process_ollama"]
        rendering["ai/rendering.rs<br/>chat bubble UI"]
        quick_actions["ai/quick_actions.rs<br/>quick action buttons"]
        model_discovery["ai/model_discovery.rs<br/>model listing + selection"]
        ollama_mgmt["ai/ollama.rs<br/>process management"]
    end

    subgraph external["External Modules (crate-level)"]
        database["database/mod.rs<br/>Database, AppSettings"]
        ollama["ollama/mod.rs<br/>OllamaClient, PromptCache"]
        tool_registry["tool_registry/mod.rs<br/>ToolRegistry"]
        workflows["workflows/mod.rs<br/>Workflow, WorkflowAction"]
        embedding_service["embedding_service.rs<br/>embed_files, search_files"]
        gui_common["gui_common.rs<br/>ScanResult, formatting"]
        system_monitor["system_monitor.rs<br/>DiskVolume, GpuInfo"]
        session_logger["session_logger.rs<br/>SessionLogger"]
        utils["utils.rs<br/>sanitize_error_message"]
    end

    app --> dashboard
    app --> scan
    app --> history
    app --> embeddings
    app --> dedup
    app --> workflow_render
    app --> system
    app --> settings
    app --> ai_mod
    app -.-> database
    app -.-> ollama
    app -.-> tool_registry
    app -.-> workflows
    app -.-> embedding_service
    app -.-> gui_common
    app -.-> system_monitor
    app -.-> session_logger
    app -.-> utils

    ai_mod --> chat
    ai_mod --> rendering
    ai_mod --> quick_actions
    ai_mod --> model_discovery
    ai_mod --> ollama_mgmt

    style level0 fill:#1a5276,color:#fff
    style level1 fill:#2e86c1,color:#fff
    style level2 fill:#7d3c98,color:#fff,stroke:#af7ac5
    style external fill:#1e8449,color:#fff,stroke:#58d68d
```

## 4. Ollama Module Tree

```mermaid
graph TB
    subgraph ollama["src/ollama/"]
        mod_rs["mod.rs<br/>re-exports"]
        error["error.rs<br/>OllamaError"]
        types["types.rs<br/>ChatMessage, ToolCall,<br/>ToolDefinition, PromptCacheConfig"]
        prompts["prompts.rs<br/>SYSTEM_PROMPT_ANALYSIS,<br/>SYSTEM_PROMPT_TOOLS"]
        stream["stream.rs<br/>StreamChunk parser"]
        json_utils["json_utils.rs<br/>JSON repair + validation"]
        prompt_cache["prompt_cache.rs<br/>LRU cache, ModelTokenBudget"]
    end

    subgraph client["client/mod.rs"]
        client_mod["OllamaClient + Builder<br/>with_model, chat_with_tools"]
        chat["chat.rs<br/>chat_internal, chat_json<br/>post_chat_and_parse"]
        embeddings["embeddings.rs<br/>embed() method"]
    end

    mod_rs --> error
    mod_rs --> types
    mod_rs --> prompts
    mod_rs --> stream
    mod_rs --> json_utils
    mod_rs --> prompt_cache
    mod_rs --> client

    client --> client_mod
    client --> chat
    client --> embeddings

    style ollama fill:#7d3c98,color:#fff,stroke:#af7ac5
    style client fill:#6c3483,color:#fff,stroke:#af7ac5
```

## 5. Database Schema

```mermaid
erDiagram
    scan_history {
        int id PK "AUTOINCREMENT"
        text path "scan root directory"
        int total_files
        int total_size_bytes
        real total_size_mb
        real duration_secs
        text file_types_json "JSON HashMap<String, u64>"
        text largest_files_json "JSON Vec<(String, u64)>"
        bool deep_scan
        text timestamp "RFC3339"
    }

    settings {
        text key PK
        text value
    }

    file_embeddings {
        int id PK "AUTOINCREMENT"
        int scan_id FK "-> scan_history.id"
        text file_path
        int file_size
        text file_extension
        text embedding_json "JSON Vec<f32>"
        text created_at "RFC3339"
    }

    scan_history ||--o{ file_embeddings : "has"
```

## 6. Scan Data Flow

```mermaid
sequenceDiagram
    participant User as User
    participant GUI as GUI Thread
    participant Scanner as Scan Thread
    participant DB as SQLite
    participant Ollama as Ollama API

    User->>GUI: Click "Scan"
    GUI->>GUI: start_scan()
    GUI->>Scanner: thread::spawn

    Scanner->>Scanner: FileScanner::scan_with_progress_sync()
    loop Every 50 entries
        Scanner-->>GUI: ScanMessage::Progress
        GUI->>GUI: update progress bar + performance tracker
    end

    Scanner->>Scanner: Phase 2: GpuScanProcessor
    Scanner->>Scanner: with_gpu(settings.gpu_acceleration && GPU available)
    Scanner->>Scanner: process() -> GpuScanResult

    Scanner-->>GUI: ScanMessage::Complete(ScanResult)

    GUI->>DB: save_scan(&result, deep_scan)
    GUI->>GUI: tool_registry = ToolRegistry::new(Some(result))
    GUI->>GUI: generate_ai_recommendations()

    alt embedding_enabled
        GUI->>GUI: start_embedding_index()
        GUI->>Ollama: embed_files(descriptions)
        GUI->>DB: save_embeddings(scan_id, embeddings)
    end

    GUI-->>User: Show results + notification
```

## 7. AI Chat & Tool Calling Flow

```mermaid
sequenceDiagram
    participant User as User
    participant GUI as GUI Thread
    participant Ollama as Ollama Server
    participant Registry as ToolRegistry

    User->>GUI: Type message + Enter

    alt auto_model_selection enabled
        GUI->>GUI: classify_task() -> "Analysis"
        GUI->>GUI: select_model_for_task(task_type)
    end

    GUI->>GUI: Build scan context from current ScanResult
    GUI->>GUI: Check PromptCache

    alt Cache Hit
        GUI-->>User: Return cached response
    else Cache Miss
        GUI->>Ollama: chat_with_tools(conversation, tools, tool_choice)
        activate Ollama

        loop Up to 5 tool call rounds
            Ollama-->>GUI: OllamaMessage::ToolCall(name, args)
            deactivate Ollama

            GUI->>Registry: execute_tool(&tool_call, scan_result, db)
            Registry-->>GUI: Formatted string result

            GUI->>GUI: Push tool result to conversation_history
            GUI->>Ollama: send_follow_up_with_tools(conversation)

            alt No more tool calls
                Ollama-->>GUI: OllamaMessage::ChatReply(content)
                GUI->>GUI: Push assistant response to chat_messages
                GUI->>GUI: OllamaMessage::CacheStore
            end
        end

        GUI-->>User: Show assistant reply + token usage
    end
```

## 8. Settings Architecture

```mermaid
flowchart LR
    subgraph struct["AppSettings (25 fields)"]
        scan_st["Scan: default_scan_path,<br/>default_deep_scan,<br/>max_scan_depth,<br/>large_file_threshold_mb"]
        gpu_st["GPU: gpu_acceleration,<br/>cuda_enabled,<br/>dedup_use_gpu"]
        ai_st["AI: ollama_enabled, ollama_url,<br/>ollama_model, agentic_tools_enabled,<br/>tool_calling_model, tool_choice,<br/>auto_start_ollama"]
        pc_st["Cache: prompt_cache_enabled,<br/>prompt_cache_max_entries,<br/>prompt_cache_ttl_seconds,<br/>prompt_cache_max_memory_mb"]
        emb_st["Embed: embedding_enabled,<br/>embedding_model,<br/>embedding_batch_size,<br/>embedding_file_limit"]
        misc_st["Misc: auto_model_selection,<br/>ai_recommendation_enabled,<br/>log_session_to_file,<br/>log_file_path"]
    end

    subgraph storage["Persistence"]
        sqlite["SQLite settings table<br/>key-value text pairs"]
    end

    subgraph consumers["Runtime Consumers"]
        scanner["shared-scanner<br/>GpuScanProcessor"]
        ollama_cli["OllamaClient<br/>url, model"]
        chat["Chat: tool_choice,<br/>agentic_tools_enabled,<br/>auto_model_selection"]
        dedup_consumer["Deduplication<br/>dedup_use_gpu"]
        ai_recs["Recommendations<br/>ai_recommendation_enabled"]
        embedding["Embedding Index<br/>batch_size, file_limit"]
        prompt_cache["PromptCache<br/>update_config()"]
        session_logger["SessionLogger<br/>log_path, enabled"]
    end

    subgraph env["Env Override"]
        ollama_host["OLLAMA_HOST<br/>env var"]
    end

    struct -->|"Default::default()<br/>+ DB overrides"| storage
    struct -->|"UI widgets<br/>mutate in-place"| ui["Settings Tab UI<br/>6 sections"]
    storage -->|"load_settings()"| struct
    ollama_host -->|"overwrites"| struct

    struct -->|"to_prompt_cache_config()"| prompt_cache
    struct -->|"save_settings()"| session_logger
    struct -->|"ScanOptions"| scanner
    struct -->|"OllamaClient::new()"| ollama_cli
    struct -->|"direct reads"| chat
    struct -->|"direct reads"| dedup_consumer
    struct -->|"direct reads"| ai_recs
    struct -->|"direct reads"| embedding
    struct -->|"direct reads"| ui

    style struct fill:#1a5276,color:#fff
    style storage fill:#7d3c98,color:#fff
    style consumers fill:#1e8449,color:#fff
    style env fill:#b03a2e,color:#fff
    style ui fill:#2e86c1,color:#fff
```

## 9. App Event Loop (per frame)

```mermaid
stateDiagram-v2
    [*] --> ProcessAsyncMessages

    ProcessAsyncMessages --> ProcessAsyncMessages: process_scan_messages
    ProcessAsyncMessages --> ProcessAsyncMessages: process_ollama_messages
    ProcessAsyncMessages --> ProcessAsyncMessages: process_embedding_messages
    ProcessAsyncMessages --> ProcessAsyncMessages: process_search_messages
    ProcessAsyncMessages --> ProcessAsyncMessages: process_dedup_messages
    ProcessAsyncMessages --> ProcessAsyncMessages: process_ai_recommendations
    ProcessAsyncMessages --> ProcessAsyncMessages: process_scheduled_workflows
    ProcessAsyncMessages --> ProcessAsyncMessages: process_model_discovery

    ProcessAsyncMessages --> FrameBookkeeping

    FrameBookkeeping --> FrameBookkeeping: frame_counter++
    FrameBookkeeping --> FrameBookkeeping: update_model_resource_usage (every 60 frames)
    FrameBookkeeping --> FrameBookkeeping: clean_expired_notifications
    FrameBookkeeping --> FrameBookkeeping: keyboard shortcuts (F5, Ctrl+S)
    FrameBookkeeping --> FrameBookkeeping: request_repaint if background work active

    FrameBookkeeping --> RenderUI

    RenderUI --> RenderUI: Top bar (title + tabs)
    RenderUI --> RenderUI: Status bar
    RenderUI --> RenderUI: Tab content dispatch
    RenderUI --> RenderUI: Toast notifications

    RenderUI --> [*]
```

## 10. Workflow System

```mermaid
graph TB
    subgraph triggers["Trigger Types"]
        manual["Manual"]
        cron["Scheduled (Cron)"]
        low_disk["LowDiskSpace"]
        on_startup["OnStartup"]
        fsch["FileSystemChange"]
    end

    subgraph actions["Action Types"]
        a_scan["Scan {path, deep, min_size}"]
        a_dedup["FindDuplicates {paths, use_gpu}"]
        a_predict["PredictStorage {days}"]
        a_recommend["GenerateRecommendations"]
        a_export["Export {format, path}"]
        a_notify["Notify {message, level}"]
        a_ai["AIAnalyze {prompt}"]
    end

    subgraph templates["Built-in Templates (7)"]
        t1["Weekly Cleanup"]
        t2["Large File Report"]
        t3["Disk Space Monitor"]
        t4["Dev Dirs Cleanup"]
        t5["Archive Analysis"]
        t6["Startup Scan"]
        t7["AI Analysis"]
    end

    triggers --> workflow["Workflow"]
    actions --> workflow
    workflow --> execution["WorkflowExecution<br/>(status tracking)"]
    execution -->|"execute"| dispatch["Action Dispatcher"]

    dispatch -->|"Scan"| scan_run["start_scan()"]
    dispatch -->|"FindDuplicates"| dedup_run["start_deduplication()"]
    dispatch -->|"AIAnalyze"| ai_run["send_chat_message()"]

    subgraph persistence["Persistence"]
        execution_history["Execution History<br/>(SQLite workflow_executions table)"]
        workflow_import["Import/Export<br/>(JSON file)"]
    end

    execution --> execution_history

    style triggers fill:#d4ac0d,color:#000
    style actions fill:#2e86c1,color:#fff
    style templates fill:#1e8449,color:#fff
    style dispatch fill:#7d3c98,color:#fff
    style persistence fill:#b03a2e,color:#fff
```

## 11. GPU Compute Architecture

```mermaid
graph TB
    subgraph gpu_compute["gpu-compute crate"]
        device["device.rs<br/>GpuInfo::detect()<br/>nvidia-smi or cudarc"]
        scan["scan.rs<br/>GpuScanProcessor<br/>process() → GpuScanResult"]
        hash["hash.rs<br/>BatchHasher<br/>hash_files() → Vec<HashResult>"]
        ml["ml.rs<br/>GpuAcceleratedML<br/>linear_regression, kmeans"]
    end

    subgraph consumers["GPU Consumers"]
        ss["shared-scanner<br/>GpuScanProcessor<br/>with_gpu(s.gpu_acceleration && available)"]
        fd["file-deduplicator<br/>BatchHasher<br/>with_gpu(use_gpu)"]
        gui_dedup["SpaceAnalyzerApp<br/>SimpleDeduplicator<br/>→ BatchHasher"]
        sp["storage-predictor<br/>GpuScanProcessor"]
        gui["src/system_monitor.rs<br/>GpuInfo (separate impl)"]
    end

    subgraph flow["GPU Decision Flow"]
        setting["User Setting<br/>gpu_acceleration: bool"]
        detect["GPU Available?<br/>nvidia-smi / cudarc"]
        decision{"setting && available?"}
        cpu_path["CPU Fallback<br/>(rayon parallel)"]
        gpu_path["GPU Path<br/>(CUDA kernels)"]
    end

    device -->|"GpuInfo"| scan
    device -->|"GpuInfo"| hash
    device -->|"GpuInfo"| ml

    ss --> scan
    fd --> hash
    gui_dedup --> hash
    sp --> scan

    setting --> decision
    detect --> decision
    decision -->|yes| gpu_path
    decision -->|no| cpu_path
    gpu_path -.->|"stub (CPU fallback)"| cpu_path

    style gpu_compute fill:#7d3c98,color:#fff,stroke:#af7ac5
    style consumers fill:#1a5276,color:#fff,stroke:#2e86c1
    style flow fill:#1e8449,color:#fff,stroke:#58d68d
    style cpu_path fill:#6c3483,color:#fff
    style gpu_path fill:#b03a2e,color:#fff
```

## 12. Key Struct Relationships

```mermaid
classDiagram
    class SpaceAnalyzerApp {
        +AppTab active_tab
        +PathBuf current_path
        +Option~ScanResult~ scan_result
        +AppSettings settings
        +Vec~ChatMessage~ chat_messages
        +Vec~OllamaChatMessage~ conversation_history
        +Option~OllamaClient~ ollama_client
        +Option~Database~ db
        +Option~ToolRegistry~ tool_registry
        +PromptCache prompt_cache
        +Vec~Workflow~ workflows
        +Vec~Notification~ notifications
        +SessionLogger session_logger
        +Vec~OllamaModelInfo~ discovered_models
        +String ai_recommendation_source
        +bool ai_recommendation_pending
        +Vec~SearchResult~ search_results
        +Vec~(String,u64,String,Vec~f32~)~ cached_embeddings
        +ScanPerformanceTracker scan_performance
    }

    class AppSettings {
        +String default_scan_path
        +bool default_deep_scan
        +u32 max_scan_depth
        +u64 large_file_threshold_mb
        +bool gpu_acceleration
        +bool cuda_enabled
        +bool dedup_use_gpu
        +bool ollama_enabled
        +String ollama_url
        +String ollama_model
        +bool agentic_tools_enabled
        +String tool_calling_model
        +String tool_choice
        +bool auto_start_ollama
        +bool prompt_cache_enabled
        +usize prompt_cache_max_entries
        +u64 prompt_cache_ttl_seconds
        +usize prompt_cache_max_memory_mb
        +bool embedding_enabled
        +String embedding_model
        +usize embedding_batch_size
        +usize embedding_file_limit
        +bool auto_model_selection
        +bool ai_recommendation_enabled
        +bool log_session_to_file
        +String log_file_path
    }

    class ScanResult {
        +u64 total_files
        +u64 total_size_bytes
        +f64 total_size_mb
        +f64 duration_secs
        +HashMap~String,u64~ file_types
        +Vec~(String,u64)~ largest_files
        +String path
    }

    class Database {
        +Connection conn
        +load_settings() AppSettings
        +save_all_settings()
        +save_scan()
        +get_scan_history()
        +save_embeddings()
        +save_workflow_execution()
        +get_workflow_history()
    }

    class OllamaClient {
        -String base_url
        -String model
        +chat_with_tools()
        +embed()
        +with_model()
    }

    class ChatMessage {
        +String role
        +String content
        +Option~ToolResultDisplay~ tool_result
    }

    class Workflow {
        +String id
        +String name
        +String description
        +WorkflowTrigger trigger
        +Vec~WorkflowAction~ actions
        +bool enabled
    }

    SpaceAnalyzerApp *-- AppSettings : settings
    SpaceAnalyzerApp o-- ChatMessage : chat_messages
    SpaceAnalyzerApp o-- Workflow : workflows
    SpaceAnalyzerApp o-- Database : db
    SpaceAnalyzerApp o-- OllamaClient : ollama_client
    SpaceAnalyzerApp o-- ScanResult : scan_result
    SpaceAnalyzerApp o-- ToolRegistry : tool_registry
    SpaceAnalyzerApp o-- PromptCache : prompt_cache

## 13. AI Recommendations Flow

```mermaid
flowchart TD
    trigger["Trigger: scan complete<br/>or GenerateRecommendations action"] --> dispatch{generate_ai_recommendations}

    dispatch --> check{"ai_recommendation_enabled<br/>&& ollama_available<br/>&& scan_result exists?"}

    check -->|no| heuristic["generate_storage_recommendations()<br/>StorageInsights::generate_recommendations<br/>(heuristic rules, instant)"]
    heuristic --> display["Store in ai_recommendations<br/>source = 'heuristic'"]

    check -->|yes| start["start_ai_recommendation()"]
    start --> pending["Set ai_recommendation_pending = true<br/>source = 'ai'"]
    pending --> thread["Spawn background thread"]
    thread --> async_fn["generate_ai_recommendations_async()"]

    async_fn --> build["Build system prompt + user prompt<br/>with scan file types + largest files"]
    build --> ollama["OllamaClient::chat_with_tools<br/>(prompts, no tools, tool_choice='none')"]

    ollama --> parse{"Parse response<br/>as Vec&lt;AIRecommendation&gt;"}
    parse -->|success| send_ai["Send (recs, is_ai=true)"]
    parse -->|fail| try_extract["try_extract_recommendations()"]
    try_extract -->|wrapped format| send_ai
    try_extract -->|fail| fallback["StorageInsights::generate_recommendations()"]
    fallback --> send_fallback["Send (recs, is_ai=false)"]
    ollama -->|error| fallback

    send_ai --> process["process_ai_recommendations()<br/>(update loop)"]
    send_fallback --> process
    process --> set_recs["Set ai_recommendations,<br/>ai_recommendation_source,<br/>ai_recommendation_pending = false"]

    set_recs --> display

    style trigger fill:#2e86c1,color:#fff
    style check fill:#d4ac0d,color:#000
    style heuristic fill:#1e8449,color:#fff
    style async_fn fill:#7d3c98,color:#fff
    style ollama fill:#7d3c98,color:#fff
    style fallback fill:#6c3483,color:#fff
    style display fill:#1a5276,color:#fff
```

## 14. Conversation History Trimming

```mermaid
flowchart TD
    send["send_chat_message() or<br/>send_follow_up_with_tools()"] --> trim["trim_conversation_history()"]
    trim --> empty{"conversation_history<br/>empty?"}
    empty -->|yes| return["Return (no-op)"]

    empty -->|no| budget{"Total chars &gt;<br/>MAX_CONVERSATION_CHARS (8000)?"}
    budget -->|no| return

    budget -->|yes| prune["Preserve system prompt (index 0)"]
    prune --> loop{"Remaining chars &gt;<br/>budget && history<br/>length &gt; 1?"}
    loop -->|yes| remove["Remove oldest message<br/>(index 0 after system)"]
    remove --> loop
    loop -->|no| prepend["Re-insert system prompt at front"]
    prepend --> clone["Clone conversation for<br/>background API thread"]

    style trim fill:#1a5276,color:#fff
    style prune fill:#2e86c1,color:#fff
    style remove fill:#b03a2e,color:#fff
    style clone fill:#1e8449,color:#fff
```
