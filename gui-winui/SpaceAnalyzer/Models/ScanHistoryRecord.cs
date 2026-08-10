// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single scan-history entry returned by the Rust CLI <c>history</c> subcommand.
/// </summary>
public class ScanHistoryRecord
{
    public long Id { get; set; }
    public string Path { get; set; } = string.Empty;
    public long TotalFiles { get; set; }
    public ulong TotalSizeBytes { get; set; }
    public double TotalSizeMb { get; set; }
    public double DurationSecs { get; set; }
    public string FileTypesJson { get; set; } = string.Empty;
    public string ExtensionSizesJson { get; set; } = string.Empty;
    public string TopDirectoriesJson { get; set; } = string.Empty;
    public string LargestFilesJson { get; set; } = string.Empty;
    public bool DeepScan { get; set; }
    public bool ShallowScan { get; set; }
    public int MaxScanDepth { get; set; } = 5;
    public ulong PotentialCleanupBytes { get; set; }
    public string Timestamp { get; set; } = string.Empty;

    private Dictionary<string, long>? _fileTypes;
    public Dictionary<string, long> FileTypes => _fileTypes ??= JsonSerializer.Deserialize<Dictionary<string, long>>(FileTypesJson, ScannerJsonOptions) ?? new();

    private Dictionary<string, ulong>? _extensionSizes;
    public Dictionary<string, ulong> ExtensionSizes => _extensionSizes ??= JsonSerializer.Deserialize<Dictionary<string, ulong>>(ExtensionSizesJson, ScannerJsonOptions) ?? new();

    private List<DirEntry>? _topDirectories;
    public List<DirEntry> TopDirectories => _topDirectories ??= JsonSerializer.Deserialize<List<DirEntry>>(TopDirectoriesJson, ScannerJsonOptions) ?? new();

    private List<FileSizeEntry>? _largestFiles;
    public List<FileSizeEntry> LargestFiles => _largestFiles ??= JsonSerializer.Deserialize<List<FileSizeEntry>>(LargestFilesJson, ScannerJsonOptions) ?? new();

    private static readonly JsonSerializerOptions ScannerJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public string DepthDisplay
    {
        get
        {
            if (DeepScan) return "Deep (unlimited)";
            if (ShallowScan) return "Shallow (depth 1)";
            if (MaxScanDepth != 5) return $"Custom (depth {MaxScanDepth})";
            return "Default (depth 5)";
        }
    }

    public DateTime ScanDate
    {
        get
        {
            if (DateTime.TryParse(Timestamp, out var parsed))
                return parsed.ToLocalTime();
            return DateTime.MinValue;
        }
    }
    public string DateDisplay => ScanDate == DateTime.MinValue ? "Unknown" : ScanDate.ToString("yyyy-MM-dd HH:mm");
    public string TotalSizeDisplay => ByteFormatter.FormatBytes(TotalSizeBytes);
    public string DurationDisplay => $"{(int)DurationSecs / 60}m {(int)DurationSecs % 60}s";
    public string FilesDisplay => $"{TotalFiles:N0} files";
    public string PotentialCleanupDisplay => ByteFormatter.FormatBytes(PotentialCleanupBytes);

    /// <summary>
    /// Transient UI flag: true when this record's directory also appears
    /// elsewhere in the currently loaded history view (i.e. it is a redundant
    /// scan). Not serialized.
    /// </summary>
    [JsonIgnore]
    public bool IsDuplicateView { get; set; }

    /// <summary>
    /// Transient UI flag: true when this record is ticked for multi-select
    /// comparison. Not serialized.
    /// </summary>
    [JsonIgnore]
    public bool IsCompareSelected { get; set; }
}

/// <summary>
/// Paginated response from the Rust CLI <c>history</c> subcommand with search/sort.
/// </summary>
public class ScanHistoryPageResult
{
    public List<ScanHistoryRecord> Records { get; set; } = new();
    public long Total { get; set; }
    public long Limit { get; set; }
    public long Offset { get; set; }
}
