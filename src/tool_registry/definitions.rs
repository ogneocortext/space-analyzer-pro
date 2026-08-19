use super::*;

impl ToolRegistry {
    pub(super) fn add_definitions(&mut self, has_scan: bool) {
        // Always-available tools (work with or without a scan)

        // Tool: get_scan_history
        self.definitions.push(ToolDefinition::new(
            "get_scan_history",
            "Retrieve recent scan history records. Optional 'limit' parameter (default 10).",
            ToolParameters::new(
                serde_json::json!({
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent scans to retrieve (1-50)"
                    }
                }),
                vec![],
            ),
        ));

        // Tool: get_disk_volumes
        self.definitions.push(ToolDefinition::new(
            "get_disk_volumes",
            "Get information about all disk volumes on the system including total size, used space, and available space.",
            ToolParameters::empty(),
        ));

        // Tool: get_system_resources
        self.definitions.push(ToolDefinition::new(
            "get_system_resources",
            "Get current CPU and memory usage statistics.",
            ToolParameters::empty(),
        ));

        // Tool: get_storage_trend
        self.definitions.push(ToolDefinition::new(
            "get_storage_trend",
            "Get storage usage trend over time from scan history. Shows how total scanned size has changed.",
            ToolParameters::new(
                serde_json::json!({
                    "limit": {
                        "type": "integer",
                        "description": "Number of data points to retrieve (default 20)"
                    }
                }),
                vec![],
            ),
        ));

        // Tool: list_workflows
        self.definitions.push(ToolDefinition::new(
            "list_workflows",
            "List all available workflow templates with their descriptions.",
            ToolParameters::empty(),
        ));

        // Tool: classify_file (origin-trace/classify — read-only)
        self.definitions.push(ToolDefinition::new(
            "classify_file",
            "Classify a single file or directory by origin and assess how safe it is to delete. Returns the origin category, a deletion-safety verdict (SAFE / REVIEW / KEEP / DO NOT DELETE), whether an owning app is installed, and related files (hardlinks, symlinks, same-stem files). READ-ONLY — does not modify the filesystem.",
            ToolParameters::new(
                serde_json::json!({
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file or directory to classify"
                    },
                    "size_bytes": {
                        "type": "integer",
                        "description": "Known size of the file in bytes (optional; improves the assessment)"
                    }
                }),
                vec!["path".to_string()],
            ),
        ));

        // Tool: predict_storage
        self.definitions.push(ToolDefinition::new(
            "predict_storage",
            "Predict future storage usage based on historical scan data. Returns growth rate and days until disk full.",
            ToolParameters::new(
                serde_json::json!({
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days to predict ahead (default 30)"
                    }
                }),
                vec![],
            ),
        ));

        // Tool: preview_impact (destructive-action preview gate - read-only)
        self.definitions.push(ToolDefinition::new(
            "preview_impact",
            "Generate a destructive-action impact report for a file. Shows hardlinks, symlinks, sibling files, and an impact assessment. READ-ONLY \u{2014} does not modify the filesystem. The user must review the report and confirm any destructive action through the GUI (Dashboard \u{2192} Destructive-Action Preview).",
            ToolParameters::new(
                serde_json::json!({
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to analyze"
                    }
                }),
                vec!["path".to_string()],
            ),
        ));

        // Tool: move_to_trash (destructive-action preview gate - PREVIEW ONLY)
        self.definitions.push(ToolDefinition::new(
            "move_to_trash",
            "PREVIEW ONLY: Returns an impact report for moving a file to trash. The AI agent CANNOT perform this action directly. The user must confirm via the GUI (Dashboard \u{2192} Destructive-Action Preview). Use preview_impact first to see the consequences.",
            ToolParameters::new(
                serde_json::json!({
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to move to trash"
                    }
                }),
                vec!["path".to_string()],
            ),
        ));

        // Tool: hardlink_duplicates (destructive-action preview gate - PREVIEW ONLY)
        self.definitions.push(ToolDefinition::new(
            "hardlink_duplicates",
            "PREVIEW ONLY: Returns a plan for hard-linking duplicate files in a directory. The AI agent CANNOT perform this action directly. The user must run a dedup scan via the GUI (Dedup tab) and review results before any changes are made.",
            ToolParameters::new(
                serde_json::json!({
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the directory to scan for duplicates"
                    }
                }),
                vec!["path".to_string()],
            ),
        ));

        // Scan-dependent tools (only available when a scan exists)
        if has_scan {
            // Tool: get_scan_summary
            self.definitions.push(ToolDefinition::new(
                "get_scan_summary",
                "Get a summary of the current scan results including total files, size, and file type distribution.",
                ToolParameters::empty(),
            ));

            // Tool: get_file_type_breakdown
            self.definitions.push(ToolDefinition::new(
                "get_file_type_breakdown",
                "Get a detailed breakdown of files by extension from the current scan.",
                ToolParameters::empty(),
            ));

            // Tool: analyze_file_patterns
            self.definitions.push(ToolDefinition::new(
                "analyze_file_patterns",
                "Analyze file patterns to find duplicates, similar files, and categorization insights from current scan.",
                ToolParameters::empty(),
            ));

            // Tool: search_files
            self.definitions.push(ToolDefinition::new(
                "search_files",
                "Search files in the current scan by extension (e.g. 'pdf', 'txt'), name keyword, or size range. Returns matching files.",
                ToolParameters::new(
                    serde_json::json!({
                        "extension": {
                            "type": "string",
                            "description": "Filter by file extension (without dot, e.g. 'pdf')"
                        },
                        "keyword": {
                            "type": "string",
                            "description": "Filter by keyword in file path/name"
                        },
                        "min_size_mb": {
                            "type": "integer",
                            "description": "Minimum file size in MB"
                        },
                        "max_size_mb": {
                            "type": "integer",
                            "description": "Maximum file size in MB"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results (default 20)"
                        }
                    }),
                    vec![],
                ),
            ));

            // Tool: get_largest_files
            self.definitions.push(ToolDefinition::new(
                "get_largest_files",
                "Get the largest files from the current scan with optional size filter and configurable count.",
                ToolParameters::new(
                    serde_json::json!({
                        "count": {
                            "type": "integer",
                            "description": "Number of largest files to return (default 20, max 100)"
                        },
                        "min_size_mb": {
                            "type": "integer",
                            "description": "Minimum file size in MB to include"
                        }
                    }),
                    vec![],
                ),
            ));

            // Tool: get_bloat_findings
            self.definitions.push(ToolDefinition::new(
                "get_bloat_findings",
                "Detect bloat candidates in the current scan using the offline classifier. Returns installer caches, temp/build artifacts, VM images, and other reclaimable categories found in the scan's top directories and largest files, each with a size and priority score.",
                ToolParameters::empty(),
            ));

            // Tool: get_recommendations
            self.definitions.push(ToolDefinition::new(
                "get_recommendations",
                "Surface prioritized cleanup recommendations for the current scan (drive-full warnings, Ollama model bloat, node_modules, caches, VM images, and more). Each recommendation carries a numeric priority (higher = more urgent).",
                ToolParameters::empty(),
            ));
        }
    }
}
