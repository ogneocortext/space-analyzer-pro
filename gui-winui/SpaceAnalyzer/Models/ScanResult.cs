// Licensed under the MIT License.

using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Result of a directory scan, deserialized from the Rust CLI's JSON output.
/// </summary>
public class ScanResult
{
    public long TotalFiles { get; set; }
    public ulong TotalSizeBytes { get; set; }
    public double TotalSizeMb { get; set; }
    public double DurationSecs { get; set; }
    public Dictionary<string, long> FileTypes { get; set; } = new();
    public Dictionary<string, ulong> ExtensionSizes { get; set; } = new();
    public List<FileSizeEntry> LargestFiles { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public string Path { get; set; } = string.Empty;
    public ulong TotalDirs { get; set; }
    public List<DirEntry> TopDirectories { get; set; } = new();
    public List<string> EmptyDirs { get; set; } = new();
    [JsonPropertyName("category_sizes")]
    public Dictionary<string, ulong> CategorySizes { get; set; } = new();
    [JsonPropertyName("potential_cleanup_bytes")]
    public ulong PotentialCleanupBytes { get; set; }
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;
    [JsonIgnore]
    public string PotentialCleanupDisplay => ByteFormatter.FormatBytes(PotentialCleanupBytes);
    /// <summary>
    /// Per-file size and modification time. The Rust backend emits each entry as a
    /// JSON array <c>[size, mtime]</c>; <see cref="ScannedFileConverter"/> reads that
    /// into <see cref="ScannedFileEntry"/>. (System.Text.Json cannot deserialize JSON
    /// arrays into C# tuples, so a populated map would throw without the converter.)
    /// </summary>
    // The Rust scanner emits `scanned_files` as a map of {path: [size, mtime]};
    // ScannedFileConverter reads each value into a ScannedFileEntry. This MUST be
    // deserialized: the Workflows page and Smart Search iterate it for per-file
    // matching, and without it those workflows return 0 results whenever the
    // scanner is available (they never fall back to the managed walk).
    [JsonPropertyName("scanned_files")]
    public Dictionary<string, ScannedFileEntry> ScannedFiles { get; set; } = new();
}

/// <summary>
/// A preset directory target for quick scanning from the ScanPage UI.
/// </summary>
public class QuickScanTarget
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string? Icon { get; set; }

    public override string ToString() => Name;
}

/// <summary>
/// A single file with its size, from the largest-files list.
/// </summary>
public class FileSizeEntry
{
    public string Path { get; set; } = string.Empty;
    public ulong Size { get; set; }
    [JsonIgnore]
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
    [JsonIgnore]
    public string Name => System.IO.Path.GetFileName(Path);
    /// <summary>
    /// File extension without the leading dot (e.g. "gz" not ".gz"), normalized to
    /// lower case so it matches the scanner's extension keys and the Largest Files /
    /// File Types tabs render consistently.
    /// </summary>
    [JsonIgnore]
    public string Extension => (System.IO.Path.GetExtension(Path) ?? string.Empty).TrimStart('.').ToLowerInvariant();
    [JsonIgnore]
    public string ParentPath => System.IO.Path.GetDirectoryName(Path) ?? string.Empty;
    /// <summary>
    /// Share of the largest file in the current view (0-100), used to render the
    /// size-proportion bar in the detail "Largest Files" list. Set by the view model.
    /// </summary>
    [JsonIgnore]
    public double Percent { get; set; }
    [JsonIgnore]
    public string PercentDisplay => $"{Percent:F0}%";
}

/// <summary>
/// A single directory entry with aggregated size and file/dir counts.
/// </summary>
public class DirEntry
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ulong TotalSize { get; set; }
    public ulong FileCount { get; set; }
    public ulong DirCount { get; set; }
    [JsonIgnore]
    public string SizeDisplay => ByteFormatter.FormatBytes(TotalSize);
    /// <summary>
    /// Share of the scanned root's total size (0-100), used for the size-proportion
    /// bar in the detail "Folders" list. Set by the view model.
    /// </summary>
    [JsonIgnore]
    public double Percent { get; set; }
    [JsonIgnore]
    public string PercentDisplay => $"{Percent:F1}%";
}

/// <summary>
/// Aggregated size for a single file extension, used by the history detail
/// view's "File Types" breakdown.
/// </summary>
public class ExtensionStat
{
    public string Extension { get; }
    public ulong Size { get; }
    public double Percent { get; }
    [JsonIgnore]
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
    [JsonIgnore]
    public string PercentDisplay => $"{Percent:F1}%";

    public ExtensionStat(string extension, ulong size, double percent)
    {
        Extension = string.IsNullOrWhiteSpace(extension) ? "(none)" : extension;
        Size = size;
        Percent = percent;
    }
}

/// <summary>
/// Aggregated storage usage for a high-level file category (Documents, Images,
/// Code, …), derived from a scan's per-extension sizes. Used by the history
/// detail "Overview" and "File Types" breakdowns.
/// </summary>
public class CategoryStat
{
    public string Category { get; }
    public ulong Size { get; }
    public double Percent { get; }
    [JsonIgnore]
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
    [JsonIgnore]
    public string PercentDisplay => $"{Percent:F1}%";

    public CategoryStat(string category, ulong size, double percent)
    {
        Category = category;
        Size = size;
        Percent = percent;
    }
}

/// <summary>
/// Size and modification time for a single scanned file. Deserialized from the
/// Rust backend's <c>[size, mtime]</c> JSON array via <see cref="ScannedFileConverter"/>.
/// </summary>
[JsonConverter(typeof(ScannedFileConverter))]
public class ScannedFileEntry
{
    public ulong Size { get; set; }
    public long Mtime { get; set; }
}

/// <summary>
/// Reads/writes <see cref="ScannedFileEntry"/> as a two-element JSON array
/// <c>[size, mtime]</c>, matching the Rust scanner's <c>scanned_files</c> wire format.
/// System.Text.Json cannot map JSON arrays onto C# tuples natively, so this converter
/// is required whenever the <c>scanned_files</c> map is populated.
/// </summary>
public sealed class ScannedFileConverter : JsonConverter<ScannedFileEntry>
{
    public override ScannedFileEntry? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        // ParseValue consumes the whole [size, mtime] array and advances the reader
        // correctly, avoiding manual token-positioning pitfalls.
        var element = JsonElement.ParseValue(ref reader);
        if (element.ValueKind != JsonValueKind.Array)
            throw new JsonException("Expected a [size, mtime] array for a scanned_files entry.");

        ulong size = 0;
        long mtime = 0;
        int index = 0;
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Number)
            {
                if (index == 0)
                    size = item.GetUInt64();
                else if (index == 1)
                    mtime = item.GetInt64();
            }
            index++;
        }
        return new ScannedFileEntry { Size = size, Mtime = mtime };
    }

    public override void Write(Utf8JsonWriter writer, ScannedFileEntry value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        writer.WriteNumberValue(value.Size);
        writer.WriteNumberValue(value.Mtime);
        writer.WriteEndArray();
    }
}
