// Licensed under the MIT License.

namespace SpaceAnalyzer.Models;

/// <summary>
/// Comparison of a single resource metric while the file scanner was running
/// versus while the system was idle. Used by the Dashboard "Scanner Impact" panel
/// to quantify how much the scanner cost in CPU / memory / GPU / disk.
/// </summary>
public sealed class ScanImpactInfo
{
    /// <summary>Average value (percent) across samples taken during a scan.</summary>
    public double DuringScan { get; init; }

    /// <summary>Average value (percent) across samples taken while no scan ran.</summary>
    public double Idle { get; init; }

    /// <summary>DuringScan minus Idle (percentage points).</summary>
    public double Delta => DuringScan - Idle;

    public string DuringDisplay => $"{DuringScan:F0}%";
    public string IdleDisplay => $"Idle {Idle:F0}%";
    public string DeltaDisplay => $"{(Delta >= 0 ? "+" : "")}{Delta:F0}pp";
}
