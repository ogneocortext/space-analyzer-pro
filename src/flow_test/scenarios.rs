//! Predefined test scenarios for Space Analyzer Pro

use crate::flow_test::{TestScenario, TestStep};
use crate::hashmap;

/// Create all available test scenarios
pub fn all_scenarios() -> Vec<TestScenario> {
    vec![
        basic_scan_scenario(),
        deep_scan_scenario(),
        settings_flow_scenario(),
        history_flow_scenario(),
        smart_search_flow_scenario(),
        workflow_execution_scenario(),
        ai_chat_flow_scenario(),
        system_info_flow_scenario(),
        gpu_status_flow_scenario(),
        ollama_status_flow_scenario(),
        multi_directory_scan_scenario(),
        error_recovery_flow_scenario(),
    ]
}

/// Basic scan scenario - read-only directory scan
fn basic_scan_scenario() -> TestScenario {
    TestScenario {
        name: "basic_scan".to_string(),
        description: "Perform a basic read-only scan of a directory and verify results are displayed correctly".to_string(),
        steps: vec![
            TestStep {
                action: "Start basic scan".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "scan_type".to_string() => "basic".to_string(),
                    "depth".to_string() => "3".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Monitor scan progress".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "check_interval_ms".to_string() => "500".to_string(),
                },
                timeout_ms: 60000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify scan results".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "validate_file_types".to_string() => "true".to_string(),
                    "validate_size_distribution".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Check UI rendering of results".to_string(),
                component: "ui".to_string(),
                parameters: hashmap!{
                    "tab".to_string() => "scan".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Scan completes without errors".to_string(),
            "File type distribution is displayed".to_string(),
            "Largest files are listed".to_string(),
            "Total size is accurate".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Deep scan scenario - thorough directory traversal
fn deep_scan_scenario() -> TestScenario {
    TestScenario {
        name: "deep_scan".to_string(),
        description: "Perform a deep scan with maximum depth and verify comprehensive results".to_string(),
        steps: vec![
            TestStep {
                action: "Start deep scan".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "scan_type".to_string() => "deep".to_string(),
                    "depth".to_string() => "10".to_string(),
                },
                timeout_ms: 60000,
                is_read_only: true,
            },
            TestStep {
                action: "Monitor deep scan progress".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "check_interval_ms".to_string() => "1000".to_string(),
                },
                timeout_ms: 120000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify deep scan results".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "validate_empty_dirs".to_string() => "true".to_string(),
                    "validate_hidden_files".to_string() => "true".to_string(),
                },
                timeout_ms: 10000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Deep scan completes without errors".to_string(),
            "Empty directories are detected".to_string(),
            "Hidden files are included".to_string(),
            "Deep file hierarchy is traversed".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Settings flow scenario - load, modify, save settings
fn settings_flow_scenario() -> TestScenario {
    TestScenario {
        name: "settings_flow".to_string(),
        description: "Test loading, modifying, and saving application settings".to_string(),
        steps: vec![
            TestStep {
                action: "Load current settings".to_string(),
                component: "settings".to_string(),
                parameters: hashmap!{},
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify default settings".to_string(),
                component: "settings".to_string(),
                parameters: hashmap!{
                    "check_ollama_enabled".to_string() => "false".to_string(),
                    "check_gpu_acceleration".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Modify non-destructive settings".to_string(),
                component: "settings".to_string(),
                parameters: hashmap!{
                    "max_scan_depth".to_string() => "7".to_string(),
                    "large_file_threshold_mb".to_string() => "50".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Save settings".to_string(),
                component: "settings".to_string(),
                parameters: hashmap!{},
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Reload and verify settings".to_string(),
                component: "settings".to_string(),
                parameters: hashmap!{
                    "verify_max_scan_depth".to_string() => "7".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Settings load without errors".to_string(),
            "Default values are correct".to_string(),
            "Settings save successfully".to_string(),
            "Reloaded settings match saved values".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// History flow scenario - load and drill down into scan history
fn history_flow_scenario() -> TestScenario {
    TestScenario {
        name: "history_flow".to_string(),
        description: "Test loading scan history and drilling down into past scan details".to_string(),
        steps: vec![
            TestStep {
                action: "Load scan history".to_string(),
                component: "history".to_string(),
                parameters: hashmap!{
                    "limit".to_string() => "50".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify history list".to_string(),
                component: "history".to_string(),
                parameters: hashmap!{
                    "check_dates".to_string() => "true".to_string(),
                    "check_sizes".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Drill down into first history item".to_string(),
                component: "history".to_string(),
                parameters: hashmap!{
                    "show_file_types".to_string() => "true".to_string(),
                    "show_largest_files".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "History loads without errors".to_string(),
            "History items show correct metadata".to_string(),
            "Drill-down shows file type breakdown".to_string(),
            "Largest files are displayed in drill-down".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Smart search flow scenario - test semantic search functionality
fn smart_search_flow_scenario() -> TestScenario {
    TestScenario {
        name: "smart_search_flow".to_string(),
        description: "Test semantic search with various queries".to_string(),
        steps: vec![
            TestStep {
                action: "Check embedding status".to_string(),
                component: "smart_search".to_string(),
                parameters: hashmap!{
                    "check_indexed".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Execute semantic search query".to_string(),
                component: "smart_search".to_string(),
                parameters: hashmap!{
                    "query".to_string() => "large files".to_string(),
                },
                timeout_ms: 10000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify search results".to_string(),
                component: "smart_search".to_string(),
                parameters: hashmap!{
                    "check_relevance".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Embedding status is reported".to_string(),
            "Search returns relevant results".to_string(),
            "Results include similarity scores".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Workflow execution scenario - test workflow triggers
fn workflow_execution_scenario() -> TestScenario {
    TestScenario {
        name: "workflow_execution".to_string(),
        description: "Test triggering and executing workflows (read-only actions only)".to_string(),
        steps: vec![
            TestStep {
                action: "List available workflows".to_string(),
                component: "workflows".to_string(),
                parameters: hashmap!{},
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Trigger read-only workflow".to_string(),
                component: "workflows".to_string(),
                parameters: hashmap!{
                    "workflow_name".to_string() => "Large Files Finder".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Monitor workflow progress".to_string(),
                component: "workflows".to_string(),
                parameters: hashmap!{
                    "check_interval_ms".to_string() => "1000".to_string(),
                },
                timeout_ms: 60000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify workflow results".to_string(),
                component: "workflows".to_string(),
                parameters: hashmap!{
                    "check_completion".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Workflows are listed correctly".to_string(),
            "Read-only workflow executes without errors".to_string(),
            "Workflow progress is reported".to_string(),
            "Workflow completes successfully".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// AI chat flow scenario - test Ollama integration
fn ai_chat_flow_scenario() -> TestScenario {
    TestScenario {
        name: "ai_chat_flow".to_string(),
        description: "Test AI chat functionality with Ollama".to_string(),
        steps: vec![
            TestStep {
                action: "Check Ollama availability".to_string(),
                component: "ai_chat".to_string(),
                parameters: hashmap!{},
                timeout_ms: 10000,
                is_read_only: true,
            },
            TestStep {
                action: "Send test query to AI".to_string(),
                component: "ai_chat".to_string(),
                parameters: hashmap!{
                    "query".to_string() => "What is the largest file type in the scan?".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify AI response".to_string(),
                component: "ai_chat".to_string(),
                parameters: hashmap!{
                    "check_response_format".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Ollama availability is checked".to_string(),
            "AI responds to queries".to_string(),
            "Response is properly formatted".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// System info flow scenario - test system monitoring
fn system_info_flow_scenario() -> TestScenario {
    TestScenario {
        name: "system_info_flow".to_string(),
        description: "Test system information display and monitoring".to_string(),
        steps: vec![
            TestStep {
                action: "Refresh system info".to_string(),
                component: "system".to_string(),
                parameters: hashmap!{},
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify disk volumes".to_string(),
                component: "system".to_string(),
                parameters: hashmap!{
                    "check_volumes".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify CPU and memory stats".to_string(),
                component: "system".to_string(),
                parameters: hashmap!{
                    "check_cpu".to_string() => "true".to_string(),
                    "check_memory".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "System info refreshes without errors".to_string(),
            "Disk volumes are listed".to_string(),
            "CPU and memory stats are displayed".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// GPU status flow scenario - test GPU detection and status
fn gpu_status_flow_scenario() -> TestScenario {
    TestScenario {
        name: "gpu_status_flow".to_string(),
        description: "Test GPU detection and status reporting".to_string(),
        steps: vec![
            TestStep {
                action: "Detect GPU".to_string(),
                component: "gpu".to_string(),
                parameters: hashmap!{},
                timeout_ms: 10000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify GPU info".to_string(),
                component: "gpu".to_string(),
                parameters: hashmap!{
                    "check_name".to_string() => "true".to_string(),
                    "check_vram".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Check GPU acceleration status".to_string(),
                component: "gpu".to_string(),
                parameters: hashmap!{
                    "check_acceleration".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "GPU is detected (or fallback reported)".to_string(),
            "GPU info is displayed correctly".to_string(),
            "Acceleration status is reported".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Ollama status flow scenario - test Ollama model discovery
fn ollama_status_flow_scenario() -> TestScenario {
    TestScenario {
        name: "ollama_status_flow".to_string(),
        description: "Test Ollama model discovery and capability detection".to_string(),
        steps: vec![
            TestStep {
                action: "Check Ollama availability".to_string(),
                component: "ollama".to_string(),
                parameters: hashmap!{},
                timeout_ms: 10000,
                is_read_only: true,
            },
            TestStep {
                action: "List available models".to_string(),
                component: "ollama".to_string(),
                parameters: hashmap!{},
                timeout_ms: 10000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify model capabilities".to_string(),
                component: "ollama".to_string(),
                parameters: hashmap!{
                    "check_tool_calling".to_string() => "true".to_string(),
                    "check_embedding".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Ollama availability is checked".to_string(),
            "Available models are listed".to_string(),
            "Model capabilities are identified".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Multi-directory scan scenario - test scanning different directory types
fn multi_directory_scan_scenario() -> TestScenario {
    TestScenario {
        name: "multi_directory_scan".to_string(),
        description: "Test scanning multiple different directory types to verify UI presentation".to_string(),
        steps: vec![
            TestStep {
                action: "Scan source directory".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "path".to_string() => "src".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Scan tests directory".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "path".to_string() => "tests".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Scan docs directory".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "path".to_string() => "docs".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Compare scan results".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "compare_file_types".to_string() => "true".to_string(),
                    "compare_sizes".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "All directories scan successfully".to_string(),
            "File type distributions differ appropriately".to_string(),
            "Size calculations are accurate".to_string(),
            "UI presents results clearly for each directory".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}

/// Error recovery flow scenario - test error handling and recovery
fn error_recovery_flow_scenario() -> TestScenario {
    TestScenario {
        name: "error_recovery_flow".to_string(),
        description: "Test error handling and recovery mechanisms".to_string(),
        steps: vec![
            TestStep {
                action: "Simulate scan error".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "error_type".to_string() => "path_not_found".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify error message display".to_string(),
                component: "ui".to_string(),
                parameters: hashmap!{
                    "check_error_color".to_string() => "true".to_string(),
                    "check_retry_button".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
            TestStep {
                action: "Test retry mechanism".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "retry_with_valid_path".to_string() => "true".to_string(),
                },
                timeout_ms: 30000,
                is_read_only: true,
            },
            TestStep {
                action: "Verify recovery success".to_string(),
                component: "scanner".to_string(),
                parameters: hashmap!{
                    "check_scan_completed".to_string() => "true".to_string(),
                },
                timeout_ms: 5000,
                is_read_only: true,
            },
        ],
        expected_outcomes: vec![
            "Error is displayed with appropriate styling".to_string(),
            "Retry button is available".to_string(),
            "Retry with valid path succeeds".to_string(),
            "Recovery is reported to user".to_string(),
        ],
        is_destructive: false,
        requires_permission: false,
    }
}
