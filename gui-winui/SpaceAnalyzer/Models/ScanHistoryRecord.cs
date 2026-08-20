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
    public string CategorySizesJson { get; set; } = string.Empty;
    public bool DeepScan { get; set; }
    public bool ShallowScan { get; set; }
    public int MaxScanDepth { get; set; } = 5;
    public ulong PotentialCleanupBytes { get; set; }
    public string Timestamp { get; set; } = string.Empty;

    /// <summary>
    /// True when this row exists only to anchor a semantic-embedding index
    /// (created by the <c>embed</c> CLI with no real scan). Such rows are
    /// hidden from the History UI so they don't pollute the scan list.
    /// </summary>
    public bool IsIndexOnly { get; set; }

    private Dictionary<string, long>? _fileTypes;
    public Dictionary<string, long> FileTypes => _fileTypes ??= JsonSerializer.Deserialize<Dictionary<string, long>>(FileTypesJson, ScannerJsonOptions) ?? new();

    private Dictionary<string, ulong>? _extensionSizes;
    public Dictionary<string, ulong> ExtensionSizes => _extensionSizes ??= JsonSerializer.Deserialize<Dictionary<string, ulong>>(ExtensionSizesJson, ScannerJsonOptions) ?? new();

    private List<DirEntry>? _topDirectories;
    public List<DirEntry> TopDirectories => _topDirectories ??= JsonSerializer.Deserialize<List<DirEntry>>(TopDirectoriesJson, ScannerJsonOptions) ?? new();

    private List<FileSizeEntry>? _largestFiles;
    public List<FileSizeEntry> LargestFiles => _largestFiles ??= JsonSerializer.Deserialize<List<FileSizeEntry>>(LargestFilesJson, ScannerJsonOptions) ?? new();

    private Dictionary<string, ulong>? _categorySizes;
    public Dictionary<string, ulong> CategorySizes => _categorySizes ??= JsonSerializer.Deserialize<Dictionary<string, ulong>>(CategorySizesJson, ScannerJsonOptions) ?? new();

    private static readonly JsonSerializerOptions ScannerJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    /// <summary>Folder name (last path segment) for prominent display in the list.</summary>
    public string LeafName
    {
        get
        {
            if (string.IsNullOrWhiteSpace(Path)) return "(unknown)";
            var trimmed = Path.TrimEnd('\\', '/');
            var idx = Math.Max(trimmed.LastIndexOf('\\'), trimmed.LastIndexOf('/'));
            return idx < 0 ? trimmed : trimmed[(idx + 1)..];
        }
    }

    /// <summary>Parent path (everything before the folder name), shown as secondary text.</summary>
    public string ParentPath
    {
        get
        {
            if (string.IsNullOrWhiteSpace(Path)) return string.Empty;
            var trimmed = Path.TrimEnd('\\', '/');
            var idx = Math.Max(trimmed.LastIndexOf('\\'), trimmed.LastIndexOf('/'));
            return idx < 0 ? string.Empty : trimmed[..idx];
        }
    }

    /// <summary>Human-friendly relative age, e.g. "just now", "3d ago", "2mo ago".</summary>
    public string RelativeDateDisplay
    {
        get
        {
            if (ScanDate == DateTime.MinValue) return "Unknown";
            var diff = DateTime.Now - ScanDate;
            if (diff.TotalSeconds < 60) return "just now";
            if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes}m ago";
            if (diff.TotalHours < 24) return $"{(int)diff.TotalHours}h ago";
            if (diff.TotalDays < 2) return "yesterday";
            if (diff.TotalDays < 7) return $"{(int)diff.TotalDays}d ago";
            if (diff.TotalDays < 30) return $"{(int)(diff.TotalDays / 7)}w ago";
            if (diff.TotalDays < 365) return $"{(int)(diff.TotalDays / 30)}mo ago";
            return $"{(int)(diff.TotalDays / 365)}y ago";
        }
    }

    /// <summary>Largest category by byte size (null when no category data).</summary>
    public string? TopCategory
    {
        get
        {
            string? best = null;
            ulong bestSize = 0;
            foreach (var kv in CategorySizes)
            {
                if (kv.Value > bestSize) { bestSize = kv.Value; best = kv.Key; }
            }
            return best;
        }
    }

    public bool HasCategory => TopCategory != null;
    public string TopCategoryDisplay => TopCategory ?? "No categories";

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

    /// <summary>
    /// Short, badge-friendly scan-type label derived from <see cref="DepthDisplay"/>:
    /// "Deep", "Shallow", "Custom", or "Default". Used for the color-coded type pill.
    /// </summary>
    public string ScanTypeShort
    {
        get
        {
            if (DeepScan) return "Deep";
            if (ShallowScan) return "Shallow";
            if (MaxScanDepth != 5) return "Custom";
            return "Default";
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
    public bool HasPotentialCleanup => PotentialCleanupBytes > 0;

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
