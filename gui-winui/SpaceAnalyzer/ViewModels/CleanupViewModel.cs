// Licensed under the MIT License.

using System.Collections.ObjectModel;
using System.IO;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class CleanupViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private CancellationTokenSource _cts = new();

    public CleanupViewModel()
    {
    }

    private string _targetPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string TargetPath
    {
        get => _targetPath;
        set { _targetPath = value; OnPropertyChanged(); }
    }

    private bool _isAnalyzing;
    public bool IsAnalyzing
    {
        get => _isAnalyzing;
        set { _isAnalyzing = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotAnalyzing)); }
    }
    public bool IsNotAnalyzing => !_isAnalyzing;

    private string _statusMessage = "Ready to analyze node_modules.";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private CleanupAnalysis? _lastResult;
    public CleanupAnalysis? LastResult
    {
        get => _lastResult;
        set { _lastResult = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasResultVisibility)); OnPropertyChanged(nameof(TotalSizeDisplay)); OnPropertyChanged(nameof(TotalFiles)); OnPropertyChanged(nameof(NodeModulesCount)); OnPropertyChanged(nameof(TotalCleanupSizeDisplay)); OnPropertyChanged(nameof(CleanupCandidates)); OnPropertyChanged(nameof(DuplicatePackages)); }
    }
    public Microsoft.UI.Xaml.Visibility HasResultVisibility =>
        _lastResult != null ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public Microsoft.UI.Xaml.Visibility NodeModulesResultVisibility =>
        (_mode == CleanupMode.NodeModules && _lastResult != null)
            ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public Microsoft.UI.Xaml.Visibility TempResultVisibility =>
        (_mode == CleanupMode.TempCaches && _tempEntries.Count > 0)
            ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public Microsoft.UI.Xaml.Visibility EmptyStateVisibility =>
        (_mode == CleanupMode.TempCaches)
            ? (_tempEntries.Count == 0 ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed)
            : (_lastResult == null ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed);

    public string TotalSizeDisplay => _lastResult?.TotalSizeDisplay ?? "";
    public ulong TotalFiles => _lastResult?.TotalFiles ?? 0;
    public ulong NodeModulesCount => _lastResult?.NodeModulesCount ?? 0;
    public string TotalCleanupSizeDisplay => _lastResult?.TotalCleanupSizeDisplay ?? "";
    public List<CleanupCandidate> CleanupCandidates => _lastResult?.CleanupCandidates ?? new();
    public List<DuplicatePackage> DuplicatePackages => _lastResult?.DuplicatePackages ?? new();

    private int _minSizeMb = 100;
    public int MinSizeMb
    {
        get => _minSizeMb;
        set { _minSizeMb = value; OnPropertyChanged(); }
    }

    private int _unusedDays = 30;
    public int UnusedDays
    {
        get => _unusedDays;
        set { _unusedDays = value; OnPropertyChanged(); }
    }

    private bool _performCleanup;
    public bool PerformCleanup
    {
        get => _performCleanup;
        set { _performCleanup = value; OnPropertyChanged(); }
    }

    private CleanupMode _mode = CleanupMode.NodeModules;
    public CleanupMode Mode
    {
        get => _mode;
        set
        {
            if (_mode == value) return;
            _mode = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsNodeModulesMode));
            OnPropertyChanged(nameof(IsTempMode));
            OnPropertyChanged(nameof(NodeModulesResultVisibility));
            OnPropertyChanged(nameof(TempResultVisibility));
            OnPropertyChanged(nameof(EmptyStateVisibility));
        }
    }
    public bool IsNodeModulesMode => _mode == CleanupMode.NodeModules;
    public bool IsTempMode => _mode == CleanupMode.TempCaches;

    private ObservableCollection<TempCleanupEntry> _tempEntries = new();
    public ObservableCollection<TempCleanupEntry> TempEntries
    {
        get => _tempEntries;
        set { _tempEntries = value; OnPropertyChanged(); OnPropertyChanged(nameof(TempSelectedCount)); OnPropertyChanged(nameof(TempSelectedSizeDisplay)); }
    }

    public int TempSelectedCount => _tempEntries.Count(e => e.IsSelected);
    public bool TempHasSelection => TempSelectedCount > 0;
    public string TempSelectedSizeDisplay =>
        ByteFormatter.FormatBytes(_tempEntries.Where(e => e.IsSelected).Aggregate(0UL, (s, e) => s + e.SizeBytes));

    public void SelectAllTemp()
    {
        foreach (var e in _tempEntries) e.IsSelected = true;
        OnPropertyChanged(nameof(TempSelectedCount));
        OnPropertyChanged(nameof(TempHasSelection));
        OnPropertyChanged(nameof(TempSelectedSizeDisplay));
    }

    public void ClearTempSelection()
    {
        foreach (var e in _tempEntries) e.IsSelected = false;
        OnPropertyChanged(nameof(TempSelectedCount));
        OnPropertyChanged(nameof(TempHasSelection));
        OnPropertyChanged(nameof(TempSelectedSizeDisplay));
    }

    public string TempFolderPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Temp");

    /// <summary>Point the target at the user's Temp folder for quick cleanup.</summary>
    public void UseTempFolder() => TargetPath = TempFolderPath;

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }
}
