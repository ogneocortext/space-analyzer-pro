// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A prioritized, actionable cleanup suggestion derived from a scan's largest
/// files and top directories (mirrors the Rust CLI's cleanup-recommendation logic).
/// </summary>
public class Recommendation
{
    /// <summary>1 = high, 2 = medium, 3 = low priority.</summary>
    public int Priority { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;

    /// <summary>Estimated reclaimable bytes for this action (0 when unknown).</summary>
    public ulong EstimatedSavingsBytes { get; set; }
    public string EstimatedSavingsDisplay =>
        EstimatedSavingsBytes > 0 ? ByteFormatter.FormatBytes(EstimatedSavingsBytes) : string.Empty;

    public string PriorityLabel => Priority switch
    {
        1 => "High",
        2 => "Medium",
        3 => "Low",
        _ => "—"
    };

    [System.Text.Json.Serialization.JsonIgnore]
    public bool HasSavings => EstimatedSavingsBytes > 0;
}

/// <summary>
/// A single bloat finding: a file or directory that matches a known bloat
/// pattern (large video, cache/temp, installer, AI model, dependency folder, …).
/// </summary>
public class BloatFinding
{
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public ulong Size { get; set; }
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
    public string Name => System.IO.Path.GetFileName(Path);
    public int Priority { get; set; }
}

/// <summary>
/// Linear-regression forecast of disk usage based on historical scan sizes.
/// </summary>
public class StoragePrediction
{
    public double CurrentSizeGb { get; set; }
    public double PredictedSizeGb { get; set; }
    public int DaysAhead { get; set; }
    public double GrowthRateGbPerDay { get; set; }
    public int ScansUsed { get; set; }
    public string FirstScan { get; set; } = string.Empty;
    public string LastScan { get; set; } = string.Empty;

    public string CurrentSizeDisplay => $"{CurrentSizeGb:F1} GB";
    public string PredictedSizeDisplay => $"{PredictedSizeGb:F1} GB";
    public string GrowthRateDisplay => $"{GrowthRateGbPerDay:F2} GB/day";
    public bool HasEnoughData => ScansUsed >= 2;
}
