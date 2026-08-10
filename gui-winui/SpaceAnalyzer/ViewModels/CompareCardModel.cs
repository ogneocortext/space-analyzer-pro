// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// A flattened, comparison-ready view of a scan history record used by the
/// multi-select comparison panel. Computes a delta against a baseline scan so
/// users can spot disk-usage regressions at a glance.
/// </summary>
public class CompareCardModel
{
    public ScanHistoryRecord Record { get; init; } = null!;
    public List<DirEntry> TopDirs { get; init; } = new();
    public List<ExtensionStat> TopTypes { get; init; } = new();

    public bool IsBaseline { get; init; }

    public bool HasTopDirs => TopDirs.Count > 0;
    public bool HasTopTypes => TopTypes.Count > 0;

    public string BaselineDisplay => IsBaseline ? "baseline" : string.Empty;

    public long DeltaSizeBytes { get; init; }
    public long DeltaFiles { get; init; }
    public double DeltaDurationSecs { get; init; }

    public string DeltaSizeDisplay => IsBaseline ? "baseline" : FormatDelta(DeltaSizeBytes);
    public string DeltaFilesDisplay => IsBaseline ? string.Empty : FormatSigned(DeltaFiles, "file");
    public string DeltaDurationDisplay => IsBaseline ? string.Empty : FormatSigned((long)DeltaDurationSecs, "s");

    private static string FormatSigned(long value, string unit)
    {
        if (value == 0) return string.Empty;
        return (value > 0 ? "+" : "") + value.ToString("N0") + unit;
    }

    private static string FormatDelta(long bytes)
    {
        var s = ByteFormatter.FormatBytes((ulong)Math.Abs(bytes));
        return (bytes >= 0 ? "+" : "−") + s;
    }
}
