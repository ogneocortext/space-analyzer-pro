// Licensed under the MIT License.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ToolExecutor
{
    private async Task<string> GetScanSummaryAsync(CancellationToken ct)
    {
        var (records, _) = await _scanner.GetScanHistoryPageAsync(limit: 1, ct: ct);
        if (records.Count == 0)
            return "No scan results available. Run a scan first.";

        var latest = records[0];
        return JsonSerializer.Serialize(new
        {
            path = latest.Path,
            timestamp = latest.Timestamp,
            total_files = latest.TotalFiles,
            total_size_gb = Math.Round(latest.TotalSizeBytes / (1024.0 * 1024 * 1024), 2),
            duration_secs = latest.DurationSecs,
            potential_cleanup_bytes = latest.PotentialCleanupBytes,
            potential_cleanup_gb = Math.Round(latest.PotentialCleanupBytes / (1024.0 * 1024 * 1024), 2),
        }, s_json);
    }

    private async Task<string> GetFileTypeBreakdownAsync(CancellationToken ct)
    {
        var (records, _) = await _scanner.GetScanHistoryPageAsync(limit: 1, ct: ct);
        if (records.Count == 0)
            return "No scan results available.";

        var latest = records[0];
        if (latest.FileTypes == null || latest.FileTypes.Count == 0)
            return "No file type distribution data in this scan.";

        var sorted = latest.FileTypes
            .OrderByDescending(kvp => kvp.Value)
            .Take(20)
            .Select(kvp => new { extension = kvp.Key, count = kvp.Value })
            .ToList();

        return JsonSerializer.Serialize(sorted, s_json);
    }

    private async Task<string> AnalyzeFilePatternsAsync(CancellationToken ct)
    {
        var path = await ResolveScanPathAsync(new Dictionary<string, object>(), ct);
        if (string.IsNullOrWhiteSpace(path))
            return "No scan results available. Run a scan first.";
        var dedupOutput = await RunCliAsync(new[] { "dedup", "--path", path, "--format", "json" }, ct);
        return string.IsNullOrWhiteSpace(dedupOutput)
            ? "No pattern analysis available."
            : dedupOutput;
    }

    private async Task<string> SearchFilesAsync(
        Dictionary<string, object> args,
        CancellationToken ct,
        IProgress<StreamProgress>? progress = null)
    {
        var path = await ResolveScanPathAsync(args, ct);
        if (string.IsNullOrWhiteSpace(path))
            return "No scan results available.";

        var extension = GetOptionalString(args, "extension");
        var keyword = GetOptionalString(args, "keyword");
        var limit = Math.Max(1, GetInt(args, "limit", 50));
        var sizeMinMb = GetInt(args, "size_min_mb", 0);
        var sizeMaxMb = GetInt(args, "size_max_mb", 0);
        var includeHidden = GetBool(args, "include_hidden");

        // Real, bounded filesystem search: the scanner walks the whole subtree and
        // returns every path matching the filters (capped at --limit). This replaces
        // the old behaviour of only filtering the handful of largest files cached in
        // a scan result, which silently missed the vast majority of matches.
        var cliArgs = new List<string> { "search", "--path", path, "--format", "json", "--limit", limit.ToString() };
        if (!string.IsNullOrEmpty(extension))
            cliArgs.AddRange(new[] { "--extension", extension });
        if (!string.IsNullOrEmpty(keyword))
            cliArgs.AddRange(new[] { "--keyword", keyword });
        if (sizeMinMb > 0)
            cliArgs.AddRange(new[] { "--min-size", $"{sizeMinMb}M" });
        if (sizeMaxMb > 0)
            cliArgs.AddRange(new[] { "--max-size", $"{sizeMaxMb}M" });
        if (includeHidden)
            cliArgs.Add("--include-hidden");
        // Ask the scanner to emit live `__PROGRESS__` lines so the agentic tool
        // bubble can stream "Running search_files — <N> files…" instead of sitting
        // at "Running…" until the (potentially slow) search returns.
        if (progress is not null)
            cliArgs.Add("--progress-json");

        var output = await RunCliAsync(cliArgs, ct, progress);
        if (!string.IsNullOrWhiteSpace(output)
            && !output.TrimStart().StartsWith("Error", StringComparison.OrdinalIgnoreCase)
            && TryParseSearchMatches(output, limit, out var json))
        {
            return json;
        }

        // Degraded fallback: filter the cached largest-files list if the bundled
        // scanner predates the `search` subcommand. (Only covers the top-N files,
        // so it may under-report — but keeps the tool working on older binaries.)
        var files = await GetLargestFileEntriesAsync(path, ScannerService.DepthMode.Default, progress, ct);
        if (files == null || files.Count == 0)
            return "No files match the current filters in the target directory.";

        IEnumerable<FileSizeEntry> results = files;
        if (!string.IsNullOrEmpty(extension))
            results = results.Where(f => f.Path.EndsWith("." + extension, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrEmpty(keyword))
            results = results.Where(f => f.Path.Contains(keyword, StringComparison.OrdinalIgnoreCase));

        var formatted = results.Take(limit).Select(f => new
        {
            path = f.Path,
            size_mb = Math.Round(f.Size / (1024.0 * 1024), 2),
        }).ToList();

        return JsonSerializer.Serialize(formatted, s_json);
    }

    /// <summary>
    /// Parse the scanner `search --format json` output into the slim
    /// <c>{ path, size_mb }</c> shape the AI assistant expects. Returns false (so
    /// the caller can fall back to the cached search) when the payload is not the
    /// expected search result, which also guards against older scanner binaries
    /// that don't implement the <c>search</c> subcommand.
    /// </summary>
    private static bool TryParseSearchMatches(string output, int limit, out string json)
    {
        json = string.Empty;
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (!doc.RootElement.TryGetProperty("matches", out var matches)
                || matches.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var items = matches.EnumerateArray()
                .Take(limit)
                .Select(m => new
                {
                    path = m.TryGetProperty("path", out var p) ? p.GetString() : null,
                    size_mb = m.TryGetProperty("size", out var s) && s.ValueKind == JsonValueKind.Number
                        ? Math.Round(s.GetInt64() / (1024.0 * 1024), 2)
                        : 0.0,
                })
                .Where(x => x.path != null)
                .Select(x => new { path = x.path, size_mb = x.size_mb })
                .ToList();

            json = JsonSerializer.Serialize(items, s_json);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<string> GetLargestFilesAsync(
        Dictionary<string, object> args,
        CancellationToken ct,
        IProgress<StreamProgress>? progress = null)
    {
        var path = await ResolveScanPathAsync(args, ct);
        if (string.IsNullOrWhiteSpace(path))
            return "No scan results available.";

        var count = GetInt(args, "count", 20);

        var files = await GetLargestFileEntriesAsync(path, ScannerService.DepthMode.Default, progress, ct);
        if (files == null || files.Count == 0)
            return "No large files found.";

        var results = files
            .OrderByDescending(f => f.Size)
            .Take(count)
            .Select(f => new
            {
                path = f.Path,
                size_mb = Math.Round(f.Size / (1024.0 * 1024), 2),
            })
            .ToList();

        return JsonSerializer.Serialize(results, s_json);
    }

    private async Task<string> RunScanAsync(
        Dictionary<string, object> args,
        CancellationToken ct,
        IProgress<StreamProgress>? progress = null)
    {
        var path = await ResolveScanPathAsync(args, ct);
        if (string.IsNullOrWhiteSpace(path))
            return "Error: no path provided and no prior scan history to use.";

        if (!Directory.Exists(path))
            return $"Error: directory not found: {path}";

        var deep = args.TryGetValue("deep", out var deepVal)
            && (deepVal is bool b ? b : deepVal?.ToString()?.ToLower() == "true");

        var mode = deep
            ? ScannerService.DepthMode.Deep
            : ScannerService.DepthMode.Default;

        var result = await _scanner.ScanDirectoryStreamingAsync(path, mode, onProgress: progress, ct: ct);
        if (result == null)
            return "Scan returned no results.";

        return JsonSerializer.Serialize(new
        {
            path = result.Path,
            timestamp = result.Timestamp,
            total_files = result.TotalFiles,
            total_size_gb = Math.Round(result.TotalSizeBytes / (1024.0 * 1024 * 1024), 2),
            total_dirs = result.TotalDirs,
            duration_secs = Math.Round(result.DurationSecs, 1),
            potential_cleanup_bytes = result.PotentialCleanupBytes,
            potential_cleanup_gb = Math.Round(result.PotentialCleanupBytes / (1024.0 * 1024 * 1024), 2),
            top_directories = result.TopDirectories.Take(10).Select(d => new
            {
                path = d.Path,
                size_gb = Math.Round(d.TotalSize / (1024.0 * 1024 * 1024), 2),
                file_count = d.FileCount,
            }).ToList(),
            largest_files = result.LargestFiles.Take(10).Select(f => new
            {
                path = f.Path,
                size_mb = Math.Round(f.Size / (1024.0 * 1024), 2),
            }).ToList(),
            file_types = result.FileTypes
                .OrderByDescending(kvp => kvp.Value)
                .Take(10)
                .Select(kvp => new { extension = kvp.Key, count = kvp.Value })
                .ToList(),
            errors = result.Errors.Take(5).ToList(),
        }, s_json);
    }

        private async Task<string> RunWorkflowAsync(
            Dictionary<string, object> args,
            CancellationToken ct)
        {
            var workflow = GetString(args, "workflow");
            if (string.IsNullOrWhiteSpace(workflow))
                return "Error: 'workflow' parameter is required. Use list_workflows to see available workflows.";

            var path = GetString(args, "path");
            if (string.IsNullOrWhiteSpace(path))
            {
                path = await ResolveScanPathAsync(args, ct);
                if (string.IsNullOrWhiteSpace(path))
                    return "Error: no path provided and no prior scan history to use.";
            }

            if (!Directory.Exists(path))
                return $"Error: directory not found: {path}";

            return workflow.ToLowerInvariant() switch
            {
                "find_large_files" => await WorkflowFindLargeFilesAsync(path, args, ct),
                "find_empty_directories" => await WorkflowFindEmptyDirsAsync(path, ct),
                "find_duplicate_files" => await WorkflowFindDuplicatesAsync(path, ct),
                "find_zero_byte_files" => await WorkflowFindZeroByteFilesAsync(path, ct),
                "find_temp_cache_files" => await WorkflowFindTempCacheAsync(path, ct),
                "find_old_files" => await WorkflowFindOldFilesAsync(path, args, ct),
                "find_recently_modified" => await WorkflowFindRecentFilesAsync(path, args, ct),
                "find_largest_directories" => await WorkflowFindLargestDirsAsync(path, ct),
                "find_largest_single_files" => await WorkflowFindLargestSingleAsync(path, ct),
                "find_by_extension" => await WorkflowFindByExtensionAsync(path, args, ct),
                "find_in_size_range" => await WorkflowFindInSizeRangeAsync(path, args, ct),
                "find_by_date_range" => await WorkflowFindByDateRangeAsync(path, args, ct),
                "find_files_older_than" => await WorkflowFindOlderThanAsync(path, args, ct),
                "find_hidden_files" => await WorkflowFindHiddenFilesAsync(path, ct),
                "find_read_only_files" => await WorkflowFindReadOnlyAsync(path, ct),
                "find_orphaned_projects" => await WorkflowFindOrphanedProjectsAsync(path, ct),
                "downloads_folder_bloat" => await WorkflowDownloadsBloatAsync(path, args, ct),
                _ => $"Unknown workflow: {workflow}. Use list_workflows to see available workflows."
            };
        }

}
