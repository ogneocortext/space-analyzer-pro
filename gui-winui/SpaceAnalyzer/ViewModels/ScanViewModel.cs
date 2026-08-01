// Licensed under the MIT License.

using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Linq;
using Windows.Storage;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class ScanViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private const string LocalSettingsKey = "SpaceAnalyzer.ScanSettings";

    public ScanViewModel()
    {
        Load();
    }

    // ── Scan options ──

    private string _scanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string ScanPath
    {
        get => _scanPath;
        set { _scanPath = value; OnPropertyChanged(); OnPropertyChanged(nameof(PathExists)); OnPropertyChanged(nameof(PathValidationMessage)); }
    }

    public bool PathExists => !string.IsNullOrWhiteSpace(ScanPath) && Directory.Exists(ScanPath);

    public string PathValidationMessage => string.IsNullOrWhiteSpace(ScanPath)
        ? "No path specified"
        : PathExists
            ? ""
            : "Path does not exist";

    private double _depthValue = 5;
    private double _customMaxDepth = 5;
    public double DepthValue
    {
        get => _depthValue;
        set
        {
            _depthValue = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(SelectedDepthMode));
            OnPropertyChanged(nameof(ResultDepthDisplay));
            OnPropertyChanged(nameof(DeepScan));
            OnPropertyChanged(nameof(ShallowScan));
            OnPropertyChanged(nameof(DepthInt));
            Save();
        }
    }

    public int DepthInt => (int)Math.Round(_depthValue);

    public bool DeepScan => SelectedDepthMode == ScannerService.DepthMode.Deep;

    public bool ShallowScan => SelectedDepthMode == ScannerService.DepthMode.Shallow;

    public ScannerService.DepthMode SelectedDepthMode
    {
        get
        {
            if (DepthInt == 1) return ScannerService.DepthMode.Shallow;
            if (DepthInt >= 20) return ScannerService.DepthMode.Deep;
            if (DepthInt == 5) return ScannerService.DepthMode.Default;
            return ScannerService.DepthMode.Custom;
        }
        set
        {
            _customMaxDepth = value switch
            {
                ScannerService.DepthMode.Shallow => 1,
                ScannerService.DepthMode.Deep => 20,
                ScannerService.DepthMode.Default => 5,
                ScannerService.DepthMode.Custom => _customMaxDepth > 1 && _customMaxDepth < 20 ? _customMaxDepth : 5,
                _ => 5
            };
            DepthValue = _customMaxDepth;
        }
    }

    public int MaxDepth => (int)Math.Round(_customMaxDepth);

    private bool _includeHidden;
    public bool IncludeHidden
    {
        get => _includeHidden;
        set { _includeHidden = value; OnPropertyChanged(); Save(); }
    }

    // ── Scan state ──

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); OnPropertyChanged(nameof(CanStopScan)); }
    }
    public bool IsNotScanning => !_isScanning;
    public bool CanStopScan => _isScanning;
    public Microsoft.UI.Xaml.Visibility IsScanningVisibility => _isScanning ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility IsNotScanningVisibility => _isScanning ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    private string _statusMessage = "Ready to scan";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private ScanResult? _lastResult;
    public ScanResult? LastResult
    {
        get => _lastResult;
        set
        {
            _lastResult = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasResult));
            OnPropertyChanged(nameof(HasResultVisibility));
            OnPropertyChanged(nameof(ResultFilesDisplay));
            OnPropertyChanged(nameof(ResultSizeDisplay));
            OnPropertyChanged(nameof(ResultDurationDisplay));
            OnPropertyChanged(nameof(ResultDirsDisplay));
            OnPropertyChanged(nameof(TopDirectories));
            OnPropertyChanged(nameof(FileTypes));
            OnPropertyChanged(nameof(LargestFiles));
            OnPropertyChanged(nameof(ScanErrors));
            OnPropertyChanged(nameof(HasScanErrors));
            OnPropertyChanged(nameof(ResultSpeedDisplay));
            OnPropertyChanged(nameof(ResultErrorsDisplay));
            OnPropertyChanged(nameof(FilteredLargestFiles));
        }
    }
    public bool HasResult => _lastResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility => HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public string ResultFilesDisplay => LastResult != null ? $"{LastResult.TotalFiles:N0} files" : "";
    public string ResultSizeDisplay => LastResult != null ? $"{LastResult.TotalSizeMb:F1} MB" : "";
    public string ResultDurationDisplay => LastResult != null ? $"{LastResult.DurationSecs:F1}s" : "";
    public string ResultDirsDisplay => LastResult != null ? $"{LastResult.TopDirectories.Count}" : "";
    public string ResultDepthDisplay => SelectedDepthMode switch
    {
        ScannerService.DepthMode.Deep => "Deep (unlimited)",
        ScannerService.DepthMode.Shallow => "Shallow (depth 1)",
        ScannerService.DepthMode.Custom => $"Custom (depth {MaxDepth})",
        _ => "Default (depth 5)"
    };
    public string ResultSpeedDisplay => LastResult != null && LastResult.DurationSecs > 0
        ? $"{LastResult.TotalFiles / LastResult.DurationSecs:F0} files/s"
        : "";
    public string ResultErrorsDisplay => LastResult != null && LastResult.Errors.Count > 0
        ? $"{LastResult.Errors.Count} error(s)"
        : "";

    public List<DirEntry> TopDirectories => LastResult?.TopDirectories ?? new();

    public List<FileTypeDistribution> FileTypes => LastResult?.FileTypes
        .OrderByDescending(kv => kv.Value)
        .Take(10)
        .Select(kv => new FileTypeDistribution
        {
            Extension = kv.Key,
            Count = kv.Value,
            Percentage = LastResult != null && LastResult.TotalFiles > 0
                ? (kv.Value * 100.0) / LastResult.TotalFiles
                : 0,
        })
        .ToList() ?? new();

    public List<FileSizeEntry> LargestFiles => LastResult?.LargestFiles ?? new();

    private string _largestFilesFilter = string.Empty;
    public string LargestFilesFilter
    {
        get => _largestFilesFilter;
        set
        {
            _largestFilesFilter = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasLargestFilesFilter));
            OnPropertyChanged(nameof(FilteredLargestFiles));
        }
    }

    public bool HasLargestFilesFilter => !string.IsNullOrWhiteSpace(_largestFilesFilter);

    public List<FileSizeEntry> FilteredLargestFiles
    {
        get
        {
            if (string.IsNullOrWhiteSpace(_largestFilesFilter))
                return LargestFiles;

            var filter = _largestFilesFilter.ToLowerInvariant();
            return LargestFiles
                .Where(f => f.Path.ToLowerInvariant().Contains(filter))
                .ToList();
        }
    }

    public List<string> ScanErrors => LastResult?.Errors ?? new();

    public bool HasScanErrors => LastResult != null && LastResult.Errors.Count > 0;

    // ── Persistence ──

    private void Load()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("DepthValue", out var v) && v is double d)
                DepthValue = d;
            if (container.Values.TryGetValue("CustomMaxDepth", out v) && v is double cmd)
                _customMaxDepth = cmd;
            if (container.Values.TryGetValue("IncludeHidden", out v) && v is bool h)
                IncludeHidden = h;
            if (container.Values.TryGetValue("ScanPath", out v))
                ScanPath = v?.ToString() ?? ScanPath;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Load failed: {ex}");
        }
    }

    public void Save()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            container.Values["DepthValue"] = DepthValue;
            container.Values["CustomMaxDepth"] = _customMaxDepth;
            container.Values["IncludeHidden"] = IncludeHidden;
            container.Values["ScanPath"] = ScanPath;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Save failed: {ex}");
        }
    }

    // ── Methods ──

    public async Task ScanAsync(CancellationToken ct = default)
    {
        if (IsScanning || string.IsNullOrWhiteSpace(ScanPath))
            return;

        if (!Directory.Exists(ScanPath))
        {
            StatusMessage = $"Scan path does not exist: {ScanPath}";
            return;
        }

        try
        {
            IsScanning = true;
            StatusMessage = "Scanning...";
            LastResult = null;

            var result = await _scanner.ScanDirectoryAsync(
                ScanPath,
                depthMode: SelectedDepthMode,
                maxDepth: MaxDepth,
                includeHidden: IncludeHidden,
                progress: null,
                ct);

            LastResult = result;
            if (result != null)
            {
                StatusMessage = $"Scan complete: {result.TotalFiles:N0} files, {result.TotalSizeMb:F1} MB in {result.DurationSecs:F1}s";
            }
            else
            {
                StatusMessage = "Scan completed with no result.";
            }
        }
        catch (OperationCanceledException)
        {
            StatusMessage = "Scan cancelled.";
            LastResult = null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Scan failed: {ex}");
            StatusMessage = $"Scan failed: {ex.Message}";
        }
        finally
        {
            IsScanning = false;
        }
    }

    public void StopScan()
    {
        if (!IsScanning) return;
        _scanner.StopScan();
        StatusMessage = "Stopping scan...";
    }

    public async Task<string> ExportResultsAsync(string outputPath, CancellationToken ct = default)
    {
        if (LastResult == null)
            throw new InvalidOperationException("No scan result to export.");

        return await _scanner.ExportScanResultAsync(LastResult, outputPath, ct);
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
