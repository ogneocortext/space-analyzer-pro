// Licensed under the MIT License.

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
}
