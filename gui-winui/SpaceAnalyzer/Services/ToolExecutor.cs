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

/// <summary>
/// Executes Ollama tool calls by delegating to the Rust CLI (scan, disk-info,
/// history, dedup) or native C# for simple filesystem operations.
/// </summary>
public class ToolExecutor : IDisposable
{
    private readonly ScannerService _scanner;
    private bool _disposed;
    private string _userMessage = string.Empty;

    private static readonly JsonSerializerOptions s_json = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public ToolExecutor(ScannerService scanner)
    {
        _scanner = scanner;
    }

    // ── Public API ──

    /// <summary>
    /// Execute a tool call from the model and return the result as a string.
    /// <paramref name="userMessage"/> is the user's current message, used to resolve a
    /// target directory when the model omits a required path argument.
    /// <paramref name="progress"/> receives streaming scan progress for scan-backed
    /// tools so the caller can surface live status to the user.
    /// </summary>
    public async Task<string> ExecuteAsync(
        string toolName,
        Dictionary<string, object> arguments,
        CancellationToken ct = default,
        string? userMessage = null,
        IProgress<StreamProgress>? progress = null)
    {
        _userMessage = userMessage ?? string.Empty;
        try
        {
            return toolName switch
            {
                "get_disk_volumes" => await GetDiskVolumesAsync(ct),
                "get_system_resources" => await GetSystemResourcesAsync(),
                "get_storage_trend" => await GetStorageTrendAsync(GetInt(arguments, "limit", 20), ct),
                "list_workflows" => ListWorkflows(),
                "predict_storage" => await PredictStorageAsync(GetInt(arguments, "days_ahead", 30), ct),
                "preview_impact" => await PreviewImpactAsync(GetString(arguments, "path")),
                "move_to_trash" => await MoveToTrashPreviewAsync(GetString(arguments, "path")),
                "hardlink_duplicates" => await HardlinkDuplicatesPreviewAsync(GetString(arguments, "path"), ct),
                "get_scan_summary" => await GetScanSummaryAsync(ct),
                "get_file_type_breakdown" => await GetFileTypeBreakdownAsync(ct),
                "analyze_file_patterns" => await AnalyzeFilePatternsAsync(ct),
                "search_files" => await SearchFilesAsync(arguments, ct, progress),
                "get_largest_files" => await GetLargestFilesAsync(arguments, ct, progress),
                 "run_scan" => await RunScanAsync(arguments, ct, progress),
                 "run_workflow" => await RunWorkflowAsync(arguments, ct),
                 _ => $"Unknown tool: {toolName}"
            };
        }
        catch (Exception ex)
        {
            return $"Error executing {toolName}: {ex.Message}";
        }
    }

    // ── Always-available tools ──

    private async Task<string> GetDiskVolumesAsync(CancellationToken ct)
    {
        var volumes = await _scanner.GetDiskVolumesAsync(ct);
        return JsonSerializer.Serialize(volumes, s_json);
    }

    private static async Task<string> GetSystemResourcesAsync()
    {
        var data = new Dictionary<string, object>();

        try
        {
            var cpu = new PerformanceCounter("Processor", "% Processor Time", "_Total");
            _ = cpu.NextValue();
            await Task.Delay(200);
            data["cpu_usage_percent"] = Math.Round(cpu.NextValue(), 1);
        }
        catch
        {
            data["cpu_usage_percent"] = -1;
        }

        try
        {
            var totalMemory = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
            var usedMemory = GC.GetTotalMemory(false);
            data["total_memory_bytes"] = totalMemory;
            data["used_memory_bytes"] = usedMemory;
            data["memory_usage_percent"] = totalMemory > 0
                ? Math.Round((double)usedMemory / totalMemory * 100, 1)
                : -1;
        }
        catch (Exception ex)
        {
            data["memory_error"] = ex.Message;
        }

        return JsonSerializer.Serialize(data, s_json);
    }

    private async Task<string> GetStorageTrendAsync(int limit, CancellationToken ct)
    {
        var (records, _) = await _scanner.GetScanHistoryPageAsync(
            limit: limit, sortBy: "timestamp", sortAsc: true, ct: ct);

        if (records.Count == 0)
            return "[]";

        var trend = records.Select(r => new
        {
            r.Timestamp,
            r.Path,
            TotalSizeGB = Math.Round(r.TotalSizeBytes / (1024.0 * 1024 * 1024), 2),
            r.TotalFiles,
            r.DurationSecs
        }).ToList();

        return JsonSerializer.Serialize(trend, s_json);
    }

        private static string ListWorkflows()
        {
            var workflows = new[]
            {
                new { name = "find_large_files", description = "Locate files larger than a specified size threshold" },
                new { name = "find_empty_directories", description = "Find directories that contain no files" },
                new { name = "find_duplicate_files", description = "Scan for duplicate files by content hash" },
                new { name = "find_zero_byte_files", description = "Find files that occupy no space on disk" },
                new { name = "find_temp_cache_files", description = "Locate temporary and cache files that can be safely removed" },
                new { name = "find_old_files", description = "Find files not modified in a specified number of days" },
                new { name = "find_recently_modified", description = "Find files modified within a specified number of days" },
                new { name = "find_largest_directories", description = "Show directories ranked by total size" },
                new { name = "find_largest_single_files", description = "Show the single largest files by byte size" },
                new { name = "find_by_extension", description = "Find all files matching a specific file extension" },
                new { name = "find_in_size_range", description = "Find files within a specified size range" },
                new { name = "find_by_date_range", description = "Find files created or modified within a date range" },
                new { name = "find_files_older_than", description = "Find files older than a specified number of days" },
                new { name = "find_hidden_files", description = "Find files and folders with the hidden attribute" },
                new { name = "find_read_only_files", description = "Find files marked as read-only" },
                new { name = "find_orphaned_projects", description = "Find project directories missing key build/config files" },
                new { name = "downloads_folder_bloat", description = "Analyze the Downloads folder for large or old files" },
            };
            return JsonSerializer.Serialize(workflows, s_json);
        }

    private async Task<string> PredictStorageAsync(int daysAhead, CancellationToken ct)
    {
        var (records, _) = await _scanner.GetScanHistoryPageAsync(
            limit: 50, sortBy: "timestamp", sortAsc: true, ct: ct);

        if (records.Count < 2)
            return JsonSerializer.Serialize(new
            {
                prediction = "Insufficient data (need at least 2 scans)",
                scans_available = records.Count
            }, s_json);

        var sizes = records.Select(r => (double)r.TotalSizeBytes).ToList();
        var timestamps = records.Select(r =>
        {
            if (DateTime.TryParse(r.Timestamp, out var dt))
                return new DateTimeOffset(dt).ToUnixTimeSeconds();
            return 0L;
        }).ToList();

        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        int n = sizes.Count;
        for (int i = 0; i < n; i++)
        {
            sumX += timestamps[i];
            sumY += sizes[i];
            sumXY += timestamps[i] * sizes[i];
            sumX2 += timestamps[i] * timestamps[i];
        }

        double slope;
        double intercept;
        double denom = (n * sumX2 - sumX * sumX);
        if (Math.Abs(denom) < 1e-9)
        {
            slope = 0;
            intercept = sumY / n;
        }
        else
        {
            slope = (n * sumXY - sumX * sumY) / denom;
            intercept = (sumY - slope * sumX) / n;
        }

        long lastTimestamp = timestamps[^1];
        long futureTimestamp = lastTimestamp + (long)TimeSpan.FromDays(daysAhead).TotalSeconds;
        double predictedSize = slope * futureTimestamp + intercept;

        return JsonSerializer.Serialize(new
        {
            current_size_gb = Math.Round(sizes[^1] / (1024 * 1024 * 1024), 2),
            predicted_size_gb = Math.Round(predictedSize / (1024 * 1024 * 1024), 2),
            days_ahead = daysAhead,
            growth_rate_gb_per_day = Math.Round(slope * 86400 / (1024 * 1024 * 1024), 4),
            scans_used = n,
            first_scan = records[0].Timestamp,
            last_scan = records[^1].Timestamp
        }, s_json);
    }

    // ── Destructive-action preview (read-only) ──

    private static async Task<string> PreviewImpactAsync(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return "Error: path is required";

        if (!File.Exists(path))
            return $"Error: file not found: {path}";

        var info = new FileInfo(path);
        var dir = info.Directory;

        var siblings = dir?.EnumerateFiles()
            .Where(f => f.Name != info.Name && f.Length == info.Length)
            .Select(f => new { f.Name, SizeMB = Math.Round(f.Length / (1024.0 * 1024), 2) })
            .ToList() ?? new();

        // Try to detect hardlinks via fsutil (Windows-specific)
        int hardlinkCount = 1;
        bool hardlinkCountUnknown = false;
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "fsutil",
                Arguments = $"hardlink list \"{path}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var process = new Process { StartInfo = psi };
            process.Start();
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await process.WaitForExitAsync(timeoutCts.Token);
            var output = await process.StandardOutput.ReadToEndAsync();
            hardlinkCount = output.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length;
        }
        catch { hardlinkCount = -1; hardlinkCountUnknown = true; }

        return JsonSerializer.Serialize(new
        {
            path = info.FullName,
            size_mb = Math.Round(info.Length / (1024.0 * 1024.0), 2),
            hardlink_count = hardlinkCount,
            hardlink_count_unknown = hardlinkCountUnknown,
            sibling_files_same_size = siblings.Count,
            siblings = siblings.Take(10).ToList(),
            impact = hardlinkCountUnknown
                ? "Hardlink count could not be determined. Verify manually before deleting."
                : hardlinkCount > 1
                    ? "CAUTION: File has hardlinks. Deleting may affect other references."
                    : siblings.Count > 0
                        ? $"There are {siblings.Count} other files with the same size. Verify these are truly duplicates before deleting."
                        : "No obvious duplicates or hardlinks detected."
        }, s_json);
    }

    private static Task<string> MoveToTrashPreviewAsync(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return Task.FromResult("Error: path is required");

        if (!File.Exists(path))
            return Task.FromResult($"Error: file not found: {path}");

        var info = new FileInfo(path);
        return Task.FromResult(JsonSerializer.Serialize(new
        {
            path = info.FullName,
            size_mb = Math.Round(info.Length / (1024.0 * 1024), 2),
            note = "PREVIEW ONLY - The AI agent cannot perform this action. Please confirm via the GUI."
        }, s_json));
    }

    private async Task<string> HardlinkDuplicatesPreviewAsync(string path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path))
            return "Error: path is required";

        if (!Directory.Exists(path))
            return $"Error: directory not found: {path}";

        var dedupOutput = await RunCliAsync($"dedup --path \"{path}\" --format json", ct);
        if (string.IsNullOrWhiteSpace(dedupOutput))
            return "No duplicate analysis available.";

        return dedupOutput;
    }

    // ── Scan-dependent tools ──

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
        var dedupOutput = await RunCliAsync($"dedup --path \"{path}\" --format json", ct);
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
        var limit = GetInt(args, "limit", 20);

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

        private async Task<string> WorkflowFindLargeFilesAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var minMb = GetInt(args, "min_size_mb", 100);
            var minBytes = (ulong)minMb * 1024 * 1024;
            var files = await GetLargestFileEntriesAsync(path, ScannerService.DepthMode.Default, progress: null, ct);
            if (files == null || files.Count == 0)
                return "No cached scan results found for this directory. Try running a scan first.";
            var results = files
                .Where(f => f.Size >= minBytes)
                .Select(f => new { path = f.Path, name = Path.GetFileName(f.Path), size_bytes = f.Size, size_display = ByteFormatter.FormatBytes(f.Size) })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_large_files", count = results.Count, results = results }, s_json);
        }

        private async Task<string> WorkflowFindEmptyDirsAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var dirs = result.EmptyDirs
                .Select(d => new { path = d, name = Path.GetFileName(d) })
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_empty_directories", count = dirs.Count, results = dirs }, s_json);
        }

        private async Task<string> WorkflowFindDuplicatesAsync(string path, CancellationToken ct)
        {
            var dedup = await _scanner.RunDedupAnalysisAsync(path, ct);
            if (dedup is null) return "Dedup analysis returned no results.";
            var groups = dedup.DuplicateGroups
                .Select(g => new { hash = g.Hash, file_count = g.FileCount, size_display = g.SizeDisplay, wasted_bytes = g.WastedBytes, wasted_mb = Math.Round(g.WastedBytes / (1024.0 * 1024), 2) })
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_duplicate_files", count = groups.Count, results = groups }, s_json);
        }

        private async Task<string> WorkflowFindZeroByteFilesAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => kvp.Value.Size == 0)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key) })
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_zero_byte_files", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindTempCacheAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => WorkflowConstants.TempExtensions.Contains(Path.GetExtension(kvp.Key).ToLowerInvariant()) || WorkflowConstants.CacheExtensions.Contains(Path.GetExtension(kvp.Key).ToLowerInvariant()))
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size) })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_temp_cache_files", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindOldFilesAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var daysOld = GetInt(args, "days_old", 30);
            var cutoff = DateTime.Now.AddDays(-daysOld);
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime < cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime.ToString("o") })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_old_files", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindRecentFilesAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var daysOld = GetInt(args, "days_old", 30);
            var cutoff = DateTime.Now.AddDays(-daysOld);
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime >= cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime.ToString("o") })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_recently_modified", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindLargestDirsAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var dirs = result.TopDirectories
                .Select(d => new { path = d.Path, name = d.Name, total_size_bytes = d.TotalSize, total_size_display = ByteFormatter.FormatBytes(d.TotalSize), file_count = d.FileCount })
                .OrderByDescending(x => x.total_size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_largest_directories", count = dirs.Count, results = dirs }, s_json);
        }

        private async Task<string> WorkflowFindLargestSingleAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .OrderByDescending(kvp => kvp.Value.Size)
                .Take(50)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size) })
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_largest_single_files", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindByExtensionAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var extension = GetString(args, "extension");
            if (string.IsNullOrWhiteSpace(extension))
                return "Error: 'extension' parameter is required for this workflow.";
            if (!extension.StartsWith(".")) extension = "." + extension;
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => Path.GetExtension(kvp.Key).ToLowerInvariant() == extension.ToLowerInvariant())
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size) })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_by_extension", extension = extension, count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindInSizeRangeAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var minMb = GetInt(args, "min_size_mb", 0);
            var maxMb = GetInt(args, "max_size_mb", 1000);
            var minBytes = (long)minMb * 1024 * 1024;
            var maxBytes = (long)maxMb * 1024 * 1024;
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => (long)kvp.Value.Size >= minBytes && (long)kvp.Value.Size <= maxBytes)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size) })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_in_size_range", min_size_mb = minMb, max_size_mb = maxMb, count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindByDateRangeAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var startDate = GetOptionalString(args, "start_date");
            var endDate = GetOptionalString(args, "end_date");

            DateTime? start = null;
            DateTime? end = null;
            if (DateTime.TryParse(startDate, out var sd)) start = sd;
            if (DateTime.TryParse(endDate, out var ed)) end = ed;

            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";

            IEnumerable<KeyValuePair<string, ScannedFileEntry>> files = result.ScannedFiles;
            if (start.HasValue)
                files = files.Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime >= start.Value);
            if (end.HasValue)
                files = files.Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime <= end.Value);

            var list = files
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime.ToString("o") })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_by_date_range", start_date = startDate, end_date = endDate, count = list.Count, results = list }, s_json);
        }

        private async Task<string> WorkflowFindOlderThanAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var daysOld = GetInt(args, "days_old", 30);
            var cutoff = DateTime.Now.AddDays(-daysOld);
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime < cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime.ToString("o") })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_files_older_than", days_old = daysOld, count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindHiddenFilesAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp =>
                {
                    try { return (File.GetAttributes(kvp.Key) & FileAttributes.Hidden) == FileAttributes.Hidden; }
                    catch { return false; }
                })
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size) })
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_hidden_files", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindReadOnlyAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp =>
                {
                    try { return (File.GetAttributes(kvp.Key) & FileAttributes.ReadOnly) == FileAttributes.ReadOnly; }
                    catch { return false; }
                })
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size) })
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_read_only_files", count = files.Count, results = files }, s_json);
        }

        private async Task<string> WorkflowFindOrphanedProjectsAsync(string path, CancellationToken ct)
        {
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var dirs = result.TopDirectories
                .Where(d => !WorkflowConstants.OrphanedProjectFiles.Any(f => File.Exists(Path.Combine(d.Path, f))))
                .Select(d =>
                {
                    var dirInfo = new DirectoryInfo(d.Path);
                    var hasCode = dirInfo.GetFiles("*.*", SearchOption.TopDirectoryOnly)
                        .Any(f => WorkflowConstants.ProjectExtensions.Contains(Path.GetExtension(f.Name).ToLowerInvariant()));
                    return hasCode ? new { path = d.Path, name = d.Name, total_size_bytes = d.TotalSize, total_size_display = ByteFormatter.FormatBytes(d.TotalSize) } : null;
                })
                .Where(d => d is not null)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "find_orphaned_projects", count = dirs.Count, results = dirs }, s_json);
        }

        private async Task<string> WorkflowDownloadsBloatAsync(string path, Dictionary<string, object> args, CancellationToken ct)
        {
            var minMb = GetInt(args, "min_size_mb", 50);
            var daysOld = GetInt(args, "days_old", 30);
            var minBytes = (long)minMb * 1024 * 1024;
            var cutoff = DateTime.Now.AddDays(-daysOld);
            var result = await _scanner.ScanDirectoryAsync(path, depthMode: ScannerService.DepthMode.Deep, ct: ct);
            if (result is null) return "Scan returned no results.";
            var files = result.ScannedFiles
                .Where(kvp => (long)kvp.Value.Size >= minBytes || DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime < cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime.ToString("o") })
                .OrderByDescending(x => x.size_bytes)
                .ToList();
            return JsonSerializer.Serialize(new { workflow = "downloads_folder_bloat", min_size_mb = minMb, days_old = daysOld, count = files.Count, results = files }, s_json);
        }

        // ── Helpers ──

    /// <summary>
    /// Returns the largest files for a directory, preferring the most recent scan of
    /// that exact path already stored in the scan-history database (so a repeated
    /// request reuses the previous session's results instead of re-scanning the disk).
    /// Falls back to a live streaming scan when no matching cached scan exists.
    /// </summary>
    private async Task<List<FileSizeEntry>?> GetLargestFileEntriesAsync(
        string path,
        ScannerService.DepthMode mode,
        IProgress<StreamProgress>? progress,
        CancellationToken ct)
    {
        var cached = await FindCachedScanAsync(path, ct);
        if (cached != null && cached.LargestFiles.Count > 0)
            return cached.LargestFiles;

        var result = await _scanner.ScanDirectoryStreamingAsync(path, mode, onProgress: progress, ct: ct);
        if (ct.IsCancellationRequested)
            return null;
        return result?.LargestFiles;
    }

    /// <summary>
    /// Finds the most recent scan-history entry for <paramref name="path"/>. The
    /// DB lookup uses a path LIKE search (substring), so the exact-path check on
    /// the normalized path filters out sibling/parent paths that merely contain it.
    /// </summary>
    private async Task<ScanHistoryRecord?> FindCachedScanAsync(string path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path))
            return null;

        var target = NormalizePath(path);
        var (records, _) = await _scanner.GetScanHistoryPageAsync(
            limit: 50, search: path, sortBy: "timestamp", sortAsc: false, ct: ct);

        return records.FirstOrDefault(r => NormalizePath(r.Path) == target);
    }

    private static string NormalizePath(string path)
        => path.Trim().TrimEnd('\\').TrimEnd('/').ToUpperInvariant();

    /// <summary>
    /// Resolves the directory to operate on for scan-backed tools. Priority:
    /// explicit tool argument &gt; path mentioned in the user's message &gt; the most
    /// recently scanned directory (previous fallback).
    /// </summary>
    private async Task<string> ResolveScanPathAsync(
        Dictionary<string, object> args,
        CancellationToken ct)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path))
            path = ExtractDirectoryPath(_userMessage) ?? string.Empty;

        if (string.IsNullOrWhiteSpace(path))
        {
            var (latest, _) = await _scanner.GetScanHistoryPageAsync(limit: 1, ct: ct);
            if (latest.Count > 0)
                path = latest[0].Path;
        }

        return path;
    }

    /// <summary>
    /// Tries to find a directory the user is targeting in their message text.
    /// Handles quoted/backticked paths first, then drive-letter paths with
    /// spaces, validating each candidate against the filesystem. Returns an
    /// existing directory (or the parent of an existing file), else null.
    /// </summary>
    private static string? ExtractDirectoryPath(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // Quoted/backticked paths first (e.g. "C:\Some Folder" or `C:\Some Folder`).
        foreach (var quote in new[] { '"', '`' })
        {
            var pattern = quote + "([^\r\n" + quote + "]+)" + quote;
            foreach (Match m in Regex.Matches(text, pattern))
            {
                var path = m.Groups[1].Value.Trim();
                if (IsExistingDirectory(path))
                    return path;
            }
        }

        // Drive-letter anchors (C:\ ...). Starting at each anchor, grow the candidate
        // from the end of the message inward, dropping trailing prose one word at a
        // time until the remaining text resolves to a real directory.
        foreach (Match anchor in Regex.Matches(text, "[A-Za-z]:\\\\"))
        {
            var candidate = text[anchor.Index..].Trim();
            while (candidate.Length > 3)
            {
                if (IsExistingDirectory(candidate))
                    return candidate;

                var boundary = -1;
                for (int i = candidate.Length - 1; i >= 0; i--)
                {
                    if (char.IsWhiteSpace(candidate[i]) || candidate[i] == ',')
                    {
                        boundary = i;
                        break;
                    }
                }
                if (boundary <= 0)
                    break;
                candidate = candidate[..boundary].TrimEnd('\\').Trim();
            }
        }

        // UNC share anchors (\\server\share ...). Network paths have no drive
        // letter, so the drive-letter regex above never matches them. Uses the
        // same candidate-growth logic to strip trailing prose word by word.
        foreach (Match anchor in Regex.Matches(text, @"\\\\"))
        {
            var candidate = text[anchor.Index..].Trim();
            while (candidate.Length > 3)
            {
                if (IsExistingDirectory(candidate))
                    return candidate;

                var boundary = -1;
                for (int i = candidate.Length - 1; i >= 0; i--)
                {
                    if (char.IsWhiteSpace(candidate[i]) || candidate[i] == ',')
                    {
                        boundary = i;
                        break;
                    }
                }
                if (boundary <= 0)
                    break;
                candidate = candidate[..boundary].TrimEnd('\\').Trim();
            }
        }

        return null;
    }

    private static bool IsExistingDirectory(string path)
    {
        if (Directory.Exists(path))
            return true;
        if (File.Exists(path))
            return Directory.GetParent(path)?.FullName is { } parent && Directory.Exists(parent);
        return false;
    }

    private async Task<string> RunCliAsync(string args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _scanner.ScannerPath,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = new Process { StartInfo = psi };
        process.Start();

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            return ct.IsCancellationRequested
                ? "Operation was cancelled by the user."
                : "Operation timed out after 2 minutes.";
        }

        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);

        if (process.ExitCode != 0)
        {
            var detail = string.IsNullOrWhiteSpace(stderr) ? string.IsNullOrWhiteSpace(stdout) ? "No details available." : stdout : stderr;
            return $"Error (exit {process.ExitCode}): {detail}";
        }

        return stdout;
    }

    private static string GetString(Dictionary<string, object> args, string key)
    {
        if (!args.TryGetValue(key, out var v))
            return string.Empty;
        if (v is JsonElement je)
            return je.ValueKind == JsonValueKind.String ? je.GetString()! : je.GetRawText();
        return v?.ToString() ?? string.Empty;
    }

    private static string? GetOptionalString(Dictionary<string, object> args, string key)
    {
        if (!args.TryGetValue(key, out var v))
            return null;
        if (v is JsonElement je)
            return je.ValueKind == JsonValueKind.String ? je.GetString() : je.GetRawText();
        return v?.ToString();
    }

    private static int GetInt(Dictionary<string, object> args, string key, int defaultValue)
    {
        if (!args.TryGetValue(key, out var v))
            return defaultValue;

        if (v is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.Number)
            {
                // Use Int64 instead of Int32 to avoid InvalidOperationException on
                // numbers larger than int.MaxValue (e.g. min_size_mb=999999),
                // clamping the result back into the int range.
                if (je.TryGetInt64(out var longVal))
                    return (int)Math.Clamp(longVal, int.MinValue, int.MaxValue);
                return (int)Math.Round(je.GetDouble());
            }
            return long.TryParse(je.GetRawText(), out var n)
                ? (int)Math.Clamp(n, int.MinValue, int.MaxValue)
                : defaultValue;
        }
        if (v is int i) return i;
        if (v is long l) return (int)Math.Clamp(l, int.MinValue, int.MaxValue);
        if (v is double d) return (int)d;
        return int.TryParse(v.ToString(), out var parsed) ? parsed : defaultValue;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner?.Dispose();
    }
}
