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
        }
    }
}
