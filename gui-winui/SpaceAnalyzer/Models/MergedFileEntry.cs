// Licensed under the MIT License.

using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single file projected from the union of every per-scan file cache — the
/// "centralized file inventory" the History page searches and analyzes. The same
/// <see cref="FilePath"/> may appear in several scans (under different source
/// roots), so this is the deduplicated view: the newest size and mtime seen
/// across scans, how many distinct scans observed it, and the comma-joined
/// source scan roots. Returned by the Rust CLI <c>history --files</c> subcommand.
/// </summary>
public class MergedFileEntry
{
    [JsonPropertyName("file_path")]
    public string FilePath { get; set; } = string.Empty;

    [JsonPropertyName("size_bytes")]
    public ulong SizeBytes { get; set; }

    [JsonPropertyName("mtime_unix")]
    public long MtimeUnix { get; set; }

    [JsonPropertyName("extension")]
    public string Extension { get; set; } = string.Empty;

    [JsonPropertyName("scan_count")]
    public int ScanCount { get; set; }

    [JsonPropertyName("source_paths")]
    public string SourcePaths { get; set; } = string.Empty;

    public string SizeDisplay => ByteFormatter.FormatBytes(SizeBytes);

    public string LeafName
    {
        get
        {
            if (string.IsNullOrEmpty(FilePath)) return string.Empty;
            var idx = FilePath.Replace('/', '\\').TrimEnd('\\').LastIndexOf('\\');
            return idx >= 0 ? FilePath[(idx + 1)..] : FilePath;
        }
    }

    public string MtimeDisplay
    {
        get
        {
            if (MtimeUnix <= 0) return "—";
            var dt = DateTimeOffset.FromUnixTimeSeconds(MtimeUnix).LocalDateTime;
            return dt.ToString("yyyy-MM-dd HH:mm");
        }
    }

    public string ScanCountDisplay => ScanCount == 1 ? "1 scan" : $"{ScanCount} scans";
}
