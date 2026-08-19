// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class DuplicatesViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;

    public DuplicatesViewModel()
    {
    }

    private string _scanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string ScanPath
    {
        get => _scanPath;
        set { _scanPath = value; OnPropertyChanged(); OnPropertyChanged(nameof(CanAnalyze)); }
    }

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); OnPropertyChanged(nameof(CanAnalyze)); }
    }
    public bool IsNotScanning => !_isScanning;
    public bool CanAnalyze => !_isScanning && !string.IsNullOrWhiteSpace(_scanPath);

    private string _statusMessage = "Ready to analyze";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private DedupResult? _lastResult;
    public DedupResult? LastResult
    {
        get => _lastResult;
        set { _lastResult = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasResult)); OnPropertyChanged(nameof(HasResultVisibility)); OnPropertyChanged(nameof(DuplicateGroupCount)); OnPropertyChanged(nameof(TotalDuplicateFiles)); OnPropertyChanged(nameof(PotentialSavingsDisplay)); OnPropertyChanged(nameof(DuplicateGroups)); }
    }
    public bool HasResult => _lastResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility => HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public int DuplicateGroupCount => _lastResult?.DuplicateGroups.Count ?? 0;
    public int TotalDuplicateFiles => (int)(_lastResult?.TotalDuplicateFiles ?? 0);
    public string PotentialSavingsDisplay => _lastResult?.PotentialSavingsDisplay ?? "";
    public List<DuplicateGroup> DuplicateGroups => _lastResult?.DuplicateGroups ?? new();

    public bool HasSelection => _lastResult != null && _lastResult.DuplicateGroups.Any(g => g.IsSelected);
    public int SelectedCount => _lastResult?.DuplicateGroups.Count(g => g.IsSelected) ?? 0;

    /// <summary>Called by the group checkbox handlers so the header buttons can react to selection changes.</summary>
    public void NotifySelectionChanged()
    {
        OnPropertyChanged(nameof(HasSelection));
        OnPropertyChanged(nameof(SelectedCount));
    }

    public void SelectAll(bool select)
    {
        if (_lastResult == null) return;
        foreach (var g in _lastResult.DuplicateGroups) g.IsSelected = select;
        NotifySelectionChanged();
        OnPropertyChanged(nameof(SortedGroups));
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }

    public event EventHandler<int>? FilesSentToRecycleBin;
}
