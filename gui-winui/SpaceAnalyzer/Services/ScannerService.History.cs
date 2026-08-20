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
    public async Task<List<ScanHistoryRecord>> GetScanHistoryAsync(int limit = 50, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new List<ScanHistoryRecord>();

        var output = await RunScannerAsync(new[] { "history", "--limit", limit.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new();
        try
        {
            // Handle both old (array) and new (paginated object) response formats
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<ScanHistoryRecord>>(output, s_jsonOptions) ?? new();
            if (doc.RootElement.TryGetProperty("records", out var records))
                return records.Deserialize<List<ScanHistoryRecord>>(s_jsonOptions) ?? new();
            return new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan history: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get scan history with pagination, search, and sort support.
    /// Returns (records, totalCount).
    /// </summary>
    public async Task<(List<ScanHistoryRecord> Records, long Total)> GetScanHistoryPageAsync(
        int limit = 50,
        int offset = 0,
        string? search = null,
        string sortBy = "timestamp",
        bool sortAsc = false,
        bool onlyDuplicates = false,
        bool includeIndexOnly = false,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (new(), 0);

        // Only forward columns the CLI actually accepts; an invalid --sort-by silently
        // falls back to a default on the server and would make the UI sort indicator lie.
        var allowedSort = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "timestamp", "path", "total_size_bytes", "total_files",
        };
        var effectiveSortBy = allowedSort.Contains(sortBy) ? sortBy : "timestamp";

        var caps = await GetCapabilitiesAsync(ct);
        var argList = new List<string> { "history", "--limit", limit.ToString(), "--offset", offset.ToString() };
        if (caps.HistorySortBy)
        {
            argList.Add("--sort-by");
            argList.Add(effectiveSortBy);
            if (sortAsc) argList.Add("--sort-asc");
        }
        if (caps.HistorySearch && !string.IsNullOrWhiteSpace(search)) { argList.Add("--search"); argList.Add(search); }
        if (caps.HistoryOnlyDuplicates && onlyDuplicates) argList.Add("--only-duplicates");
        if (includeIndexOnly) argList.Add("--include-index-only");

        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (new(), 0);
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("records", out var recordsProp)
                && doc.RootElement.TryGetProperty("total", out var totalProp))
            {
                var records = recordsProp.Deserialize<List<ScanHistoryRecord>>(s_jsonOptions) ?? new();
                return (records, totalProp.GetInt64());
            }
            // Fallback: treat as plain array
            var fallback = JsonSerializer.Deserialize<List<ScanHistoryRecord>>(output, s_jsonOptions) ?? new();
            return (fallback, fallback.Count);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan history page: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get the lightweight chronological series of every scan (id, path,
    /// timestamp, size) for the "Size Trend" graph. This is independent of the
    /// paginated <see cref="History"/> list so the chart stays stable across
    /// page turns and searches.
    /// </summary>
    public async Task<List<HistoryTrendPoint>> GetScanHistoryTrendAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new();

        var output = await RunScannerAsync(new[] { "history", "--trend", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new();
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<HistoryTrendPoint>>(output, s_jsonOptions) ?? new();
            return new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan trend: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Aggregate the per-category size breakdown across every scan-history record
    /// (the backend sums each record's <c>category_sizes_json</c>). Returns a flat
    /// category -&gt; bytes map used by the History page "Library Composition" donut.
    /// </summary>
    public async Task<Dictionary<string, ulong>> GetCategoryHistoryAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new Dictionary<string, ulong>();

        var caps = await GetCapabilitiesAsync(ct);
        if (!caps.HistoryCategoryTotals)
            return new Dictionary<string, ulong>();
        var output = await RunScannerAsync(new[] { "history", "--category-totals", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new Dictionary<string, ulong>();

        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                var dict = new Dictionary<string, ulong>(StringComparer.OrdinalIgnoreCase);
                foreach (var prop in doc.RootElement.EnumerateObject())
                    if (prop.Value.TryGetUInt64(out var v))
                        dict[prop.Name] = v;
                return dict;
            }
            return new Dictionary<string, ulong>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse category history: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get full details for a single scan by ID.
    /// </summary>
    public async Task<ScanHistoryRecord?> GetScanDetailsAsync(long id, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "history", "--id", id.ToString(), "--format", "json" }, ct);
        // "No scan found with id X" is printed to stderr with empty stdout; treat that as
        // a missing record rather than a parse error.
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<ScanHistoryRecord>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan details: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get the stored duplicate-file analyses for a scan by ID. Returns an empty
    /// list when the scan has no linked analysis (or the backend lacks support).
    /// The CLI emits a JSON array of <see cref="DuplicateAnalysisRecord"/>.
    /// </summary>
    public async Task<List<DuplicateAnalysisRecord>> GetDuplicateAnalysisAsync(long scanId, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new List<DuplicateAnalysisRecord>();

        var caps = await GetCapabilitiesAsync(ct);
        if (!caps.HistoryDuplicateAnalysis)
            return new List<DuplicateAnalysisRecord>();

        var output = await RunScannerAsync(new[] { "history", "--id", scanId.ToString(), "--duplicates", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new List<DuplicateAnalysisRecord>();
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<DuplicateAnalysisRecord>>(output, s_jsonOptions) ?? new List<DuplicateAnalysisRecord>();
            return new List<DuplicateAnalysisRecord>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse duplicate analysis: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Delete a scan record by ID.
    /// </summary>
    public async Task<bool> DeleteScanAsync(long id, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return false;

        try
        {
            var output = await RunScannerAsync(new[] { "history", "--delete", id.ToString(), "--yes", "--format", "json" }, ct);
            if (string.IsNullOrWhiteSpace(output))
                return false;
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("deleted", out var deleted))
                return deleted.GetBoolean();
            return false;
        }
        catch
        {
            return false;
        }
    }
}
