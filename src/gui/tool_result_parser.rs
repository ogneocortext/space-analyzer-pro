use super::icons;
use super::types::ToolResultDisplay;

impl ToolResultDisplay {
    pub fn from_raw(tool_name: &str, raw_result: &str) -> Self {
        let (icon_opt, summary, details) = parse_tool_result(tool_name, raw_result);
        Self {
            tool_name: tool_name.to_string(),
            tool_icon: icon_opt.map(|icon| (0, icon.to_string())),
            summary,
            details,
            raw_data: raw_result.to_string(),
        }
    }
}

fn parse_tool_result(
    tool_name: &str,
    raw: &str,
) -> (Option<&'static str>, String, Vec<String>) {
    match tool_name {
        "get_scan_summary" => {
            let lines: Vec<&str> = raw.lines().collect();
            let summary = lines.first().unwrap_or(&"Scan Summary").to_string();
            let details: Vec<String> = lines.iter().skip(1).map(|s| s.to_string()).collect();
            (Some(icons::SCAN), summary, details)
        }
        "get_scan_history" => {
            let count = raw
                .lines()
                .next()
                .and_then(|l| l.strip_prefix("Recent scans ("))
                .and_then(|l| l.strip_suffix("):"))
                .unwrap_or("?");
            (
                Some(icons::HISTORY),
                format!("{} scan(s) in history", count),
                raw.lines().skip(1).map(|s| s.trim().to_string()).collect(),
            )
        }
        "get_disk_volumes" => {
            let lines: Vec<&str> = raw
                .lines()
                .filter(|l| {
                    let t = l.trim();
                    // Match any drive letter pattern (C:\, D:\, etc.) or Unix mount (/home, /mnt, etc.)
                    (t.len() >= 2
                        && t.as_bytes()[1] == b':'
                        && t.as_bytes()[0].is_ascii_alphabetic())
                        || t.starts_with('/')
                })
                .collect();
            (
                Some(icons::DISK),
                format!("{} disk volume(s) found", lines.len()),
                lines.iter().map(|s| s.trim().to_string()).collect(),
            )
        }
        "get_system_resources" => {
            let cpu = raw
                .lines()
                .find(|l| l.contains("CPU"))
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
            let mem = raw
                .lines()
                .find(|l| l.contains("Memory"))
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
            let summary = match (cpu.is_empty(), mem.is_empty()) {
                (false, false) => format!("{}, {}", cpu, mem),
                (false, true) => cpu,
                (true, false) => mem,
                (true, true) => "System resources loaded".to_string(),
            };
            (Some(icons::SYSTEM), summary, Vec::new())
        }
        "get_storage_trend" => {
            // Match lines that look like timestamps (contain a dash-separated date)
            let lines: Vec<&str> = raw
                .lines()
                .filter(|l| {
                    let t = l.trim();
                    t.contains('-')
                        && t.len() > 10
                        && t.as_bytes().iter().take(4).all(|b| b.is_ascii_digit())
                })
                .collect();
            let count = lines.len();
            let latest = lines.last().map(|l| l.trim()).unwrap_or("N/A");
            (
                Some(icons::TREND),
                format!("{} data point(s). Latest: {}", count, latest),
                lines.iter().map(|s| s.trim().to_string()).collect(),
            )
        }
        "list_workflows" => {
            // Count lines that look like workflow entries (non-header, non-empty)
            let count = raw
                .lines()
                .filter(|l| {
                    let t = l.trim();
                    !t.is_empty() && !t.starts_with("Available workflows") && !t.starts_with("  -")
                })
                .count()
                .max(1)
                - 1; // Subtract the header line
            (
                Some(icons::WORKFLOW),
                format!("{} workflow(s) available", count),
                raw.lines().map(|s| s.trim().to_string()).collect(),
            )
        }
        "get_file_type_breakdown" => {
            let total = raw
                .lines()
                .next()
                .and_then(|l| l.strip_prefix("File type breakdown ("))
                .and_then(|l| l.strip_suffix(" total files):"))
                .unwrap_or("?");
            (
                Some(icons::FILETYPE),
                format!("{} file type(s) found", total),
                raw.lines().skip(1).map(|s| s.trim().to_string()).collect(),
            )
        }
        "predict_storage" => {
            let prediction = raw
                .lines()
                .find(|l| l.contains("Predicted size"))
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
            let growth = raw
                .lines()
                .find(|l| l.contains("Average daily"))
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
            let summary = match (prediction.is_empty(), growth.is_empty()) {
                (false, false) => format!("{} | {}", prediction, growth),
                (false, true) => prediction,
                (true, false) => growth,
                (true, true) => "Prediction loaded".to_string(),
            };
            (
                Some(icons::PREDICT),
                summary,
                raw.lines().map(|s| s.trim().to_string()).collect(),
            )
        }
        "analyze_file_patterns" => {
            let lines: Vec<&str> = raw.lines().filter(|l| !l.is_empty()).collect();
            let first = lines.first().map(|s| s.to_string()).unwrap_or_default();
            (
                Some(icons::PATTERN),
                first,
                lines.iter().skip(1).map(|s| s.to_string()).collect(),
            )
        }
        _ => (
            Some(icons::TOOL),
            format!("Tool: {}", tool_name),
            raw.lines().map(|s| s.to_string()).collect(),
        ),
    }
}
