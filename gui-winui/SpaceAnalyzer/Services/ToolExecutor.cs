// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SpaceAnalyzer.Services;

/// <summary>
/// Executes Ollama tool calls by delegating to the Rust CLI (scan, disk-info,
/// history, dedup) or native C# for simple filesystem operations.
/// </summary>
public class ToolExecutor : IDisposable
{
    private readonly ScannerService _scanner;
    private bool _disposed;

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
    /// </summary>
    public async Task<string> ExecuteAsync(string toolName, Dictionary<string, object> arguments, CancellationToken ct = default)
    {
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
                "search_files" => await SearchFilesAsync(arguments, ct),
                "get_largest_files" => await GetLargestFilesAsync(arguments, ct),
                "run_scan" => await RunScanAsync(arguments, ct),
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
            new { name = "deep_clean", description = "Deep scan + cleanup recommendations for a directory" },
            new { name = "quick_check", description = "Shallow scan to quickly check disk usage" },
            new { name = "find_duplicates", description = "Duplicate file analysis" },
            new { name = "monitor_growth", description = "Scan and compare with history to detect growth" },
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

        double slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        double intercept = (sumY - slope * sumX) / n;

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
        var dedupOutput = await RunCliAsync("dedup --path \".\" --format json", ct);
        return string.IsNullOrWhiteSpace(dedupOutput)
            ? "No pattern analysis available."
            : dedupOutput;
    }

    private async Task<string> SearchFilesAsync(Dictionary<string, object> args, CancellationToken ct)
    {
        var (records, _) = await _scanner.GetScanHistoryPageAsync(limit: 1, ct: ct);
        if (records.Count == 0)
            return "No scan results available.";

        var extension = GetOptionalString(args, "extension");
        var keyword = GetOptionalString(args, "keyword");
        var limit = GetInt(args, "limit", 20);

        var scanArgs = $"scan --path \"{records[0].Path}\" --format json --top {limit}";
        var scanOutput = await RunCliAsync(scanArgs, ct);

        if (string.IsNullOrWhiteSpace(scanOutput))
            return "Scan returned no results.";

        try
        {
            using var doc = JsonDocument.Parse(scanOutput);
            if (!doc.RootElement.TryGetProperty("largest_files", out var files))
                return "No large files in scan output.";

            var results = files.EnumerateArray()
                .Select(f => new
                {
                    path = f.TryGetProperty("path", out var p) ? p.GetString() : "",
                    size_mb = f.TryGetProperty("size", out var s) && s.ValueKind == JsonValueKind.Number ? Math.Round(s.GetInt64() / (1024.0 * 1024), 2) : 0,
                });

            if (!string.IsNullOrEmpty(extension))
                results = results.Where(r => r.path != null && r.path.EndsWith("." + extension, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrEmpty(keyword))
                results = results.Where(r => r.path != null && r.path.Contains(keyword, StringComparison.OrdinalIgnoreCase));

            return JsonSerializer.Serialize(results.Take(limit).ToList(), s_json);
        }
        catch
        {
            return "Failed to parse scan results for file search.";
        }
    }

    private async Task<string> GetLargestFilesAsync(Dictionary<string, object> args, CancellationToken ct)
    {
        var (records, _) = await _scanner.GetScanHistoryPageAsync(limit: 1, ct: ct);
        if (records.Count == 0)
            return "No scan results available.";

        var count = GetInt(args, "count", 20);
        var scanArgs = $"scan --path \"{records[0].Path}\" --format json";
        var output = await RunCliAsync(scanArgs, ct);
        if (string.IsNullOrWhiteSpace(output))
            return "No results.";

        try
        {
            using var doc = JsonDocument.Parse(output);
            if (!doc.RootElement.TryGetProperty("largest_files", out var files))
                return "No large files in scan output.";

            var results = files.EnumerateArray()
                .Select(f => new
                {
                    path = f.TryGetProperty("path", out var p) ? p.GetString() : "",
                    size_mb = f.TryGetProperty("size", out var s) && s.ValueKind == JsonValueKind.Number
                        ? Math.Round(s.GetInt64() / (1024.0 * 1024), 2) : 0,
                })
                .Take(count)
                .ToList();

            return JsonSerializer.Serialize(results, s_json);
        }
        catch
        {
            return "Failed to parse scan results for largest files.";
        }
    }

    private async Task<string> RunScanAsync(Dictionary<string, object> args, CancellationToken ct)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path))
            return "Error: path is required";

        if (!Directory.Exists(path))
            return $"Error: directory not found: {path}";

        var deep = args.TryGetValue("deep", out var deepVal)
            && (deepVal is bool b ? b : deepVal?.ToString()?.ToLower() == "true");

        var mode = deep
            ? ScannerService.DepthMode.Deep
            : ScannerService.DepthMode.Default;

        var result = await _scanner.ScanDirectoryAsync(path, mode, ct: ct);
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

    // ── Helpers ──

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
            return "Operation timed out.";
        }

        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);

        if (process.ExitCode != 0)
            return $"Error: {stderr}";

        return stdout;
    }

    private static string GetString(Dictionary<string, object> args, string key)
        => args.TryGetValue(key, out var v) ? v.ToString() ?? "" : "";

    private static string? GetOptionalString(Dictionary<string, object> args, string key)
        => args.TryGetValue(key, out var v) ? v.ToString() : null;

    private static int GetInt(Dictionary<string, object> args, string key, int defaultValue)
    {
        if (args.TryGetValue(key, out var v))
        {
            if (v is JsonElement je)
                return je.ValueKind == JsonValueKind.Number ? je.GetInt32() : int.TryParse(je.GetRawText(), out var n) ? n : defaultValue;
            if (v is int i) return i;
            if (v is long l) return (int)l;
            if (v is double d) return (int)d;
            if (int.TryParse(v.ToString(), out var parsed)) return parsed;
        }
        return defaultValue;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
    }
}
