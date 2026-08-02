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
    /// <summary>
    /// Per-file size and modification time. The Rust backend emits each entry as a
    /// JSON array <c>[size, mtime]</c>; <see cref="ScannedFileConverter"/> reads that
    /// into <see cref="ScannedFileEntry"/>. (System.Text.Json cannot deserialize JSON
    /// arrays into C# tuples, so a populated map would throw without the converter.)
    /// </summary>
    [JsonIgnore]
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
