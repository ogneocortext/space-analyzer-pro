// Licensed under the MIT License.

using System.Text.Json.Serialization;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Compact, chart-friendly projection of a scan-history row returned by the
/// Rust CLI <c>history --trend</c> subcommand. Carries only the fields the
/// "Size Trend" graph needs (id, path, timestamp, total size) so the UI can
/// plot every scan without pulling the heavy per-scan JSON payloads into memory.
/// </summary>
public class HistoryTrendPoint
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("path")]
    public string Path { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;

    [JsonPropertyName("total_size_bytes")]
    public ulong TotalSizeBytes { get; set; }
}
