// Licensed under the MIT License.

namespace SpaceAnalyzer.ViewModels;

public partial class DuplicatesViewModel
{
    private string _sortKey = "Wasted";
    public string SortKey
    {
        get => _sortKey;
        set
        {
            if (_sortKey == value) return;
            _sortKey = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(SortedGroups));
        }
    }

    /// <summary>Sorted copy of the groups, used by the results list (newest/largest first).</summary>
    public List<DuplicateGroup> SortedGroups
    {
        get
        {
            if (_lastResult == null) return new List<DuplicateGroup>();
            return _sortKey switch
            {
                "Size" => _lastResult.DuplicateGroups.OrderByDescending(g => g.Size).ToList(),
                "Files" => _lastResult.DuplicateGroups.OrderByDescending(g => g.FileCount).ToList(),
                _ => _lastResult.DuplicateGroups.OrderByDescending(g => g.WastedBytes).ToList(),
            };
        }
    }

    public int SortIndex
    {
        get => _sortKey == "Size" ? 1 : _sortKey == "Files" ? 2 : 0;
        set => SortKey = value switch { 1 => "Size", 2 => "Files", _ => "Wasted" };
    }
}
