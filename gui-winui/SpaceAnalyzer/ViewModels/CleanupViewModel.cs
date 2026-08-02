// Licensed under the MIT License.

using System.ComponentModel;
using System.Runtime.CompilerServices;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class CleanupViewModel : INotifyPropertyChanged, IDisposable
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

    public async Task AnalyzeAsync()
    {
        if (_disposed || IsAnalyzing || string.IsNullOrWhiteSpace(TargetPath))
            return;

        _cts.Dispose();
        _cts = new CancellationTokenSource();

        try
        {
            IsAnalyzing = true;
            StatusMessage = "Scanning for node_modules...";
            LastResult = null;

            var result = await _scanner.RunCleanupAnalysisAsync(
                TargetPath,
                cleanup: PerformCleanup,
                minSizeMb: (ulong)MinSizeMb,
                unusedDays: (ulong)UnusedDays,
                ct: _cts.Token);

            LastResult = result;

            if (result != null)
            {
                StatusMessage = $"Found {result.NodeModulesCount} node_modules directories, {result.TotalCleanupSizeDisplay} cleanup candidates.";
            }
            else
            {
                StatusMessage = "No node_modules found or analysis returned no data.";
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CleanupViewModel] Analysis failed: {ex}");
            StatusMessage = $"Analysis failed: {ex.Message}";
        }
        finally
        {
            IsAnalyzing = false;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
