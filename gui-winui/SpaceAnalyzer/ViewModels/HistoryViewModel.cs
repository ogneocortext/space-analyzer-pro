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

    public HistoryViewModel()
    {
    }

    private List<ScanHistoryRecord> _history = new();
    public List<ScanHistoryRecord> History
    {
        get => _history;
        set { _history = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasHistory)); OnPropertyChanged(nameof(HasHistoryVisibility)); OnPropertyChanged(nameof(HasNoHistoryVisibility)); }
    }
    public bool HasHistory => _history.Any();
    public Microsoft.UI.Xaml.Visibility HasHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasNoHistoryVisibility => HasHistory ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;
    public bool HasSelectedRecord => _selectedRecord != null;
    public Microsoft.UI.Xaml.Visibility HasSelectedRecordVisibility => HasSelectedRecord ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

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
            ResetFileExplorer();
            RefreshFilteredFiles();
        }
    }

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

    private int _sortColumn;
    public int SortColumn
    {
        get => _sortColumn;
        set { _sortColumn = value; RefreshFilteredFiles(); }
    }

    private bool _sortAscending;
    public bool SortAscending
    {
        get => _sortAscending;
        set { _sortAscending = value; RefreshFilteredFiles(); }
    }

    public string SizeSortIndicator => _sortColumn == 1
        ? (_sortAscending ? "\u25B2" : "\u25BC")
        : "";

    public string NameSortIndicator => _sortColumn == 2
        ? (_sortAscending ? "\u25B2" : "\u25BC")
        : "";

    public string PathSortIndicator => _sortColumn == 3
        ? (_sortAscending ? "\u25B2" : "\u25BC")
        : "";

    public void ToggleSort(int column)
    {
        if (_sortColumn == column)
            _sortAscending = !_sortAscending;
        else
        {
            _sortColumn = column;
            _sortAscending = column == 2;
        }
        OnPropertyChanged(nameof(SortAscending));
        OnPropertyChanged(nameof(SizeSortIndicator));
        OnPropertyChanged(nameof(NameSortIndicator));
        OnPropertyChanged(nameof(PathSortIndicator));
        RefreshFilteredFiles();
    }

    private void ResetFileExplorer()
    {
        _fileExplorerFilter = string.Empty;
        _sortColumn = 0;
        _sortAscending = false;
        OnPropertyChanged(nameof(FileExplorerFilter));
        OnPropertyChanged(nameof(HasFileExplorerFilter));
        OnPropertyChanged(nameof(SizeSortIndicator));
        OnPropertyChanged(nameof(NameSortIndicator));
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

        query = _sortColumn switch
        {
             1 => _sortAscending ? query.OrderBy(f => f.Size) : query.OrderByDescending(f => f.Size),
             2 => _sortAscending ? query.OrderBy(f => f.Name) : query.OrderByDescending(f => f.Name),
             3 => _sortAscending ? query.OrderBy(f => f.Path) : query.OrderByDescending(f => f.Path),
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
        try
        {
            IsLoading = true;
            StatusMessage = "Loading history...";
            History = await _scanner.GetScanHistoryAsync(50);
            StatusMessage = History.Count == 0 ? "No scan history found" : $"Loaded {History.Count} scans";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadHistory failed: {ex}");
            StatusMessage = $"Failed to load history: {ex.Message}";
            History = new List<ScanHistoryRecord>();
        }
        finally
        {
            IsLoading = false;
        }
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
                if (_selectedRecord?.Id == id)
                    SelectedRecord = null;
                StatusMessage = "Deleted";
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
