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
public partial class ToolExecutor : IDisposable
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
                "preview_impact" => await PreviewImpactAsync(GetString(arguments, "path"), ct),
                // NOTE: `move_to_trash` and `hardlink_duplicates` are intentionally
                // NOT exposed to the autonomous agentic loop (see GetToolDefinitions
                // in AIAssistantViewModel). Project policy keeps destructive
                // filesystem changes on hold; these remain callable for explicit,
                // user-initiated UI actions only.
                "move_to_trash" => await MoveToTrashAsync(GetString(arguments, "path"), ct),
                "hardlink_duplicates" => await HardlinkDuplicatesAsync(GetString(arguments, "path"), ct),
                "get_scan_summary" => await GetScanSummaryAsync(ct),
                "get_file_type_breakdown" => await GetFileTypeBreakdownAsync(ct),
                "analyze_file_patterns" => await AnalyzeFilePatternsAsync(ct),
                "search_files" => await SearchFilesAsync(arguments, ct, progress),
                "semantic_search" => await SemanticSearchFilesAsync(arguments, ct, progress),
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
            // Report real system memory, not the managed GC heap. Total physical
            // memory comes from GC.GetGCMemoryInfo(); available memory comes from
            // the OS performance counter, so used = total - available.
            var totalMemory = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
            long availableBytes;
            try
            {
                var availCounter = new PerformanceCounter("Memory", "Available MBytes");
                availableBytes = (long)availCounter.NextValue() * 1024L * 1024L;
            }
            catch
            {
                availableBytes = -1;
            }

            var usedMemory = availableBytes >= 0 && totalMemory > availableBytes
                ? totalMemory - availableBytes
                : 0;
            data["total_memory_bytes"] = totalMemory;
            data["available_memory_bytes"] = availableBytes;
            data["used_memory_bytes"] = usedMemory;
            data["memory_usage_percent"] = totalMemory > 0 && availableBytes >= 0
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

    private static async Task<string> PreviewImpactAsync(string path, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
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
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            psi.ArgumentList.Add("hardlink");
            psi.ArgumentList.Add("list");
            psi.ArgumentList.Add(path);
            using var process = new Process { StartInfo = psi };
            process.Start();
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
            await process.WaitForExitAsync(linkedCts.Token);
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

    private static async Task<string> MoveToTrashAsync(string path, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(path))
            return "Error: path is required";

        if (!File.Exists(path))
            return $"Error: file not found: {path}";

        var info = new FileInfo(path);
        bool moved = FileOperations.SendToRecycleBin(info.FullName);
        return JsonSerializer.Serialize(new
        {
            path = info.FullName,
            size_mb = Math.Round(info.Length / (1024.0 * 1024), 2),
            moved_to_recycle_bin = moved,
            note = moved
                ? "Moved to the Recycle Bin. You can restore it from there, or empty the Recycle Bin to reclaim the space."
                : "Could not move to the Recycle Bin; nothing was deleted."
        }, s_json);
    }

    private async Task<string> HardlinkDuplicatesAsync(string path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path))
            return "Error: path is required";

        if (!Directory.Exists(path))
            return $"Error: directory not found: {path}";

        // Apply hard-links now (the backend requires --yes for non-interactive
        // apply, and refuses to modify files without it). Hard-linking never
        // deletes data — identical copies collapse to one inode and the reclaimed
        // space is reported in the result. This mutates the filesystem, so it is
        // only invoked for explicit, user-initiated actions (not the autonomous
        // agentic loop).
        var dedupOutput = await RunCliAsync(new[] { "dedup", "--path", path, "--apply", "--yes", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(dedupOutput))
            return "No duplicate analysis available.";

        return dedupOutput;
    }

    // ── Scan-dependent tools ──

}
