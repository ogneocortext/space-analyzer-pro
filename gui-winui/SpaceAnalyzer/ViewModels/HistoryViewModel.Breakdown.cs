// Licensed under the MIT License.

using System.IO;
using System.Linq;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class HistoryViewModel
{
    public List<DirEntry> TopDirectoriesView
    {
        get
        {
            if (_selectedRecord == null) return new();
            var total = _selectedRecord.TotalSizeBytes;
            var list = _selectedRecord.TopDirectories
                .OrderByDescending(d => d.TotalSize)
                .Take(15)
                .ToList();
            foreach (var d in list)
                d.Percent = total > 0 ? (double)d.TotalSize / total * 100.0 : 0;
            return list;
        }
    }

    public bool HasTopDirectories => TopDirectoriesView.Count > 0;
    public Microsoft.UI.Xaml.Visibility HasTopDirectoriesVisibility => HasTopDirectories ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public string TopDirectoriesCountDisplay => HasTopDirectories ? $"{TopDirectoriesView.Count} folder(s)" : "No directory data";

    public List<ExtensionStat> ExtensionBreakdown
    {
        get
        {
            if (_selectedRecord == null) return new();
            var exts = _selectedRecord.ExtensionSizes;
            if (exts.Count == 0) return new();
            ulong total = exts.Values.Aggregate(0UL, (acc, v) => acc + v);
            return exts
                .OrderByDescending(kv => kv.Value)
                .Take(20)
                .Select(kv => new ExtensionStat(kv.Key, kv.Value, total > 0 ? (double)kv.Value / total * 100.0 : 0))
                .ToList();
        }
    }

    public bool HasExtensionBreakdown => ExtensionBreakdown.Count > 0;
    public Microsoft.UI.Xaml.Visibility HasExtensionBreakdownVisibility => HasExtensionBreakdown ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public string ExtensionBreakdownCountDisplay => HasExtensionBreakdown ? $"{ExtensionBreakdown.Count} extension(s)" : "No type data";

    public List<CategoryStat> CategoryBreakdown
    {
        get
        {
            if (_selectedRecord == null) return new();
            var catSizes = _selectedRecord.CategorySizes;
            if (catSizes.Count > 0)
            {
                ulong total = catSizes.Values.Aggregate(0UL, (acc, v) => acc + v);
                return catSizes
                    .OrderByDescending(kv => kv.Value)
                    .Select(kv => new CategoryStat(kv.Key, kv.Value, total > 0 ? (double)kv.Value / total * 100.0 : 0))
                    .ToList();
            }
            var exts = _selectedRecord.ExtensionSizes;
            if (exts.Count == 0) return new();
            var byCat = new Dictionary<string, ulong>(StringComparer.OrdinalIgnoreCase);
            ulong extTotal = 0;
            foreach (var kv in exts)
            {
                var cat = FileCategory.CategoryForExtension(kv.Key);
                byCat.TryGetValue(cat, out var cur);
                byCat[cat] = cur + kv.Value;
                extTotal += kv.Value;
            }
            return byCat
                .OrderByDescending(kv => kv.Value)
                .Select(kv => new CategoryStat(kv.Key, kv.Value, extTotal > 0 ? (double)kv.Value / extTotal * 100.0 : 0))
                .ToList();
        }
    }

    public bool HasCategoryBreakdown => CategoryBreakdown.Count > 0;
    public string CategoryBreakdownCountDisplay => HasCategoryBreakdown ? $"{CategoryBreakdown.Count} categories" : "No category data";

    public List<DirEntry> OverviewTopDirs
    {
        get
        {
            if (_selectedRecord == null) return new();
            return _selectedRecord.TopDirectories.OrderByDescending(d => d.TotalSize).Take(5).ToList();
        }
    }

    public List<ExtensionStat> OverviewTopTypes
    {
        get
        {
            if (_selectedRecord == null) return new();
            return ExtensionBreakdown.Take(5).ToList();
        }
    }
}
