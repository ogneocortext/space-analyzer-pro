// Licensed under the MIT License.

using System.Linq;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A directory group of <see cref="SmartSearchResult"/> entries, used by the
/// "Group by folder" view of the Smart Search results.
/// </summary>
public sealed class SearchResultGroup
{
    public string Directory { get; init; } = string.Empty;

    public List<SmartSearchResult> Items { get; init; } = new();

    public int Count => Items.Count;

    public ulong TotalBytes => Items.Aggregate(0UL, (acc, r) => acc + r.SizeBytes);

    public string TotalDisplay => ByteFormatter.FormatBytes(TotalBytes);
}
