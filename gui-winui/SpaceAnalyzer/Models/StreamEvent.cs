// Licensed under the MIT License.

using System.Text.Json.Serialization;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Mirrors the Rust CLI's StreamEvent::Progress JSONL envelope.
/// Emitted periodically during a streaming scan with cumulative stats
/// and a batch of live files discovered since the scan started.
/// </summary>
public class StreamProgress
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "progress";

    [JsonPropertyName("files_scanned")]
    public ulong FilesScanned { get; set; }

    [JsonPropertyName("directories_scanned")]
    public ulong DirectoriesScanned { get; set; }

    [JsonPropertyName("total_size")]
    public ulong TotalSize { get; set; }

    [JsonPropertyName("percentage")]
    public float Percentage { get; set; }

    [JsonPropertyName("current_file")]
    public string CurrentFile { get; set; } = string.Empty;

    [JsonPropertyName("live_files")]
    public List<LiveFileEntry> LiveFiles { get; set; } = new();

    [JsonPropertyName("file_types")]
    public Dictionary<string, ulong> FileTypes { get; set; } = new();

    [JsonPropertyName("extension_sizes")]
    public Dictionary<string, ulong> ExtensionSizes { get; set; } = new();

    [JsonPropertyName("category_sizes")]
    public Dictionary<string, ulong> CategorySizes { get; set; } = new();
}

/// <summary>
/// A single file reported in a streaming progress batch.
/// </summary>
public class LiveFileEntry
{
    [JsonPropertyName("path")]
    public string Path { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("size")]
    public ulong Size { get; set; }

    [JsonPropertyName("extension")]
    public string Extension { get; set; } = string.Empty;
}

/// <summary>
/// Mirrors the Rust CLI's StreamEvent::Complete JSONL envelope.
/// Emitted once at the end of a streaming scan with the full result.
/// </summary>
public class StreamComplete
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "complete";

    [JsonPropertyName("total_files")]
    public int TotalFiles { get; set; }

    [JsonPropertyName("total_size_bytes")]
    public ulong TotalSizeBytes { get; set; }

    [JsonPropertyName("total_size_mb")]
    public double TotalSizeMb { get; set; }

    [JsonPropertyName("duration_secs")]
    public double DurationSecs { get; set; }

    // Long (not int): the Rust CLI emits per-type byte totals as u64. An int
    // here would overflow on large directories and throw during JSON parsing,
    // which the streaming reader swallows — silently dropping the final result.
    [JsonPropertyName("file_types")]
    public Dictionary<string, long> FileTypes { get; set; } = new();

    [JsonPropertyName("extension_sizes")]
    public Dictionary<string, ulong> ExtensionSizes { get; set; } = new();

    [JsonPropertyName("largest_files")]
    public List<FileSizeEntry> LargestFiles { get; set; } = new();

    [JsonPropertyName("errors")]
    public List<string> Errors { get; set; } = new();

    [JsonPropertyName("path")]
    public string Path { get; set; } = string.Empty;

    [JsonPropertyName("total_dirs")]
    public ulong TotalDirs { get; set; }

    [JsonPropertyName("top_directories")]
    public List<DirEntry> TopDirectories { get; set; } = new();

    [JsonPropertyName("empty_dirs")]
    public List<string> EmptyDirs { get; set; } = new();

    [JsonPropertyName("category_sizes")]
    public Dictionary<string, ulong> CategorySizes { get; set; } = new();

    [JsonPropertyName("potential_cleanup_bytes")]
    public ulong PotentialCleanupBytes { get; set; }

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;
}
