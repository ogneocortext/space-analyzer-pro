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
                .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime < cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime.ToString("o") })
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
                .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime >= cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime.ToString("o") })
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
                files = files.Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime >= start.Value);
            if (end.HasValue)
                files = files.Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime <= end.Value);

            var list = files
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime.ToString("o") })
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
                .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime < cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime.ToString("o") })
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
                .Where(kvp => (long)kvp.Value.Size >= minBytes || DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime < cutoff)
                .Select(kvp => new { path = kvp.Key, name = Path.GetFileName(kvp.Key), size_bytes = kvp.Value.Size, size_display = ByteFormatter.FormatBytes(kvp.Value.Size), last_modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime.ToString("o") })
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
            limit: 50, search: path, sortBy: "timestamp", sortAsc: false, includeIndexOnly: true, ct: ct);

        return records.FirstOrDefault(r => NormalizePath(r.Path) == target);
    }

}
