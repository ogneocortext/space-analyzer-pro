// Licensed under the MIT License.

using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Linq;
using System.Collections.ObjectModel;
using Windows.Storage;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Helpers;
using System;
using System.Collections.Generic;
using System.IO;

namespace SpaceAnalyzer.ViewModels;

public class ScanViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private const string LocalSettingsKey = "SpaceAnalyzer.ScanSettings";

    public ScanViewModel()
    {
        Load();
        InitializeQuickScanTargets();
    }

    // ── Scan options ──

    private string _scanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string ScanPath
    {
        get => _scanPath;
        set { _scanPath = value; OnPropertyChanged(); OnPropertyChanged(nameof(PathExists)); OnPropertyChanged(nameof(PathValidationMessage)); }
    }

    public ObservableCollection<QuickScanTarget> QuickScanTargets { get; } = new();

    private QuickScanTarget? _selectedQuickScanTarget;
    public QuickScanTarget? SelectedQuickScanTarget
    {
        get => _selectedQuickScanTarget;
        set
        {
            _selectedQuickScanTarget = value;
            OnPropertyChanged();
            if (value != null)
                ScanPath = value.Path;
        }
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
            OnPropertyChanged(nameof(ShowCustomDepthSlider));
            Save();
        }
    }

    public int DepthInt => (int)Math.Round(_depthValue);

    public bool DeepScan => SelectedDepthMode == ScannerService.DepthMode.Deep;

    public bool ShallowScan => SelectedDepthMode == ScannerService.DepthMode.Shallow;

    public bool DefaultScan => SelectedDepthMode == ScannerService.DepthMode.Default;

    public bool ShowCustomDepthSlider => SelectedDepthMode == ScannerService.DepthMode.Custom;

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
            OnPropertyChanged(nameof(ShowCustomDepthSlider));
        }
    }

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
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); OnPropertyChanged(nameof(CanStopScan)); OnPropertyChanged(nameof(IsScanningVisibility)); OnPropertyChanged(nameof(IsNotScanningVisibility)); }
    }
    public bool IsNotScanning => !_isScanning;
    public bool CanStopScan => _isScanning;
    public Microsoft.UI.Xaml.Visibility IsScanningVisibility => _isScanning ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility IsNotScanningVisibility => _isScanning ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    private double _scanProgress;
    public double ScanProgress
    {
        get => _scanProgress;
        set { _scanProgress = value; OnPropertyChanged(); OnPropertyChanged(nameof(ScanProgressDisplay)); }
    }
    public string ScanProgressDisplay => $"{ScanProgress:F0}%";

    private string _statusMessage = "Ready to scan";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private ScanResult? _lastResult;
    private DateTime _lastProgressUpdate;

    private void HandleStreamingProgress(StreamProgress progress)
    {
        // Throttle UI churn: the scanner emits one line per file, so surface at most
        // ~7 updates/sec and skip lines that advance progress by less than 1%. This
        // avoids re-sorting live files and raising ~30 PropertyChanged events per file.
        var now = DateTime.UtcNow;
        if (_lastProgressUpdate != default
            && now - _lastProgressUpdate < TimeSpan.FromMilliseconds(150)
            && Math.Abs(progress.Percentage - _scanProgress) < 1.0)
            return;
        _lastProgressUpdate = now;

        StatusMessage = $"Scanning: {progress.CurrentFile}";
        UpdatePartialResult(progress);
    }

    private ScanResult? _partialResult;
    private string _currentFile = string.Empty;
    private DateTime _scanStartTime;

    private void UpdatePartialResult(StreamProgress progress)
    {
        if (!_isStreaming)
            return;

        ScanProgress = progress.Percentage;
        _currentFile = progress.CurrentFile;
        var elapsed = (DateTime.UtcNow - _scanStartTime).TotalSeconds;

        var partial = new ScanResult
        {
            TotalFiles = (long)progress.FilesScanned,
            TotalSizeBytes = progress.TotalSize,
            TotalSizeMb = progress.TotalSize / (1024.0 * 1024.0),
            DurationSecs = elapsed,
            Path = ScanPath,
            TotalDirs = progress.DirectoriesScanned,
            Errors = new List<string>(),
            FileTypes = progress.FileTypes.ToDictionary(kvp => kvp.Key, kvp => (long)kvp.Value),
            ExtensionSizes = new Dictionary<string, ulong>(progress.ExtensionSizes),
            CategorySizes = new Dictionary<string, ulong>(progress.CategorySizes),
        };

        // Live largest files (already sorted by size from the scanner)
        partial.LargestFiles = progress.LiveFiles
            .OrderByDescending(f => f.Size)
            .Select(f => new FileSizeEntry { Path = f.Path, Size = f.Size })
            .ToList();

        _partialResult = partial;

        OnPropertyChanged(nameof(ActiveResult));
        OnPropertyChanged(nameof(HasActiveResult));
        OnPropertyChanged(nameof(HasActiveResultVisibility));
        OnPropertyChanged(nameof(LiveFilesDisplay));
        OnPropertyChanged(nameof(LiveSizeDisplay));
        OnPropertyChanged(nameof(ResultFilesDisplay));
        OnPropertyChanged(nameof(ResultSizeDisplay));
        OnPropertyChanged(nameof(ResultDurationDisplay));
        OnPropertyChanged(nameof(ResultDirsDisplay));
        OnPropertyChanged(nameof(ResultAvgFileSizeDisplay));
        OnPropertyChanged(nameof(ResultSpeedDisplay));
        OnPropertyChanged(nameof(ResultSpeedMbDisplay));
        OnPropertyChanged(nameof(ResultErrorsDisplay));
        OnPropertyChanged(nameof(TopDirectories));
        OnPropertyChanged(nameof(FileTypes));
        OnPropertyChanged(nameof(CategoryDistributions));
        OnPropertyChanged(nameof(LargestFiles));
        OnPropertyChanged(nameof(PotentialCleanupDisplay));
        OnPropertyChanged(nameof(ResultTimestampDisplay));
        OnPropertyChanged(nameof(HasScanErrors));
        OnPropertyChanged(nameof(EmptyDirs));
        OnPropertyChanged(nameof(EmptyDirsCount));
        OnPropertyChanged(nameof(HasEmptyDirs));
        OnPropertyChanged(nameof(FilteredLargestFiles));
    }

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
            OnPropertyChanged(nameof(ResultAvgFileSizeDisplay));
            OnPropertyChanged(nameof(ResultSpeedDisplay));
            OnPropertyChanged(nameof(ResultSpeedMbDisplay));
            OnPropertyChanged(nameof(ResultErrorsDisplay));
            OnPropertyChanged(nameof(TopDirectories));
            OnPropertyChanged(nameof(FileTypes));
            OnPropertyChanged(nameof(CategoryDistributions));
            OnPropertyChanged(nameof(LargestFiles));
        OnPropertyChanged(nameof(PotentialCleanupDisplay));
        OnPropertyChanged(nameof(ResultTimestampDisplay));
            OnPropertyChanged(nameof(ScanErrors));
            OnPropertyChanged(nameof(HasScanErrors));
            OnPropertyChanged(nameof(EmptyDirs));
            OnPropertyChanged(nameof(EmptyDirsCount));
            OnPropertyChanged(nameof(HasEmptyDirs));
            OnPropertyChanged(nameof(ResultSpeedDisplay));
            OnPropertyChanged(nameof(FilteredLargestFiles));
            OnPropertyChanged(nameof(LiveFilesDisplay));
            OnPropertyChanged(nameof(LiveSizeDisplay));
        }
    }

    public bool HasResult => _lastResult != null;
    public bool HasActiveResult => ActiveResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility => HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasActiveResultVisibility => HasActiveResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    // ── Streaming state ──

    private bool _isStreaming;
    public bool IsStreaming
    {
        get => _isStreaming;
        set
        {
            _isStreaming = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsNotStreaming));
            OnPropertyChanged(nameof(ActiveResult));
            OnPropertyChanged(nameof(LiveFilesDisplay));
            OnPropertyChanged(nameof(LiveSizeDisplay));
            OnPropertyChanged(nameof(ResultFilesDisplay));
            OnPropertyChanged(nameof(ResultSizeDisplay));
            OnPropertyChanged(nameof(ResultDurationDisplay));
            OnPropertyChanged(nameof(ResultDirsDisplay));
            OnPropertyChanged(nameof(ResultAvgFileSizeDisplay));
            OnPropertyChanged(nameof(ResultSpeedDisplay));
            OnPropertyChanged(nameof(ResultSpeedMbDisplay));
            OnPropertyChanged(nameof(ResultErrorsDisplay));
            OnPropertyChanged(nameof(TopDirectories));
            OnPropertyChanged(nameof(FileTypes));
            OnPropertyChanged(nameof(CategoryDistributions));
            OnPropertyChanged(nameof(LargestFiles));
        OnPropertyChanged(nameof(PotentialCleanupDisplay));
        OnPropertyChanged(nameof(ResultTimestampDisplay));
            OnPropertyChanged(nameof(ScanErrors));
            OnPropertyChanged(nameof(HasScanErrors));
            OnPropertyChanged(nameof(EmptyDirs));
            OnPropertyChanged(nameof(EmptyDirsCount));
            OnPropertyChanged(nameof(HasEmptyDirs));
            OnPropertyChanged(nameof(FilteredLargestFiles));
        }
    }
    public bool IsNotStreaming => !_isStreaming;

    public string LiveFilesDisplay => IsStreaming && _partialResult != null
        ? $"Scanning: {_currentFile}"
        : "";

    public string LiveSizeDisplay => IsStreaming && _partialResult != null
        ? $"{_partialResult.TotalSizeMb:F1} MB"
        : "";

    // Returns partial result during streaming, final result otherwise.
    private ScanResult? ActiveResult => IsStreaming ? (_partialResult ?? _lastResult) : _lastResult;
    public string ResultFilesDisplay => ActiveResult != null ? $"{ActiveResult.TotalFiles:N0} files" : "";
    public string ResultSizeDisplay => ActiveResult != null ? $"{ActiveResult.TotalSizeMb:F1} MB" : "";
    public string ResultDepthDisplay => SelectedDepthMode switch
    {
        ScannerService.DepthMode.Deep => "Deep (unlimited)",
        ScannerService.DepthMode.Shallow => "Shallow (depth 1)",
        ScannerService.DepthMode.Custom => $"Custom (depth {DepthInt})",
        _ => "Default (depth 5)"
    };
    public string ResultSpeedDisplay => ActiveResult != null && ActiveResult.DurationSecs > 0
        ? $"{ActiveResult.TotalFiles / ActiveResult.DurationSecs:F0} files/s"
        : "—";
    public string ResultSpeedMbDisplay => ActiveResult != null && ActiveResult.DurationSecs > 0
        ? $"{ActiveResult.TotalSizeBytes / (1024.0 * 1024.0) / ActiveResult.DurationSecs:F1} MB/s"
        : "—";
    public string ResultDurationDisplay => ActiveResult != null ? $"{ActiveResult.DurationSecs:F1}s" : "";
    public string ResultDirsDisplay => ActiveResult != null ? $"{ActiveResult.TotalDirs:N0}" : "";
    public string ResultAvgFileSizeDisplay => ActiveResult != null && ActiveResult.TotalFiles > 0
        ? ByteFormatter.FormatBytes((ulong)(ActiveResult.TotalSizeBytes / (ulong)ActiveResult.TotalFiles))
        : "—";
    public string ResultErrorsDisplay => ActiveResult != null && ActiveResult.Errors.Count > 0
        ? $"{ActiveResult.Errors.Count} error(s)"
        : "";

    public List<DirEntry> TopDirectories => ActiveResult?.TopDirectories ?? new();

    public List<FileTypeDistribution> FileTypes => ActiveResult?.FileTypes
        .OrderByDescending(kv => kv.Value)
        .Take(10)
        .Select(kv => new FileTypeDistribution
        {
            Extension = kv.Key,
            Count = kv.Value,
            TotalSize = ActiveResult?.ExtensionSizes.TryGetValue(kv.Key, out var sz) == true ? sz : 0,
            Percentage = ActiveResult != null && ActiveResult.TotalFiles > 0
                ? (kv.Value * 100.0) / ActiveResult.TotalFiles
                : 0,
        })
        .ToList() ?? new();

    public List<FileTypeDistribution> CategoryDistributions => ActiveResult?.CategorySizes
        .OrderByDescending(kv => kv.Value)
        .Select(kv => new FileTypeDistribution
        {
            Extension = kv.Key,
            Count = ActiveResult?.FileTypes.Where(ft => CategorizeExtension(ft.Key) == kv.Key)
                .Sum(ft => (long)ft.Value) ?? 0,
            TotalSize = kv.Value,
            Percentage = ActiveResult?.TotalSizeBytes > 0
                ? (kv.Value * 100.0) / ActiveResult.TotalSizeBytes
                : 0,
        })
        .ToList() ?? new();

    private static string CategorizeExtension(string ext)
    {
        var e = ext.ToLowerInvariant();
        if (e is "jpg" or "jpeg" or "png" or "gif" or "bmp" or "svg" or "webp" or "ico" or "tiff") return "Images";
        if (e is "mp4" or "mkv" or "avi" or "mov" or "wmv" or "flv" or "webm") return "Videos";
        if (e is "mp3" or "wav" or "flac" or "aac" or "ogg" or "m4a" or "wma") return "Audio";
        if (e is "zip" or "rar" or "7z" or "tar" or "gz" or "bz2" or "xz") return "Archives";
        if (e is "exe" or "dll" or "so" or "dylib" or "bat" or "cmd" or "ps1") return "Executables";
        if (e is "js" or "ts" or "py" or "rs" or "c" or "cpp" or "h" or "java" or "cs" or "go" or "rb") return "Source code";
        if (e is "json" or "xml" or "yaml" or "yml" or "toml" or "csv") return "Data";
        if (e is "pdf" or "doc" or "docx" or "xls" or "xlsx" or "ppt" or "pptx" or "txt" or "md") return "Documents";
        if (e is "html" or "css" or "scss" or "less") return "Web";
        if (e is "dll" or "sys" or "drv") return "System";
        return "Other";
    }

    public List<FileSizeEntry> LargestFiles => ActiveResult?.LargestFiles ?? new();

    public string PotentialCleanupDisplay => ActiveResult != null && ActiveResult.PotentialCleanupBytes > 0
        ? ByteFormatter.FormatBytes(ActiveResult.PotentialCleanupBytes)
        : "";

    public string ResultTimestampDisplay => ActiveResult != null && !string.IsNullOrEmpty(ActiveResult.Timestamp)
        ? $"Scanned at {ActiveResult.Timestamp}"
        : "";

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

    public List<string> ScanErrors => ActiveResult?.Errors ?? new();

    public bool HasScanErrors => ActiveResult != null && ActiveResult.Errors.Count > 0;
    public bool HasEmptyDirs => ActiveResult != null && ActiveResult.EmptyDirs.Count > 0;
    public int EmptyDirsCount => ActiveResult?.EmptyDirs.Count ?? 0;
    public List<string> EmptyDirs => ActiveResult?.EmptyDirs ?? new();

    // ── Persistence ──

    private void Load()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer(LocalSettingsKey, ApplicationDataCreateDisposition.Always);

            if (container.Values.TryGetValue("DepthValue", out var v) && v is double d)
                _depthValue = d;
            if (container.Values.TryGetValue("CustomMaxDepth", out v) && v is double cmd)
                _customMaxDepth = cmd;
            if (container.Values.TryGetValue("IncludeHidden", out v) && v is bool h)
                _includeHidden = h;
            if (container.Values.TryGetValue("ScanPath", out v))
                _scanPath = v?.ToString() ?? _scanPath;

            // Fire change notifications so the UI reflects loaded values
            // without triggering Save() from each property setter.
            OnPropertyChanged(nameof(DepthValue));
            OnPropertyChanged(nameof(SelectedDepthMode));
            OnPropertyChanged(nameof(ResultDepthDisplay));
            OnPropertyChanged(nameof(DeepScan));
            OnPropertyChanged(nameof(ShallowScan));
            OnPropertyChanged(nameof(DepthInt));
            OnPropertyChanged(nameof(ShowCustomDepthSlider));
            OnPropertyChanged(nameof(IncludeHidden));
            OnPropertyChanged(nameof(ScanPath));
            OnPropertyChanged(nameof(PathExists));
            OnPropertyChanged(nameof(PathValidationMessage));
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

    private void InitializeQuickScanTargets()
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        QuickScanTargets.Add(new QuickScanTarget { Name = "User Profile", Path = userProfile });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Desktop", Path = Environment.GetFolderPath(Environment.SpecialFolder.Desktop) });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Documents", Path = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Downloads", Path = Path.Combine(userProfile, "Downloads") });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Pictures", Path = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures) });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Local AppData", Path = localAppData });
        QuickScanTargets.Add(new QuickScanTarget { Name = "Temp", Path = Path.GetTempPath() });

        _selectedQuickScanTarget = QuickScanTargets[0];
        ScanPath = userProfile;
    }

    // ── Methods ──

    public async Task ScanAsync(CancellationToken ct = default)
    {
        if (IsScanning)
        {
            StatusMessage = "Scan already in progress";
            return;
        }

        if (string.IsNullOrWhiteSpace(ScanPath))
        {
            StatusMessage = "No path specified";
            return;
        }

        if (!Directory.Exists(ScanPath))
        {
            StatusMessage = $"Scan path does not exist: {ScanPath}";
            return;
        }

        try
        {
            IsScanning = true;
            IsStreaming = true;
            _scanStartTime = DateTime.UtcNow;
            StatusMessage = "Scanning...";
            ScanProgress = 0;
            LastResult = null;
            _partialResult = null;

            var progress = new Progress<StreamProgress>(HandleStreamingProgress);

            var result = await _scanner.ScanDirectoryStreamingAsync(
                ScanPath,
                depthMode: SelectedDepthMode,
                maxDepth: DepthInt,
                includeHidden: IncludeHidden,
                onProgress: progress,
                ct);

            LastResult = result;
            if (result != null)
            {
                StatusMessage = $"Scan complete: {result.TotalFiles:N0} files, {result.TotalSizeMb:F1} MB, {result.DurationSecs:F1}s";
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
            IsStreaming = false;
            ScanProgress = 0;
            _partialResult = null;
            _currentFile = string.Empty;
            _scanStartTime = default;
            OnPropertyChanged(nameof(ActiveResult));
            OnPropertyChanged(nameof(HasActiveResult));
            OnPropertyChanged(nameof(HasActiveResultVisibility));
            OnPropertyChanged(nameof(LiveFilesDisplay));
            OnPropertyChanged(nameof(LiveSizeDisplay));
            OnPropertyChanged(nameof(ResultFilesDisplay));
            OnPropertyChanged(nameof(ResultSizeDisplay));
            OnPropertyChanged(nameof(ResultDurationDisplay));
            OnPropertyChanged(nameof(ResultDirsDisplay));
            OnPropertyChanged(nameof(ResultAvgFileSizeDisplay));
            OnPropertyChanged(nameof(ResultSpeedDisplay));
            OnPropertyChanged(nameof(ResultSpeedMbDisplay));
            OnPropertyChanged(nameof(ResultErrorsDisplay));
            OnPropertyChanged(nameof(TopDirectories));
            OnPropertyChanged(nameof(FileTypes));
            OnPropertyChanged(nameof(CategoryDistributions));
            OnPropertyChanged(nameof(LargestFiles));
        OnPropertyChanged(nameof(PotentialCleanupDisplay));
        OnPropertyChanged(nameof(ResultTimestampDisplay));
            OnPropertyChanged(nameof(HasScanErrors));
            OnPropertyChanged(nameof(EmptyDirs));
            OnPropertyChanged(nameof(EmptyDirsCount));
            OnPropertyChanged(nameof(HasEmptyDirs));
            OnPropertyChanged(nameof(FilteredLargestFiles));
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
        _scanner.StopScan();
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
