// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Represents a single file type entry for the distribution chart on the scan page.
/// </summary>
public class FileTypeDistribution
{
    public string Extension { get; set; } = string.Empty;
    public long Count { get; set; }
    public ulong TotalSize { get; set; }
    public string CountDisplay => $"{Count:N0} files";
    public string SizeDisplay => ByteFormatter.FormatBytes(TotalSize);
    public double Percentage { get; set; }
}