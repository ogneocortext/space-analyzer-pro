// Licensed under the MIT License.

using System.Collections.Generic;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Database maintenance statistics returned by the Rust CLI <c>db --info</c>
/// subcommand. Used by the History page's cache-management panel.
/// </summary>
public class DatabaseInfo
{
    [JsonPropertyName("free_pages")]
    public long FreePages { get; set; }

    [JsonPropertyName("page_size")]
    public long PageSize { get; set; }

    [JsonPropertyName("total_pages")]
    public long TotalPages { get; set; }

    [JsonPropertyName("used_pages")]
    public long UsedPages { get; set; }

    [JsonPropertyName("row_counts")]
    public Dictionary<string, long> RowCounts { get; set; } = new();

    /// <summary>Number of scan-history records currently stored.</summary>
    public long TotalScans => RowCounts.TryGetValue("scan_history", out var v) ? v : 0;

    /// <summary>Number of per-scan incremental file-cache rows.</summary>
    public long FileCacheEntries => RowCounts.TryGetValue("file_cache", out var v) ? v : 0;

    /// <summary>Number of semantic-search embeddings stored.</summary>
    public long Embeddings => RowCounts.TryGetValue("file_embeddings", out var v) ? v : 0;

    /// <summary>Approximate on-disk size of the database in bytes.</summary>
    public long SizeBytes => TotalPages * PageSize;

    /// <summary>Human-readable summary for the cache-management panel.</summary>
    public string Summary
    {
        get
        {
            var size = ByteFormatter.FormatBytes((ulong)SizeBytes);
            var free = ByteFormatter.FormatBytes((ulong)(FreePages * PageSize));
            var parts = new System.Collections.Generic.List<string> { $"{TotalScans} scans" };
            if (FileCacheEntries > 0)
                parts.Add($"{FileCacheEntries} cached files");
            parts.Add($"{size} on disk");
            parts.Add($"{free} reclaimable");
            return string.Join(" · ", parts);
        }
    }
}
