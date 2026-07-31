// Licensed under the MIT License.

using System;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single scan-history entry returned by the Rust CLI <c>history</c> subcommand.
/// </summary>
public class ScanHistoryRecord
{
    public long Id { get; set; }
    public string Path { get; set; } = string.Empty;
    public int TotalFiles { get; set; }
    public ulong TotalSizeBytes { get; set; }
    public double TotalSizeMb { get; set; }
    public double DurationSecs { get; set; }
    public string FileTypesJson { get; set; } = string.Empty;
    public string ExtensionSizesJson { get; set; } = string.Empty;
    public string TopDirectoriesJson { get; set; } = string.Empty;
    public string LargestFilesJson { get; set; } = string.Empty;
    public bool DeepScan { get; set; }
    public ulong PotentialCleanupBytes { get; set; }
    public string Timestamp { get; set; } = string.Empty;

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
}
