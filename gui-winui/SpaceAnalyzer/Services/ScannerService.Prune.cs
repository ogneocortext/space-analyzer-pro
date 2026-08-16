// Licensed under the MIT License.
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ScannerService
{
    public async Task<(bool Success, int Removed, string Error)> PruneEmptyScansAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--prune-empty", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_empty", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("empty_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Remove scan records whose path is not absolute (e.g. relative "." scans)
    /// via <c>history --prune --drop-relative</c>. Returns the number removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneRelativeScansAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var caps = await GetCapabilitiesAsync(ct);
        if (!caps.HistoryDropRelative)
            return (false, 0, "Scanner does not support --drop-relative");
        var output = await RunScannerAsync(new[] { "history", "--prune", "--drop-relative", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("relative_path_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Recompute the per-category size breakdown for cached scans that predate
    /// the category column, using only the already-stored extension sizes.
    /// Returns the number of records back-filled.
    /// </summary>
    public async Task<(bool Success, int Updated, string Error)> BackfillCategoriesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var caps = await GetCapabilitiesAsync(ct);
        if (!caps.HistoryBackfillCategories)
            return (false, 0, "Scanner does not support --backfill-categories");
        var output = await RunScannerAsync(new[] { "history", "--backfill-categories", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("backfilled", out var ok) && ok.GetBoolean())
            {
                var updated = root.TryGetProperty("records_updated", out var u) ? u.GetInt32() : 0;
                return (true, updated, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected back-fill response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Remove per-scan file-cache rows whose directory no longer has any saved
    /// scan history (stale incremental-scan caches) via <c>db --prune-file-cache</c>.
    /// Returns the number of cache rows removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneFileCacheAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var caps = await GetCapabilitiesAsync(ct);
        if (!caps.DbPruneFileCache)
            return (false, 0, "Scanner does not support --prune-file-cache");
        var output = await RunScannerAsync(new[] { "db", "--prune-file-cache", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_file_cache", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("cache_rows_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Drop disk-space snapshots older than <paramref name="keepHours"/> via
    /// <c>db --prune-disk-space N</c>. Returns the number of snapshots removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneDiskSpaceAsync(int keepHours, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var caps = await GetCapabilitiesAsync(ct);
        if (!caps.DbPruneDiskSpace)
            return (false, 0, "Scanner does not support --prune-disk-space");
        var output = await RunScannerAsync(new[] { "db", "--prune-disk-space", keepHours.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_disk_space", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("disk_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Trim workflow execution history to the newest <paramref name="keep"/> records
    /// via <c>db --prune-workflows N</c>. Returns the number of records removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneWorkflowsAsync(int keep, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "db", "--prune-workflows", keep.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_workflows", out var pruned))
            {
                var removed = pruned.ValueKind == JsonValueKind.Number ? pruned.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Compact the embedded database (VACUUM) to reclaim space left by deleted
    /// rows. Returns true on success.
    /// </summary>
    public async Task<(bool Success, string Error)> VacuumDatabaseAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "db", "--vacuum", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("vacuumed", out var ok) && ok.GetBoolean())
                return (true, string.Empty);
            if (root.TryGetProperty("error", out var err))
                return (false, err.GetString() ?? "Unknown error");
            return (false, "Unexpected vacuum response");
        }
        catch (JsonException jex)
        {
            return (false, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Read database maintenance stats (free/total/used pages and per-table row
    /// counts) via <c>db --info</c>.
    /// </summary>
    public async Task<DatabaseInfo?> GetDatabaseInfoAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "db", "--info", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<DatabaseInfo>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse database info: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Delete ALL scan history records via <c>history --clear</c>. Destructive.
    /// Returns the number of records removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> ClearHistoryAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--clear", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("cleared", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected clear response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Remove duplicate scan records from history, keeping the newest entry per
    /// (path, total size, file count). Returns the prune outcome.
    /// </summary>
    public async Task<(bool Success, int DuplicatesRemoved, int RelativeRemoved, string Error)> PruneDuplicateScansAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--prune", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned", out var pruned) && pruned.GetBoolean())
            {
                var dup = root.TryGetProperty("duplicate_records_removed", out var d) ? d.GetInt32() : 0;
                var rel = root.TryGetProperty("relative_path_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, dup, rel, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, 0, err.GetString() ?? "Unknown error");
            return (false, 0, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, 0, $"Failed to parse prune result: {jex.Message}");
        }
    }

    /// <summary>
    /// Run node_modules cleanup analysis via the native cleaner binary.
    /// </summary>
}
