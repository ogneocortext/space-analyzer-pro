// Licensed under the MIT License.

using System.IO;
using System.Linq;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class HistoryViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private const int PageSize = 20;

    public HistoryViewModel()
    {
    }

    // ── History list ──

    private List<ScanHistoryRecord> _history = new();

    /// <summary>
    /// Every scan in the database as a lightweight (id, path, timestamp, size)
    /// series, independent of the paged <see cref="History"/> list. Drives the
    /// "Size Trend" chart (so it stays stable across page turns) and the global
    /// duplicate summary shown in the header.
    /// </summary>
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

    /// <summary>True when any folder has been scanned more than once.</summary>
    public bool HasDuplicatesAny => _duplicateRecords > 0;

    private int _duplicateGroups;
    private int _duplicateRecords;
    private int _redundantRecords;

    /// <summary>Number of folders that have been scanned more than once.</summary>
    public int DuplicateGroupsCount => _duplicateGroups;

    /// <summary>Total scans that are re-scans of a folder (members of any duplicate group).</summary>
    public int DuplicateRecordsCount => _duplicateRecords;

    /// <summary>
    /// Human-readable header summary, e.g. "47 duplicate scans across 12 folders".
    /// Empty string when there are no duplicates.
    /// </summary>
    public string DuplicateSummaryDisplay
    {
        get
        {
            if (_duplicateRecords == 0) return string.Empty;
            var folderWord = _duplicateGroups == 1 ? "folder" : "folders";
            return $"{_duplicateRecords} duplicate scan{(_duplicateRecords == 1 ? "" : "s")} across {_duplicateGroups} {folderWord}";
        }
    }

    /// <summary>
    /// Recompute the global duplicate summary from the full trend series. A scan
    /// is "duplicate" when its (normalized) folder has been scanned more than once.
    /// </summary>
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
            _history = value;
            // Flag records whose directory also appears elsewhere in this view so
            // the list can surface redundant scans (makes Delete Duplicates useful).
            var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in _history)
            {
                var key = NormalizePath(r.Path);
                counts.TryGetValue(key, out var c);
                counts[key] = c + 1;
            }
            foreach (var r in _history)
                r.IsDuplicateView = counts.TryGetValue(NormalizePath(r.Path), out var c) && c > 1;

            // A reload invalidates any in-flight comparison selection.
            foreach (var r in _history)
                r.IsCompareSelected = false;

            OnPropertyChanged();
            OnPropertyChanged(nameof(HasHistory));
            OnPropertyChanged(nameof(HasHistoryVisibility));
            OnPropertyChanged(nameof(HasNoHistoryVisibility));
            OnPropertyChanged(nameof(HistoryListVisibility));
            OnPropertyChanged(nameof(HasDuplicatesInView));
            OnPropertyChanged(nameof(RedundantInView));
        }
    }

    private static string NormalizePath(string p) => (p ?? string.Empty).TrimEnd('\\').ToLowerInvariant();

    /// <summary>
    /// True when duplicates exist anywhere in history (not just the current page),
    /// so the header "Delete Duplicates" badge is always meaningful.
    /// </summary>
    public bool HasDuplicatesInView => HasDuplicatesAny;

    /// <summary>
    /// Number of scans that would be removed if every folder kept only its newest
    /// scan (the redundant re-scans across the whole history).
    /// </summary>
    public int RedundantInView => _redundantRecords;
    public bool HasHistory => _history.Any();
    public Microsoft.UI.Xaml.Visibility HasHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasNoHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

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

    /// <summary>
    /// Called from the UI when a card's compare checkbox is toggled so the
    /// header "Compare (N)" button and its count badge refresh.
    /// </summary>
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
        set { _totalCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(PageInfo)); OnPropertyChanged(nameof(HasNextPage)); OnPropertyChanged(nameof(HasPreviousPage)); }
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
        set { _sortBy = value; OnPropertyChanged(); OnPropertyChanged(nameof(DateSortIndicator)); OnPropertyChanged(nameof(PathSortIndicator)); OnPropertyChanged(nameof(SizeSortIndicator)); OnPropertyChanged(nameof(FilesSortIndicator)); OnPropertyChanged(nameof(DuplicateSortIndicator)); }
    }

    private bool _sortAsc;
    public bool SortAsc
    {
        get => _sortAsc;
        set { _sortAsc = value; OnPropertyChanged(); OnPropertyChanged(nameof(DateSortIndicator)); OnPropertyChanged(nameof(PathSortIndicator)); OnPropertyChanged(nameof(SizeSortIndicator)); OnPropertyChanged(nameof(FilesSortIndicator)); OnPropertyChanged(nameof(DuplicateSortIndicator)); }
    }

    /// <summary>The sort column the server actually receives. "duplicate" is a
    /// UI convenience that groups same-folder scans together, so it maps to a
    /// path sort.</summary>
    public string ServerSortBy => _sortBy == "duplicate" ? "path" : _sortBy;

    private string SortIndicatorFor(string column) => SortBy == column ? (SortAsc ? " \u25B2" : " \u25BC") : "";
    public string DateSortIndicator => SortIndicatorFor("timestamp");
    public string PathSortIndicator => SortIndicatorFor("path");
    public string SizeSortIndicator => SortIndicatorFor("total_size_bytes");
    public string FilesSortIndicator => SortIndicatorFor("total_files");
    public string DuplicateSortIndicator => SortIndicatorFor("duplicate");

    public void ToggleSort(string column)
    {
        if (SortBy == column)
            SortAsc = !SortAsc;
        else
        {
            SortBy = column;
            // "duplicate" groups same-folder scans, so sort folders ascending.
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
        set { _onlyDuplicates = value; OnPropertyChanged(); OnPropertyChanged(nameof(OnlyDuplicatesIndicator)); }
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
            OnPropertyChanged(nameof(TopDirectoriesView));
            OnPropertyChanged(nameof(HasTopDirectories));
            OnPropertyChanged(nameof(HasTopDirectoriesVisibility));
            OnPropertyChanged(nameof(TopDirectoriesCountDisplay));
            OnPropertyChanged(nameof(ExtensionBreakdown));
            OnPropertyChanged(nameof(HasExtensionBreakdown));
            OnPropertyChanged(nameof(HasExtensionBreakdownVisibility));
            OnPropertyChanged(nameof(ExtensionBreakdownCountDisplay));
            OnPropertyChanged(nameof(CategoryBreakdown));
            OnPropertyChanged(nameof(HasCategoryBreakdown));
            OnPropertyChanged(nameof(CategoryBreakdownCountDisplay));
            OnPropertyChanged(nameof(OverviewTopDirs));
            OnPropertyChanged(nameof(OverviewTopTypes));
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

    // ── Per-scan breakdown (detail view) ──

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

    /// <summary>
    /// High-level category rollup (Documents, Images, Code, …) derived from the
    /// scan's per-extension sizes. This is what the "Overview" and "File Types"
    /// tabs render as colored bars so users see the categorization at a glance.
    /// </summary>
    public List<CategoryStat> CategoryBreakdown
    {
        get
        {
            if (_selectedRecord == null) return new();
            // Prefer the Rust scanner's authoritative, path-aware category breakdown
            // (persisted as category_sizes_json). It classifies development folders
            // (node_modules/venv/.cargo/…) as "Development" and build/target trees as
            // "Build Output" — context an extension-only map cannot recover. Fall back
            // to deriving categories from per-extension sizes only when the recorded
            // scan predates that column.
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

    /// <summary>
    /// Top 5 folders + types for the "Overview" tab of the detail pivot: a quick
    /// at-a-glance summary so users don't have to jump between tabs.
    /// </summary>
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

    // ── Load state ──

    private bool _isLoading;
    public bool IsLoading
    {
        get => _isLoading;
        set { _isLoading = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotLoading)); }
    }
    public bool IsNotLoading => !_isLoading;

    private string _statusMessage = "Ready";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    // ── All-history category composition (Library Composition donut) ──

    private List<CategoryStat> _categoryHistory = new();
    public List<CategoryStat> CategoryHistory
    {
        get => _categoryHistory;
        private set
        {
            _categoryHistory = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasCategoryHistory));
            OnPropertyChanged(nameof(CategoryHistoryCountDisplay));
        }
    }
    public bool HasCategoryHistory => _categoryHistory.Count > 0;
    public string CategoryHistoryCountDisplay => HasCategoryHistory ? $"{_categoryHistory.Count} categories" : "No category data";

    /// <summary>
    /// Load the aggregate category breakdown across every scan (the backend sums
    /// each record's category_sizes_json). Independent of the paginated list so the
    /// "Library Composition" donut reflects the whole library, not one page.
    /// </summary>
    public async Task LoadCategoryHistoryAsync()
    {
        try
        {
            var dict = await _scanner.GetCategoryHistoryAsync();
            if (dict.Count == 0)
            {
                CategoryHistory = new List<CategoryStat>();
                return;
            }
            ulong total = dict.Values.Aggregate(0UL, (acc, v) => acc + v);
            CategoryHistory = dict
                .OrderByDescending(kv => kv.Value)
                .Select(kv => new CategoryStat(kv.Key, kv.Value, total > 0 ? (double)kv.Value / total * 100.0 : 0))
                .ToList();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadCategoryHistory failed: {ex}");
            CategoryHistory = new List<CategoryStat>();
        }
    }

    public async Task LoadHistoryAsync()
    {
        CurrentPage = 1;
        await LoadPageAsync();
        await LoadTrendAsync();
        await LoadCategoryHistoryAsync();
    }

    /// <summary>
    /// Load the lightweight full-history series used by the "Size Trend" chart
    /// and the duplicate summary. Independent of the paginated list, so it is
    /// fetched from its own CLI call and refreshed only on full reloads/mutations.
    /// </summary>
    public async Task LoadTrendAsync()
    {
        try
        {
            TrendRecords = await _scanner.GetScanHistoryTrendAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadTrend failed: {ex}");
            TrendRecords = new List<HistoryTrendPoint>();
        }
    }

    public async Task LoadPageAsync()
    {
        try
        {
            IsLoading = true;
            StatusMessage = "Loading history...";
            var offset = (CurrentPage - 1) * PageSize;
            var (records, total) = await _scanner.GetScanHistoryPageAsync(
                PageSize, offset,
                string.IsNullOrWhiteSpace(SearchText) ? null : SearchText,
                ServerSortBy, SortAsc, OnlyDuplicates);
            History = records;
            TotalCount = total;
            StatusMessage = TotalCount == 0 ? "No scan history found" : $"Showing {records.Count} of {TotalCount} scans";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadPage failed: {ex}");
            StatusMessage = $"Failed to load history: {ex.Message}";
            History = new List<ScanHistoryRecord>();
            TotalCount = 0;
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task NextPageAsync()
    {
        if (!HasNextPage) return;
        CurrentPage++;
        await LoadPageAsync();
    }

    public async Task PreviousPageAsync()
    {
        if (!HasPreviousPage) return;
        CurrentPage--;
        await LoadPageAsync();
    }

    public async Task SearchAsync()
    {
        CurrentPage = 1;
        await LoadPageAsync();
    }

    public void ClearSearch()
    {
        SearchText = string.Empty;
        CurrentPage = 1;
        _ = LoadPageAsync();
    }

    public async Task LoadDetailsAsync(ScanHistoryRecord record)
    {
        try
        {
            AppLog.Page($"LoadDetailsAsync id={record.Id}");
            IsLoading = true;
            StatusMessage = "Loading details...";
            var details = await _scanner.GetScanDetailsAsync(record.Id);
            SelectedRecord = details ?? record;
            StatusMessage = "Details loaded";
            AppLog.Page($"LoadDetailsAsync id={record.Id} -> {(details is null ? "fallback-to-list-record" : "details-loaded")}, dirs={SelectedRecord.TopDirectories.Count}, files={SelectedRecord.LargestFiles.Count}");
        }
        catch (Exception ex)
        {
            AppLog.Exception(ex, $"LoadDetailsAsync id={record.Id}");
            StatusMessage = $"Failed to load details: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>Load a specific history record by id and open its details view.
    /// Used by the "Saved to history · View details" bridge from the scan page.</summary>
    public async Task SelectRecordByIdAsync(long id)
    {
        try
        {
            AppLog.Page($"SelectRecordByIdAsync id={id}");
            IsLoading = true;
            StatusMessage = "Loading details...";
            var record = await _scanner.GetScanDetailsAsync(id);
            if (record == null)
            {
                StatusMessage = $"Scan record {id} not found";
                return;
            }
            var details = await _scanner.GetScanDetailsAsync(record.Id);
            SelectedRecord = details ?? record;
            StatusMessage = "Details loaded";
        }
        catch (Exception ex)
        {
            AppLog.Exception(ex, $"SelectRecordByIdAsync id={id}");
            StatusMessage = $"Failed to load details: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    public void BackToList()
    {
        SelectedRecord = null;
    }

    public async Task DeleteHistoryAsync(long id)
    {
        try
        {
            IsLoading = true;
            StatusMessage = "Deleting...";
            var success = await _scanner.DeleteScanAsync(id);
            if (success)
            {
                History = History.Where(r => r.Id != id).ToList();
                TotalCount = Math.Max(0, TotalCount - 1);
                if (_selectedRecord?.Id == id)
                    SelectedRecord = null;
                StatusMessage = "Deleted";
                AppNotifications.Success("Scan record deleted", $"Record {id} removed from history");
                await LoadTrendAsync();
            }
            else
            {
                StatusMessage = "Delete failed — scanner unavailable";
                AppNotifications.Error("Delete failed", "Scanner is unavailable");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Delete failed: {ex}");
            StatusMessage = $"Delete failed: {ex.Message}";
            AppNotifications.Error("Delete failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneDuplicateScansAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Removing duplicate scans...";
            var (success, duplicates, _, error) = await _scanner.PruneDuplicateScansAsync();
            if (success)
            {
                var msg = duplicates > 0
                    ? $"Removed {duplicates} duplicate scan record(s)."
                    : "No duplicate scans found.";
                StatusMessage = msg;
                AppNotifications.Success("Duplicates cleaned", msg);
                await LoadHistoryAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    // ── Database / cache management ──

    private DatabaseInfo? _dbInfo;
    public DatabaseInfo? DbInfo
    {
        get => _dbInfo;
        set
        {
            _dbInfo = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DbInfoSummary));
        }
    }
    public string DbInfoSummary => _dbInfo?.Summary ?? "Database info unavailable";

    /// <summary>Refresh the cache-stats panel without touching the history list.</summary>
    public async Task LoadDatabaseInfoAsync()
    {
        try
        {
            DbInfo = await _scanner.GetDatabaseInfoAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadDatabaseInfo failed: {ex}");
            DbInfo = null;
        }
    }

    public async Task PruneEmptyScansAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Removing empty scans...";
            var (success, removed, error) = await _scanner.PruneEmptyScansAsync();
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} empty scan record(s)."
                    : "No empty scans found.";
                StatusMessage = msg;
                AppNotifications.Success("Empty scans cleaned", msg);
                await LoadHistoryAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune empty failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneRelativeScansAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Removing non-absolute paths...";
            var (success, removed, error) = await _scanner.PruneRelativeScansAsync();
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} scan record(s) with invalid paths."
                    : "No invalid-path scans found.";
                StatusMessage = msg;
                AppNotifications.Success("Path prune complete", msg);
                await LoadHistoryAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune relative failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task BackfillCategoriesAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Recomputing categories...";
            var (success, updated, error) = await _scanner.BackfillCategoriesAsync();
            if (success)
            {
                var msg = updated > 0
                    ? $"Recomputed categories for {updated} scan(s)."
                    : "All scans already have category data.";
                StatusMessage = msg;
                AppNotifications.Success("Categories recomputed", msg);
                // Categories are read when a record's details are opened, so a list
                // reload is unnecessary; just refresh the stats panel.
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Back-fill failed: {error}";
                AppNotifications.Error("Back-fill failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Backfill failed: {ex}");
            StatusMessage = $"Back-fill failed: {ex.Message}";
            AppNotifications.Error("Back-fill failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task VacuumDatabaseAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Compacting database...";
            var (success, error) = await _scanner.VacuumDatabaseAsync();
            if (success)
            {
                StatusMessage = "Database compacted.";
                AppNotifications.Success("Database compacted", "Reclaimed free space.");
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Vacuum failed: {error}";
                AppNotifications.Error("Vacuum failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Vacuum failed: {ex}");
            StatusMessage = $"Vacuum failed: {ex.Message}";
            AppNotifications.Error("Vacuum failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneFileCacheAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Cleaning stale file cache...";
            var (success, removed, error) = await _scanner.PruneFileCacheAsync();
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} stale file-cache row(s)."
                    : "No stale file-cache entries found.";
                StatusMessage = msg;
                AppNotifications.Success("File cache cleaned", msg);
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune file cache failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneDiskSpaceAsync(int keepHours)
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Pruning disk-space history...";
            var (success, removed, error) = await _scanner.PruneDiskSpaceAsync(keepHours);
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} disk-space snapshot(s) older than {keepHours}h."
                    : "No old disk-space snapshots to remove.";
                StatusMessage = msg;
                AppNotifications.Success("Disk history pruned", msg);
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune disk space failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task ClearHistoryAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Clearing all history...";
            var (success, removed, error) = await _scanner.ClearHistoryAsync();
            if (success)
            {
                var msg = $"Cleared {removed} scan record(s).";
                StatusMessage = msg;
                AppNotifications.Success("History cleared", msg);
                History = new List<ScanHistoryRecord>();
                TotalCount = 0;
                SelectedRecord = null;
                DbInfo = null;
                await LoadTrendAsync();
            }
            else
            {
                StatusMessage = $"Clear failed: {error}";
                AppNotifications.Error("Clear failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Clear failed: {ex}");
            StatusMessage = $"Clear failed: {ex.Message}";
            AppNotifications.Error("Clear failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }
}
