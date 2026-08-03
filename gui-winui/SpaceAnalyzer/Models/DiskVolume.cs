// Licensed under the MIT License.

using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Represents a physical disk volume with usage information.
/// </summary>
public class DiskVolume
{
    public string MountPoint { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public ulong TotalBytes { get; set; }
    public ulong AvailableBytes { get; set; }
    public string FileSystem { get; set; } = string.Empty;

    public ulong UsedBytes => TotalBytes - AvailableBytes;
    public double UsagePercent => TotalBytes > 0
        ? (double)UsedBytes / TotalBytes * 100.0
        : 0;

    public string UsedDisplay => ByteFormatter.FormatBytes(UsedBytes);
    public string TotalDisplay => ByteFormatter.FormatBytes(TotalBytes);
    public string AvailableDisplay => ByteFormatter.FormatBytes(AvailableBytes);
    public string UsagePercentDisplay => $"{UsagePercent:F1}%";
    public SolidColorBrush UsageBrush => UiHelper.GetUsageBrush(UsagePercent);

    /// <summary>Short status label for badge display: "Healthy", "Warning", or "Critical".</summary>
    public string StatusLabel => UsagePercent switch
    {
        >= 90 => "Critical",
        >= 70 => "Warning",
        _ => "Healthy",
    };

    /// <summary>Foreground brush for the status badge text.</summary>
    public SolidColorBrush StatusBrush => UiHelper.GetUsageBrush(UsagePercent);

    /// <summary>Subtle background brush for the status badge, tinted to match the status color.</summary>
    public SolidColorBrush StatusBadgeBackground => UsagePercent switch
    {
        >= 90 => Application.Current.Resources["ErrorSubtleBrush"] as SolidColorBrush ?? new SolidColorBrush(Microsoft.UI.Colors.Red),
        >= 70 => Application.Current.Resources["WarningSubtleBrush"] as SolidColorBrush ?? new SolidColorBrush(Microsoft.UI.Colors.Orange),
        _ => Application.Current.Resources["SuccessSubtleBrush"] as SolidColorBrush ?? new SolidColorBrush(Microsoft.UI.Colors.Green),
    };
}
