// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class AIAssistantViewModel
{
    private string SelectModelForTask(string userMessage)
    {
        var lower = userMessage.ToLowerInvariant();
        var isDiskTask = lower.Contains("disk") || lower.Contains("scan") || lower.Contains("file")
            || lower.Contains("duplicate") || lower.Contains("cleanup") || lower.Contains("storage");
        var preferred = AutoModelSelection && isDiskTask
            ? (string.IsNullOrWhiteSpace(ToolCallingModel) ? OllamaModel : ToolCallingModel)
            : OllamaModel;

        if (_installedModels.Count == 0)
            return preferred;

        if (!string.IsNullOrWhiteSpace(preferred)
            && _installedModels.Any(m => string.Equals(m.Name, preferred, StringComparison.OrdinalIgnoreCase)))
            return preferred;

        var pick = ModelPreferences.PickRecommended(_installedModels)
                   ?? _installedModels
                       .OrderByDescending(m => m.Capabilities.Contains("tools"))
                       .ThenBy(m => m.Size)
                       .FirstOrDefault()?.Name;
        return pick ?? preferred;
    }

    private string ResolveToolChoice(string question, List<ToolDefinition> tools)
    {
        var lower = question.ToLowerInvariant();
        var domainKeywords = new[]
        {
            "scan", "volume", "drive", "workflow", "duplicate", "dedup",
            "recycle", "trend", "prediction", "history", "cleanup"
        };
        var hasDomainKeyword = domainKeywords.Any(k => lower.Contains(k));
        var hasToolName = tools.Any(t => lower.Contains(t.Function.Name.ToLowerInvariant()));

        if (tools.Count == 0 || IsGreeting(lower))
            return "auto";
        if (hasDomainKeyword || hasToolName)
            return "required";
        return "auto";
    }

    private static bool IsGreeting(string lower)
    {
        if (lower.Contains("hello"))
            return true;
        return Regex.IsMatch(lower, @"\bhi\b");
    }

    private static readonly JsonSerializerOptions s_toolArgJson = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private List<ToolDefinition> GetToolDefinitions()
    {
        return new List<ToolDefinition>
        {
            new ToolDefinition { Function = new ToolFunction { Name = "get_disk_volumes", Description = "Get information about all disk volumes including total size, used space, and available space.", Parameters = new Dictionary<string, object>() } },
            new ToolDefinition { Function = new ToolFunction { Name = "get_system_resources", Description = "Get current CPU and memory usage statistics.", Parameters = new Dictionary<string, object>() } },
            new ToolDefinition { Function = new ToolFunction { Name = "get_storage_trend", Description = "Get storage usage trend over time from scan history.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["limit"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of data points to retrieve (default 20)" } }, ["required"] = new List<string>() } } },
            new ToolDefinition { Function = new ToolFunction { Name = "list_workflows", Description = "List all available workflow templates with their descriptions.", Parameters = new Dictionary<string, object>() } },
            new ToolDefinition { Function = new ToolFunction { Name = "predict_storage", Description = "Predict future storage usage based on historical scan data.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["days_ahead"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of days to predict ahead (default 30)" } }, ["required"] = new List<string>() } } },
            new ToolDefinition { Function = new ToolFunction { Name = "preview_impact", Description = "Generate a destructive-action impact report for a file. Shows hardlinks, symlinks, sibling files, and an impact assessment. READ-ONLY.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the file to analyze" } }, ["required"] = new List<string> { "path" } } } },
            new ToolDefinition { Function = new ToolFunction { Name = "run_scan", Description = "Scan a directory and return a summary of disk usage including total files, size, top directories, largest files, and file type distribution. Always provide the 'path' argument with the absolute path to the directory to scan.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the directory to scan" }, ["deep"] = new Dictionary<string, object> { ["type"] = "boolean", ["description"] = "Enable deep scan with unlimited depth (default false)" } }, ["required"] = new List<string> { "path" } } } },
            new ToolDefinition { Function = new ToolFunction { Name = "analyze_file_patterns", Description = "Analyze duplicate file patterns and potential savings in the target directory using content hashing.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the directory to analyze (optional, uses most recent scan path if omitted)" } }, ["required"] = new List<string>() } } },
            new ToolDefinition { Function = new ToolFunction { Name = "get_scan_summary", Description = "Get a summary of the latest scan results including total files, size, and file type distribution.", Parameters = new Dictionary<string, object>() } },
            new ToolDefinition { Function = new ToolFunction { Name = "get_file_type_breakdown", Description = "Get a detailed breakdown of files by extension from the current scan.", Parameters = new Dictionary<string, object>() } },
            new ToolDefinition { Function = new ToolFunction { Name = "search_files", Description = "Search files in the target directory by extension, name keyword, or size range.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["extension"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Filter by file extension (without dot, e.g. 'pdf')" }, ["keyword"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Filter by keyword in file path/name" }, ["limit"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Maximum number of results (default 20)" } }, ["required"] = new List<string>() } } },
            new ToolDefinition { Function = new ToolFunction { Name = "get_largest_files", Description = "Get the largest files from the target directory.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["count"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of largest files to return (default 20)" } }, ["required"] = new List<string>() } } },
            new ToolDefinition { Function = new ToolFunction { Name = "run_workflow", Description = "Execute a predefined workflow to find files matching specific criteria.", Parameters = new Dictionary<string, object> { ["type"] = "object", ["properties"] = new Dictionary<string, object> { ["workflow"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "The workflow name to execute" }, ["path"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Absolute path to the target directory (optional)" }, ["min_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Minimum file size in MB" }, ["max_size_mb"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Maximum file size in MB" }, ["days_old"] = new Dictionary<string, object> { ["type"] = "integer", ["description"] = "Number of days old" }, ["start_date"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "Start date (ISO-8601)" }, ["end_date"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "End date (ISO-8601)" }, ["extension"] = new Dictionary<string, object> { ["type"] = "string", ["description"] = "File extension to filter by" } }, ["required"] = new List<string> { "workflow" } } } },
        };
    }
}
