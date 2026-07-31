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

    private ScanHistoryRecord? _selectedRecord;
    public ScanHistoryRecord? SelectedRecord
    {
        get => _selectedRecord;
        set { _selectedRecord = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasSelectedRecord)); }
    }
    public bool HasSelectedRecord => _selectedRecord != null;

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
