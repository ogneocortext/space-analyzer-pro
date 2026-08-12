// Licensed under the MIT License.

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single search result for the Smart Search page.
/// </summary>
public class SmartSearchResult
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ulong SizeBytes { get; set; }
    public string SizeDisplay { get; set; } = string.Empty;

    /// <summary>Exact byte count as a formatted integer, shown when raw-bytes mode is on.</summary>
    public string SizeRaw { get; set; } = string.Empty;

    /// <summary>Human-readable last-modified time, populated from the file's mtime.</summary>
    public string ModifiedDisplay { get; set; } = string.Empty;

    /// <summary>Last-modified time as Unix seconds, used for date-based grouping.</summary>
    public long Mtime { get; set; }

    /// <summary>
    /// Fraction (0..1) of the largest result in the current set, used to draw a
    /// proportional size bar. 0 when the set is empty or the item is the smallest.
    /// </summary>
    public double SizeFraction { get; set; }

    /// <summary>Category color brush (from <see cref="Helpers.FileCategory"/>) for the size bar.</summary>
    public Microsoft.UI.Xaml.Media.SolidColorBrush? BarBrush { get; set; }
}
