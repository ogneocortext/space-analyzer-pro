// Licensed under the MIT License.

using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class HistoryViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private const int PageSize = 20;

    public HistoryViewModel()
    {
    }

    // ── History list ──

    private List<ScanHistoryRecord> _history = new();

    private List<ScanFolderGroup> _groupedHistory = new();
    public List<ScanFolderGroup> GroupedHistory
    {
        get => _groupedHistory;
        private set { _groupedHistory = value; OnPropertyChanged(); }
    }

    private bool _isGroupedView;
    public bool IsGroupedView
    {
        get => _isGroupedView;
        set { _isGroupedView = value; OnPropertyChanged(); OnPropertyChanged(nameof(ShowFlatView)); OnPropertyChanged(nameof(ShowGroupedView)); }
    }

    public bool ShowFlatView => !_isGroupedView;
    public bool ShowGroupedView => _isGroupedView;

    private void BuildGroupedHistory()
    {
        if (_history.Count == 0)
        {
            GroupedHistory = new List<ScanFolderGroup>();
            return;
        }

        var groups = _history
            .GroupBy(r => NormalizePath(r.Path), StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var ordered = g.OrderByDescending(r => r.ScanDate).ThenByDescending(r => r.Id).ToList();
                var first = ordered[0];
                return new ScanFolderGroup
                {
                    NormalizedPath = g.Key,
                    Path = first.Path,
                    LeafName = first.LeafName,
                    ParentPath = first.ParentPath,
                    Scans = ordered,
                };
            })
            .OrderByDescending(g => g.LatestScan.ScanDate)
            .ThenByDescending(g => g.LatestScan.Id)
            .ToList();

        GroupedHistory = groups;
    }

    private List<HistoryTrendPoint> _trendRecords = new();
    public List<HistoryTrendPoint> TrendRecords
    {
        get => _trendRecords;
        set
        {
            _trendRecords = value;
            RefreshDuplicateSummary();
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasDuplicatesAny));
            OnPropertyChanged(nameof(DuplicateGroupsCount));
            OnPropertyChanged(nameof(DuplicateRecordsCount));
            OnPropertyChanged(nameof(DuplicateSummaryDisplay));
            OnPropertyChanged(nameof(HasDuplicatesInView));
            OnPropertyChanged(nameof(RedundantInView));
        }
    }

    public bool HasDuplicatesAny => _duplicateRecords > 0;

    private int _duplicateGroups;
    private int _duplicateRecords;
    private int _redundantRecords;

    public int DuplicateGroupsCount => _duplicateGroups;
    public int DuplicateRecordsCount => _duplicateRecords;

    public string DuplicateSummaryDisplay
    {
        get
        {
            if (_duplicateRecords == 0) return string.Empty;
            var folderWord = _duplicateGroups == 1 ? "folder" : "folders";
            return $"{_duplicateRecords} duplicate scan{(_duplicateRecords == 1 ? "" : "s")} across {_duplicateGroups} {folderWord}";
        }
    }

    private void RefreshDuplicateSummary()
    {
        _duplicateGroups = 0;
        _duplicateRecords = 0;
        _redundantRecords = 0;
        var groups = _trendRecords
            .GroupBy(t => NormalizePath(t.Path), StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .ToList();
        foreach (var g in groups)
        {
            _duplicateGroups++;
            var count = g.Count();
            _duplicateRecords += count;
            _redundantRecords += count - 1;
        }
    }

    public List<ScanHistoryRecord> History
    {
        get => _history;
        set
        {
            // Hide index-only rows (created by `embed` with no real scan) so the
            // semantic-embedding anchors don't pollute the scan history list.
            // The agentic assistant still reaches them via the raw
            // GetScanHistoryPageAsync service call, so reuse is unaffected.
            _history = (value ?? new List<ScanHistoryRecord>()).Where(r => !r.IsIndexOnly).ToList();
            var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in _history)
            {
                var key = NormalizePath(r.Path);
                counts.TryGetValue(key, out var c);
                counts[key] = c + 1;
            }
            foreach (var r in _history)
                r.IsDuplicateView = counts.TryGetValue(NormalizePath(r.Path), out var c) && c > 1;
            foreach (var r in _history)
                r.IsCompareSelected = false;
            BuildGroupedHistory();
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasHistory));
            OnPropertyChanged(nameof(HasHistoryVisibility));
            OnPropertyChanged(nameof(HasNoHistoryVisibility));
            OnPropertyChanged(nameof(HistoryListVisibility));
            OnPropertyChanged(nameof(HasDuplicatesInView));
            OnPropertyChanged(nameof(RedundantInView));
            OnPropertyChanged(nameof(HistorySummary));
        }
    }

    public string HistorySummary
    {
        get
        {
            if (TotalCount == 0) return "No scans recorded yet.";
            var newest = History.FirstOrDefault();
            var when = newest == null ? "unknown" : newest.RelativeDateDisplay.ToLowerInvariant();
            var size = newest == null ? "" : $" · {newest.TotalSizeDisplay} newest";
            var noun = TotalCount == 1 ? "scan" : "scans";
            return $"{TotalCount:N0} {noun} · last {when}{size}";
        }
    }

    private static string NormalizePath(string p) => (p ?? string.Empty).TrimEnd('\\').ToLowerInvariant();

    public bool HasDuplicatesInView => HasDuplicatesAny;
    public int RedundantInView => _redundantRecords;
    public bool HasHistory => _history.Any();
    public Microsoft.UI.Xaml.Visibility HasHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasNoHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    // ── Sort options ──

    public ObservableCollection<string> SortOptions { get; } = new() { "Date", "Size", "Files", "Duplicates" };

    private string _selectedSortOption = "Date";
    public string SelectedSortOption
    {
        get => _selectedSortOption;
        set
        {
            _selectedSortOption = value;
            OnPropertyChanged();
            var column = value switch
            {
                "Size" => "total_size_bytes",
                "Files" => "total_files",
                "Duplicates" => "duplicate",
                _ => "timestamp"
            };
            ToggleSort(column);
        }
    }

    // ── Multi-select comparison ──

    private bool _showComparison;
    public bool ShowComparison
    {
        get => _showComparison;
        set { _showComparison = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasComparisonVisibility)); }
    }
    public Microsoft.UI.Xaml.Visibility HasComparisonVisibility => _showComparison ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    private List<CompareCardModel> _comparisons = new();
    public List<CompareCardModel> Comparisons
    {
        get => _comparisons;
        private set { _comparisons = value; OnPropertyChanged(); }
    }

    public int CompareSelectedCount => _history.Count(r => r.IsCompareSelected);
    public bool HasCompareSelection => CompareSelectedCount >= 2;

    public void NotifyCompareSelectionChanged()
    {
        OnPropertyChanged(nameof(CompareSelectedCount));
        OnPropertyChanged(nameof(HasCompareSelection));
    }

    public void OpenComparison()
    {
        var selected = _history.Where(r => r.IsCompareSelected).ToList();
        if (selected.Count < 2) return;
        var baseline = selected[0];
        var cards = new List<CompareCardModel>();
        foreach (var r in selected)
        {
            var exts = r.ExtensionSizes;
            ulong extTotal = exts.Values.Aggregate(0UL, (acc, v) => acc + v);
            var topTypes = exts
                .OrderByDescending(kv => kv.Value)
                .Take(5)
                .Select(kv => new ExtensionStat(kv.Key, kv.Value, extTotal > 0 ? (double)kv.Value / extTotal * 100.0 : 0))
                .ToList();
            cards.Add(new CompareCardModel
            {
                Record = r,
                TopDirs = r.TopDirectories.OrderByDescending(d => d.TotalSize).Take(5).ToList(),
                TopTypes = topTypes,
                IsBaseline = r == baseline,
                DeltaSizeBytes = (long)r.TotalSizeBytes - (long)baseline.TotalSizeBytes,
                DeltaFiles = r.TotalFiles - baseline.TotalFiles,
                DeltaDurationSecs = r.DurationSecs - baseline.DurationSecs,
            });
        }
        Comparisons = cards;
        ShowComparison = true;
    }

    public void ClearComparison()
    {
        ShowComparison = false;
        Comparisons = new();
        foreach (var r in _history) r.IsCompareSelected = false;
        NotifyCompareSelectionChanged();
    }

    // ── Pagination ──

    private long _totalCount;
    public long TotalCount
    {
        get => _totalCount;
        set { _totalCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(PageInfo)); OnPropertyChanged(nameof(HasNextPage)); OnPropertyChanged(nameof(HasPreviousPage)); OnPropertyChanged(nameof(HistorySummary)); }
    }

    private int _currentPage = 1;
    public int CurrentPage
    {
        get => _currentPage;
        set { _currentPage = value; OnPropertyChanged(); OnPropertyChanged(nameof(PageInfo)); OnPropertyChanged(nameof(HasNextPage)); OnPropertyChanged(nameof(HasPreviousPage)); }
    }

    public string PageInfo => TotalCount == 0 ? "No results" : $"Page {CurrentPage} of {Math.Max(1, (int)Math.Ceiling((double)TotalCount / PageSize))} ({TotalCount} total)";
    public bool HasNextPage => CurrentPage * PageSize < TotalCount;
    public bool HasPreviousPage => CurrentPage > 1;

    // ── Search ──

    private string _searchText = string.Empty;
    public string SearchText
    {
        get => _searchText;
        set { _searchText = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasSearchText)); }
    }
    public bool HasSearchText => !string.IsNullOrWhiteSpace(_searchText);

    // ── Sort ──

    private string _sortBy = "timestamp";
    public string SortBy
    {
        get => _sortBy;
        set { _sortBy = value; OnPropertyChanged(); OnPropertyChanged(nameof(DateSortIndicator)); OnPropertyChanged(nameof(PathSortIndicator)); OnPropertyChanged(nameof(SizeSortIndicator)); OnPropertyChanged(nameof(FilesSortIndicator)); OnPropertyChanged(nameof(DuplicateSortIndicator)); OnPropertyChanged(nameof(DateSortActive)); OnPropertyChanged(nameof(SizeSortActive)); OnPropertyChanged(nameof(FilesSortActive)); OnPropertyChanged(nameof(DuplicateSortActive)); }
    }

    private bool _sortAsc;
    public bool SortAsc
    {
        get => _sortAsc;
        set { _sortAsc = value; OnPropertyChanged(); OnPropertyChanged(nameof(DateSortIndicator)); OnPropertyChanged(nameof(PathSortIndicator)); OnPropertyChanged(nameof(SizeSortIndicator)); OnPropertyChanged(nameof(FilesSortIndicator)); OnPropertyChanged(nameof(DuplicateSortIndicator)); OnPropertyChanged(nameof(DateSortActive)); OnPropertyChanged(nameof(SizeSortActive)); OnPropertyChanged(nameof(FilesSortActive)); OnPropertyChanged(nameof(DuplicateSortActive)); }
    }

    public string ServerSortBy => _sortBy == "duplicate" ? "path" : _sortBy;

    private string SortIndicatorFor(string column) => SortBy == column ? (SortAsc ? " \u25B2" : " \u25BC") : "";
    public string DateSortIndicator => SortIndicatorFor("timestamp");
    public string PathSortIndicator => SortIndicatorFor("path");
    public string SizeSortIndicator => SortIndicatorFor("total_size_bytes");
    public string FilesSortIndicator => SortIndicatorFor("total_files");
    public string DuplicateSortIndicator => SortIndicatorFor("duplicate");

    public bool DateSortActive => SortBy == "timestamp";
    public bool SizeSortActive => SortBy == "total_size_bytes";
    public bool FilesSortActive => SortBy == "total_files";
    public bool DuplicateSortActive => SortBy == "duplicate";
    public bool OnlyDuplicatesActive => OnlyDuplicates;

    public void ToggleSort(string column)
    {
        if (SortBy == column)
            SortAsc = !SortAsc;
        else
        {
            SortBy = column;
            SortAsc = column == "duplicate";
        }
        CurrentPage = 1;
        _ = LoadPageAsync();
    }

    // ── Duplicate filter ──

    private bool _onlyDuplicates;
    public bool OnlyDuplicates
    {
        get => _onlyDuplicates;
        set { _onlyDuplicates = value; OnPropertyChanged(); OnPropertyChanged(nameof(OnlyDuplicatesIndicator)); OnPropertyChanged(nameof(OnlyDuplicatesActive)); }
    }

    public string OnlyDuplicatesIndicator => _onlyDuplicates ? " \u25CF" : "";

    public void ToggleOnlyDuplicates()
    {
        OnlyDuplicates = !OnlyDuplicates;
        CurrentPage = 1;
        _ = LoadPageAsync();
    }

    // ── Selected record / detail view ──

    private ScanHistoryRecord? _selectedRecord;
    public ScanHistoryRecord? SelectedRecord
    {
        get => _selectedRecord;
        set
        {
            _selectedRecord = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasSelectedRecord));
            OnPropertyChanged(nameof(HasSelectedRecordVisibility));
            OnPropertyChanged(nameof(HasListVisibility));
            OnPropertyChanged(nameof(HistoryListVisibility));
            ResetFileExplorer();
            RefreshFilteredFiles();
        }
    }
    public bool HasSelectedRecord => _selectedRecord != null;
    public Microsoft.UI.Xaml.Visibility HasSelectedRecordVisibility => HasSelectedRecord ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasListVisibility => HasSelectedRecord ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;
    public Microsoft.UI.Xaml.Visibility HistoryListVisibility =>
        (HasSelectedRecord || !HasHistory) ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    // ── File Explorer ──

    private string _fileExplorerFilter = string.Empty;
    public string FileExplorerFilter
    {
        get => _fileExplorerFilter;
        set { _fileExplorerFilter = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasFileExplorerFilter)); RefreshFilteredFiles(); }
    }

    public string FileExplorerFilterPlaceholder => "Filter by name or path...";

    private List<FileSizeEntry> _filteredLargestFiles = new();
    public List<FileSizeEntry> FilteredLargestFiles
    {
        get => _filteredLargestFiles;
        private set
        {
            _filteredLargestFiles = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasLargestFiles));
            OnPropertyChanged(nameof(HasLargestFilesVisibility));
            OnPropertyChanged(nameof(HasNoLargestFilesVisibility));
            OnPropertyChanged(nameof(LargestFilesCountDisplay));
        }
    }

    public bool HasLargestFiles => _filteredLargestFiles.Count > 0;
    public Microsoft.UI.Xaml.Visibility HasLargestFilesVisibility => HasLargestFiles ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasNoLargestFilesVisibility => HasLargestFiles ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;
    public string LargestFilesCountDisplay => HasLargestFiles ? $"{_filteredLargestFiles.Count} file(s)" : "No files in this scan";
    public bool HasFileExplorerFilter => !string.IsNullOrWhiteSpace(_fileExplorerFilter);

    private int _fileSortColumn;
    public int FileSortColumn
    {
        get => _fileSortColumn;
        set { _fileSortColumn = value; RefreshFilteredFiles(); }
    }

    private bool _fileSortAscending;
    public bool FileSortAscending
    {
        get => _fileSortAscending;
        set { _fileSortAscending = value; RefreshFilteredFiles(); }
    }

    public string FileSizeSortIndicator => FileSortColumn == 1 ? (FileSortAscending ? "\u25B2" : "\u25BC") : "";
    public string FileNameSortIndicator => FileSortColumn == 2 ? (FileSortAscending ? "\u25B2" : "\u25BC") : "";

    public void ToggleFileSort(int column)
    {
        if (FileSortColumn == column)
            FileSortAscending = !FileSortAscending;
        else
        {
            FileSortColumn = column;
            FileSortAscending = false;
        }
        RefreshFilteredFiles();
    }

    private void ResetFileExplorer()
    {
        _fileExplorerFilter = string.Empty;
        _fileSortColumn = 0;
        _fileSortAscending = false;
        OnPropertyChanged(nameof(FileExplorerFilter));
        OnPropertyChanged(nameof(HasFileExplorerFilter));
        OnPropertyChanged(nameof(FileSizeSortIndicator));
        OnPropertyChanged(nameof(FileNameSortIndicator));
    }

    private void RefreshFilteredFiles()
    {
        if (_selectedRecord == null)
        {
            _filteredLargestFiles = new();
            OnPropertyChanged(nameof(FilteredLargestFiles));
            OnPropertyChanged(nameof(HasLargestFiles));
            OnPropertyChanged(nameof(HasLargestFilesVisibility));
            OnPropertyChanged(nameof(HasNoLargestFilesVisibility));
            OnPropertyChanged(nameof(LargestFilesCountDisplay));
            return;
        }

        IEnumerable<FileSizeEntry> query = _selectedRecord.LargestFiles;

        if (!string.IsNullOrWhiteSpace(_fileExplorerFilter))
        {
            var filter = _fileExplorerFilter.ToLowerInvariant();
            query = query.Where(f => f.Path.ToLowerInvariant().Contains(filter) || f.Name.ToLowerInvariant().Contains(filter));
        }

        query = FileSortColumn switch
        {
            1 => FileSortAscending ? query.OrderBy(f => f.Size) : query.OrderByDescending(f => f.Size),
            2 => FileSortAscending ? query.OrderBy(f => f.Name) : query.OrderByDescending(f => f.Name),
            _ => query.OrderByDescending(f => f.Size),
        };

        _filteredLargestFiles = query.ToList();
        if (_filteredLargestFiles.Count > 0)
        {
            var max = _filteredLargestFiles.Max(f => f.Size);
            foreach (var f in _filteredLargestFiles)
                f.Percent = max > 0 ? (double)f.Size / max * 100.0 : 0;
        }
        OnPropertyChanged(nameof(FilteredLargestFiles));
        OnPropertyChanged(nameof(HasLargestFiles));
        OnPropertyChanged(nameof(HasLargestFilesVisibility));
        OnPropertyChanged(nameof(HasNoLargestFilesVisibility));
        OnPropertyChanged(nameof(LargestFilesCountDisplay));
    }
}
