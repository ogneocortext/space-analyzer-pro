// Licensed under the MIT License.

using System.Linq;
using System.ComponentModel;
using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// A directory (or bucket) group of <see cref="SmartSearchResult"/> entries, used
/// by the grouped view of the Smart Search results. Groups are collapsible and
/// support a "drill in" that re-scopes the search to the group.
/// </summary>
public sealed class SearchResultGroup : INotifyPropertyChanged
{
    public string Key { get; init; } = string.Empty;

    public string Label { get; init; } = string.Empty;

    public List<SmartSearchResult> Items { get; init; } = new();

    /// <summary>Folder path to re-scope the search to (Folder grouping). Null otherwise.</summary>
    public string? DrillPath { get; init; }

    /// <summary>Query to apply when drilling in (Category/Extension grouping). Null otherwise.</summary>
    public string? DrillQuery { get; init; }

    /// <summary>Whether the inner file list is expanded. Defaults to expanded.</summary>
    private bool _isExpanded = true;
    public bool IsExpanded
    {
        get => _isExpanded;
        set { _isExpanded = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsExpanded))); }
    }

    public int Count => Items.Count;

    /// <summary>True when this group can be drilled into (Folder path or Category/Extension query).</summary>
    public bool CanDrill => DrillPath != null || DrillQuery != null;

    public ulong TotalBytes => Items.Aggregate(0UL, (acc, r) => acc + r.SizeBytes);

    public string TotalDisplay => ByteFormatter.FormatBytes(TotalBytes);

    public event PropertyChangedEventHandler? PropertyChanged;
}
