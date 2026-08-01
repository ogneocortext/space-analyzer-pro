// Licensed under the MIT License.

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Centralized byte-size formatting used across all ViewModels and Models.
/// Replaces the four hand-rolled copies that previously existed in
/// <c>ByteFormatter</c>, <c>DiskVolume</c>, <c>ScanHistoryRecord</c>,
/// and inline in <c>DashboardViewModel</c>.
/// </summary>
public static class ByteFormatter
{
    private static readonly string[] s_units = ["B", "KB", "MB", "GB", "TB", "PB"];

    /// <summary>
    /// Format a byte count as a human-readable string, e.g. <c>1.5 GB</c>.
    /// </summary>
    public static string FormatBytes(ulong bytes)
    {
        double size = bytes;
        int unit = 0;
        while (size >= 1024 && unit < s_units.Length - 1)
        {
            size /= 1024;
            unit++;
        }

        return unit == 0
            ? $"{size:F0} {s_units[unit]}"
            : $"{size:F1} {s_units[unit]}";
    }

    /// <summary>
    /// Format a signed byte count as a human-readable string.
    /// Negative values are treated as zero.
    /// </summary>
    public static string FormatBytes(long bytes)
        => FormatBytes(bytes < 0 ? 0UL : (ulong)bytes);

    /// <summary>
    /// Format a byte count expressed as a <see cref="double"/> as a human-readable string.
    /// Negative values are treated as zero.
    /// </summary>
    public static string FormatBytes(double bytes)
        => FormatBytes(bytes < 0 ? 0UL : (ulong)bytes);
}
