// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Groups multiple <see cref="ScanHistoryRecord"/> entries that share the same
/// scanned folder path. The list is ordered newest-first, so <c>Scans[0]</c>
/// is always the most recent scan of that folder.
/// </summary>
public class ScanFolderGroup
{
    /// <summary>Normalized folder path (trimmed, lower-cased for grouping).</summary>
    public string NormalizedPath { get; set; } = string.Empty;

    /// <summary>Display path shown in the UI.</summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>Leaf folder name, e.g. "Documents".</summary>
    public string LeafName { get; set; } = string.Empty;

    /// <summary>Parent path, e.g. "C:\Users\Aomega Imaging".</summary>
    public string ParentPath { get; set; } = string.Empty;

    /// <summary>All scans of this folder, newest first.</summary>
    public List<ScanHistoryRecord> Scans { get; set; } = new();

    /// <summary>Most recent scan.</summary>
    public ScanHistoryRecord LatestScan => Scans.Count > 0 ? Scans[0] : null!;

    /// <summary>Older scans, excluding the latest.</summary>
    public List<ScanHistoryRecord> OlderScans => Scans.Count > 1 ? Scans.Skip(1).ToList() : new List<ScanHistoryRecord>();

    /// <summary>Number of times this folder has been scanned.</summary>
    public int ScanCount => Scans.Count;

    /// <summary>Total bytes across every scan of this folder.</summary>
    public ulong TotalSizeBytesAcrossScans => Scans.Aggregate(0UL, (acc, r) => acc + r.TotalSizeBytes);

    /// <summary>Total files across every scan of this folder.</summary>
    public long TotalFilesAcrossScans => Scans.Aggregate(0L, (acc, r) => acc + r.TotalFiles);

    /// <summary>Date range text, e.g. "2026-08-01 → 2026-08-17".</summary>
    public string DateRangeDisplay
    {
        get
        {
            if (Scans.Count == 0) return "No scans";
            var first = Scans[Scans.Count - 1].ScanDate;
            var last = Scans[0].ScanDate;
            if (first == last) return first.ToString("yyyy-MM-dd");
            return $"{first:yyyy-MM-dd} → {last:yyyy-MM-dd}";
        }
    }

    /// <summary>Human-friendly age of the latest scan.</summary>
    public string LatestScanAge => LatestScan.RelativeDateDisplay;

    /// <summary>Size of the latest scan, formatted.</summary>
    public string LatestSizeDisplay => LatestScan.TotalSizeDisplay;

    /// <summary>File count of the latest scan, formatted.</summary>
    public string LatestFilesDisplay => LatestScan.FilesDisplay;

    /// <summary>True when this folder has been scanned more than once.</summary>
    public bool HasMultipleScans => Scans.Count > 1;
}
