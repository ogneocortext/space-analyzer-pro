// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class SmartSearchViewModel
{
    private void FinalizeFilenameResults()
    {
        SortResults(_results);
        RecomputeBars();
        ResultCount = _results.Count;
        DisplayCount = Math.Min(_maxResults, _results.Count);
        ApplyDisplay();
    }

    private void SortAndApply()
    {
        if (_results.Count == 0) return;
        SortResults(_results);
        RecomputeBars();
        ApplyDisplay();
    }

    private void RecomputeBars()
    {
        ulong max = 0;
        foreach (var r in _results)
            if (r.SizeBytes > max) max = r.SizeBytes;
        foreach (var r in _results)
        {
            r.SizeFraction = max > 0 ? (double)r.SizeBytes / max : 0;
            r.BarBrush = FileCategory.CategoryBrush(FileCategory.CategoryForExtension(Path.GetExtension(r.Name)));
        }
    }

    private void ApplyDisplay()
    {
        DisplayResults.Clear();
        foreach (var r in _results.Take(_displayCount))
            DisplayResults.Add(r);

        GroupedResults.Clear();
        if (_groupByMode == GroupByMode.None)
            return;

        var groups = _results.Take(_displayCount)
            .GroupBy(GroupKey)
            .Select(g => BuildGroup(g.Key, g.ToList()))
            .ToList();

        if (_collapseSmallGroups && _groupByMode is GroupByMode.Folder or GroupByMode.Category or GroupByMode.Extension)
        {
            var threshold = (ulong)Math.Max(0, _otherThresholdMb) * 1024 * 1024;
            var small = groups.Where(g => g.TotalBytes < threshold).ToList();
            var keep = groups.Where(g => g.TotalBytes >= threshold).ToList();
            if (small.Count > 0)
            {
                keep.Add(BuildGroup("__other", small.SelectMany(g => g.Items).ToList(), $"Other ({small.Count} groups)"));
                groups = keep;
            }
        }

        foreach (var g in OrderGroups(groups))
            GroupedResults.Add(g);
    }

    public void ShowAll()
    {
        DisplayCount = _results.Count;
        ApplyDisplay();
        OnPropertyChanged(nameof(HasMore));
        OnPropertyChanged(nameof(ShownCount));
        OnPropertyChanged(nameof(ResultCount));
    }

    public void LoadMore()
    {
        DisplayCount = Math.Min(_results.Count, _displayCount + _maxResults);
        ApplyDisplay();
        OnPropertyChanged(nameof(HasMore));
        OnPropertyChanged(nameof(ShownCount));
        OnPropertyChanged(nameof(ResultCount));
    }

    public string ExportResultsJson()
    {
        var payload = _results.Select(r => new
        {
            r.Path,
            r.Name,
            r.SizeBytes,
            r.SizeDisplay,
            r.ModifiedDisplay,
            Mtime = r.Mtime
        });
        return System.Text.Json.JsonSerializer.Serialize(payload, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
    }

    private SearchResultGroup BuildGroup(string key, List<SmartSearchResult> items, string? label = null)
    {
        string? drillPath = null;
        string? drillQuery = null;
        if (_groupByMode == GroupByMode.Folder && key != "__other")
            drillPath = key;
        else if (_groupByMode == GroupByMode.Extension && key != "__other" && key != "(no extension)")
            drillQuery = "*" + key;
        else if (_groupByMode == GroupByMode.Category && key != "__other")
        {
            var exts = FileCategory.ExtensionsForCategory(key);
            if (exts.Count > 0)
                drillQuery = string.Join("|", exts.Select(e => "*" + e));
        }

        return new SearchResultGroup
        {
            Key = key,
            Label = label ?? key,
            Items = SortItems(items),
            DrillPath = drillPath,
            DrillQuery = drillQuery
        };
    }

    private string GroupKey(SmartSearchResult r)
    {
        var ext = Path.GetExtension(r.Name);
        return _groupByMode switch
        {
            GroupByMode.Folder => Path.GetDirectoryName(r.Path) ?? r.Path,
            GroupByMode.Extension => string.IsNullOrEmpty(ext) ? "(no extension)" : ext.ToLowerInvariant(),
            GroupByMode.Category => FileCategory.CategoryForExtension(ext),
            GroupByMode.Date => DateKey(r.Mtime),
            GroupByMode.Size => SizeBand(r.SizeBytes),
            _ => r.Path
        };
    }

    private static string DateKey(long mtime)
    {
        if (mtime <= 0) return "Unknown date";
        try
        {
            var dt = DateTimeOffset.FromUnixTimeSeconds(mtime).LocalDateTime;
            return $"{dt.Year} / {dt.Month:00}";
        }
        catch { return "Unknown date"; }
    }

    private static string SizeBand(ulong size)
    {
        const ulong mb = 1024 * 1024;
        const ulong gb = 1024 * mb;
        if (size < mb) return "Under 1 MB";
        if (size < 10 * mb) return "1 – 10 MB";
        if (size < 100 * mb) return "10 – 100 MB";
        if (size < gb) return "100 MB – 1 GB";
        return "Over 1 GB";
    }

    private IEnumerable<SearchResultGroup> OrderGroups(List<SearchResultGroup> groups)
    {
        return _groupByMode switch
        {
            GroupByMode.Date => groups.OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase),
            GroupByMode.Size => groups.OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase),
            _ => groups.OrderByDescending(g => g.TotalBytes)
        };
    }

    private void SortResults(IEnumerable<SmartSearchResult> items)
    {
        var sorted = SortItems(items as List<SmartSearchResult> ?? items.ToList());
        _results.Clear();
        foreach (var r in sorted) _results.Add(r);
    }

    private List<SmartSearchResult> SortItems(List<SmartSearchResult> items)
    {
        var list = new List<SmartSearchResult>(items);
        switch (_sortBy)
        {
            case SortBy.Name:
                list.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
                break;
            case SortBy.Size:
                list.Sort((a, b) => b.SizeBytes.CompareTo(a.SizeBytes));
                break;
            case SortBy.Date:
                list.Sort((a, b) => b.Mtime.CompareTo(a.Mtime));
                break;
            case SortBy.Path:
                list.Sort((a, b) => string.Compare(a.Path, b.Path, StringComparison.OrdinalIgnoreCase));
                break;
            case SortBy.Extension:
                list.Sort((a, b) => string.Compare(Path.GetExtension(a.Name), Path.GetExtension(b.Name), StringComparison.OrdinalIgnoreCase));
                break;
        }
        return list;
    }

    public async Task BrowseForPathAsync()
    {
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                SearchPath = path;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SmartSearchViewModel] Browse failed: {ex}");
        }
    }
}
