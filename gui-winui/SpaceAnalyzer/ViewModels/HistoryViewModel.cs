// Licensed under the MIT License.

using System.ComponentModel;
using System.Runtime.CompilerServices;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class HistoryViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private const int PageSize = 20;

    public HistoryViewModel()
    {
    }

    // ── History list ──

    private List<ScanHistoryRecord> _history = new();
    public List<ScanHistoryRecord> History
    {
        get => _history;
        set { _history = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasHistory)); OnPropertyChanged(nameof(HasHistoryVisibility)); OnPropertyChanged(nameof(HasNoHistoryVisibility)); }
    }
    public bool HasHistory => _history.Any();
    public Microsoft.UI.Xaml.Visibility HasHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasNoHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

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
        set { _sortBy = value; OnPropertyChanged(); OnPropertyChanged(nameof(DateSortIndicator)); OnPropertyChanged(nameof(PathSortIndicator)); OnPropertyChanged(nameof(SizeSortIndicator)); OnPropertyChanged(nameof(FilesSortIndicator)); }
    }

    private bool _sortAsc;
    public bool SortAsc
    {
        get => _sortAsc;
        set { _sortAsc = value; OnPropertyChanged(); OnPropertyChanged(nameof(DateSortIndicator)); OnPropertyChanged(nameof(PathSortIndicator)); OnPropertyChanged(nameof(SizeSortIndicator)); OnPropertyChanged(nameof(FilesSortIndicator)); }
    }

    private string SortIndicatorFor(string column) => SortBy == column ? (SortAsc ? " \u25B2" : " \u25BC") : "";
    public string DateSortIndicator => SortIndicatorFor("timestamp");
    public string PathSortIndicator => SortIndicatorFor("path");
    public string SizeSortIndicator => SortIndicatorFor("total_size_bytes");
    public string FilesSortIndicator => SortIndicatorFor("total_files");

    public void ToggleSort(string column)
    {
        if (SortBy == column)
            SortAsc = !SortAsc;
        else
        {
            SortBy = column;
            SortAsc = false;
        }
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
            ResetFileExplorer();
            RefreshFilteredFiles();
        }
    }
    public bool HasSelectedRecord => _selectedRecord != null;
    public Microsoft.UI.Xaml.Visibility HasSelectedRecordVisibility => HasSelectedRecord ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasListVisibility => HasSelectedRecord ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

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
        OnPropertyChanged(nameof(FilteredLargestFiles));
        OnPropertyChanged(nameof(HasLargestFiles));
        OnPropertyChanged(nameof(HasLargestFilesVisibility));
        OnPropertyChanged(nameof(HasNoLargestFilesVisibility));
        OnPropertyChanged(nameof(LargestFilesCountDisplay));
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

    public async Task LoadHistoryAsync()
    {
        CurrentPage = 1;
        await LoadPageAsync();
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
                SortBy, SortAsc);
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
            IsLoading = true;
            StatusMessage = "Loading details...";
            var details = await _scanner.GetScanDetailsAsync(record.Id);
            SelectedRecord = details ?? record;
            StatusMessage = "Details loaded";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadDetails failed: {ex}");
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
                // Reload to fix pagination gap
                await LoadPageAsync();
            }
            else
            {
                StatusMessage = "Delete failed — scanner unavailable";
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Delete failed: {ex}");
            StatusMessage = $"Delete failed: {ex.Message}";
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
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
