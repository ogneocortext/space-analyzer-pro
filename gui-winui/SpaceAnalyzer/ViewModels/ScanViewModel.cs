// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;
using Windows.Storage;

namespace SpaceAnalyzer.ViewModels;

public partial class ScanViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;
    private const string LocalSettingsKey = "SpaceAnalyzer.ScanSettings";

    public ScanViewModel()
    {
        Load();
        InitializeQuickScanTargets();
        _scanner.GpuAcceleration = AppSettings.GpuAcceleration;
        SettingsStore.SettingsChanged += OnSettingsChanged;
        ApplyDefaultScanPath();
    }

    private void ApplyDefaultScanPath()
    {
        if (!string.IsNullOrWhiteSpace(_scanPath) && Directory.Exists(_scanPath))
            return;
        var raw = AppSettings.DefaultScanPaths;
        if (string.IsNullOrEmpty(raw)) return;
        var first = raw.Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim().Trim('"'))
            .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p) && Directory.Exists(p));
        if (first != null)
        {
            _scanPath = first;
            OnPropertyChanged(nameof(ScanPath));
            OnPropertyChanged(nameof(PathExists));
            OnPropertyChanged(nameof(PathValidationMessage));
        }
    }

    private void OnSettingsChanged(object? sender, SettingsStore.SettingsChangedEventArgs e)
    {
        if (_disposed) return;
        if (e.Key == SettingKeys.IncludeHidden)
            IncludeHidden = AppSettings.IncludeHidden;
        else if (e.Key == SettingKeys.GpuAcceleration)
            _scanner.GpuAcceleration = AppSettings.GpuAcceleration;
        else if (e.Key == SettingKeys.UseFileCache)
            _scanner.UseFileCache = AppSettings.UseFileCache;
        _scanner.UseFileCache = AppSettings.UseFileCache;
    }

    private string _scanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string ScanPath
    {
        get => _scanPath;
        set
        {
            var normalized = (value ?? string.Empty).Trim();
            // Normalize directory separators to backslash (forward slashes are
            // treated as separators on Windows) without altering legitimate
            // backslashes in the path.
            normalized = normalized.Replace('/', '\\');
            if (_scanPath == normalized) return;
            _scanPath = normalized;
            OnPropertyChanged();
            OnPropertyChanged(nameof(PathExists));
            OnPropertyChanged(nameof(PathValidationMessage));
            OnPropertyChanged(nameof(CanScan));
        }
    }

    public ObservableCollection<QuickScanTarget> QuickScanTargets { get; } = new();

    public ObservableCollection<ScannerService.DepthMode> DepthModes { get; } = new()
    {
        ScannerService.DepthMode.Shallow,
        ScannerService.DepthMode.Default,
        ScannerService.DepthMode.Deep,
        ScannerService.DepthMode.Custom,
    };

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
    private bool _customScan;
    public double DepthValue
    {
        get => _depthValue;
        set
        {
            _depthValue = value;
            if (SelectedDepthMode == ScannerService.DepthMode.Custom)
                _customMaxDepth = DepthInt;
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

    public bool CustomScan => SelectedDepthMode == ScannerService.DepthMode.Custom;

    public bool ShowCustomDepthSlider => SelectedDepthMode == ScannerService.DepthMode.Custom;

    public ScannerService.DepthMode SelectedDepthMode
    {
        get
        {
            if (_customScan) return ScannerService.DepthMode.Custom;
            if (DepthInt == 1) return ScannerService.DepthMode.Shallow;
            if (DepthInt >= 20) return ScannerService.DepthMode.Deep;
            if (DepthInt == 5) return ScannerService.DepthMode.Default;
            return ScannerService.DepthMode.Custom;
        }
        set
        {
            _customScan = value == ScannerService.DepthMode.Custom;
            _customMaxDepth = value switch
            {
                ScannerService.DepthMode.Shallow => 1,
                ScannerService.DepthMode.Deep => 20,
                ScannerService.DepthMode.Default => 5,
                ScannerService.DepthMode.Custom => _customMaxDepth > 1 && _customMaxDepth < 20 ? _customMaxDepth : 5,
                _ => 5
            };
            DepthValue = _customMaxDepth;
            OnPropertyChanged(nameof(CustomScan));
            OnPropertyChanged(nameof(ShowCustomDepthSlider));
        }
    }

    private bool _includeHidden;
    public bool IncludeHidden
    {
        get => _includeHidden;
        set { _includeHidden = value; OnPropertyChanged(); Save(); }
    }

    public bool UseFileCache
    {
        get => AppSettings.UseFileCache;
        set { if (AppSettings.UseFileCache == value) return; AppSettings.UseFileCache = value; OnPropertyChanged(); }
    }

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); OnPropertyChanged(nameof(CanStopScan)); OnPropertyChanged(nameof(CanScan)); OnPropertyChanged(nameof(IsScanningVisibility)); OnPropertyChanged(nameof(IsNotScanningVisibility)); }
    }
    public bool IsNotScanning => !_isScanning;
    public bool CanStopScan => _isScanning;
    public bool CanScan => !_isScanning && !string.IsNullOrWhiteSpace(_scanPath);
    public Microsoft.UI.Xaml.Visibility IsScanningVisibility => _isScanning ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility IsNotScanningVisibility => _isScanning ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    private double _scanProgress;
    public double ScanProgress
    {
        get => _scanProgress;
        set { _scanProgress = value; OnPropertyChanged(); OnPropertyChanged(nameof(ScanProgressDisplay)); }
    }
    public string ScanProgressDisplay => $"{ScanProgress:F0}%";

    private bool _isLoading;
    public bool IsLoading
    {
        get => _isLoading;
        set { _isLoading = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotLoading)); OnPropertyChanged(nameof(LoadingVisibility)); }
    }
    public bool IsNotLoading => !_isLoading;
    public Microsoft.UI.Xaml.Visibility LoadingVisibility => _isLoading ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    private string _statusMessage = "Ready to scan";
    public string StatusMessage
    {
        get => _statusMessage;
        set
        {
            _statusMessage = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsReady));
            OnPropertyChanged(nameof(StatusIcon));
        }
    }

    /// <summary>True when the scan is idle and ready to start (no active/completed run).</summary>
    public bool IsReady => _statusMessage == "Ready to scan";

    /// <summary>Segoe MDL2 glyph for the status indicator: a green checkmark when ready, a play glyph otherwise.</summary>
    public string StatusIcon => IsReady ? "\uE73E" : "\uE768";

    public string LiveStatusDisplay => IsStreaming && _partialResult != null
        ? $"Scanning: {_currentFile}"
        : StatusMessage;

    private ScanResult? _lastResult;
    private DateTime _lastProgressUpdate;
    private ScanResult? _partialResult;
    private string _currentFile = string.Empty;
    private DateTime _scanStartTime;

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

    public string ScanSummaryDisplay => LastResult != null
        ? $"{ResultFilesDisplay} · {ResultSizeDisplay} · {ResultDurationDisplay} · {ResultErrorsDisplay}"
        : string.Empty;

    public bool HasScanSummary => !string.IsNullOrEmpty(ScanSummaryDisplay);
    public Microsoft.UI.Xaml.Visibility HasScanSummaryVisibility => HasScanSummary ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

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

    public enum ResultTab { Summary, Distribution, LargestFiles, LargestDirectories }
    private ResultTab _activeResultTab = ResultTab.Summary;
    public ResultTab ActiveResultTab
    {
        get => _activeResultTab;
        set { _activeResultTab = value; OnPropertyChanged(); OnPropertyChanged(nameof(ShowSummaryTab)); OnPropertyChanged(nameof(ShowDistributionTab)); OnPropertyChanged(nameof(ShowLargestFilesTab)); OnPropertyChanged(nameof(ShowLargestDirectoriesTab)); }
    }
    public bool ShowSummaryTab => _activeResultTab == ResultTab.Summary;
    public bool ShowDistributionTab => _activeResultTab == ResultTab.Distribution;
    public bool ShowLargestFilesTab => _activeResultTab == ResultTab.LargestFiles;
    public bool ShowLargestDirectoriesTab => _activeResultTab == ResultTab.LargestDirectories;

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

    public bool HasPotentialCleanup => ActiveResult != null && ActiveResult.PotentialCleanupBytes > 0;

    public long? LastSavedHistoryId { get; private set; }

    public bool HasSavedHistory => LastSavedHistoryId.HasValue;

    public Microsoft.UI.Xaml.Visibility HasSavedHistoryVisibility =>
        HasSavedHistory ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

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
            OnPropertyChanged(nameof(FilteredLargestFiles));
            OnPropertyChanged(nameof(LiveFilesDisplay));
            OnPropertyChanged(nameof(LiveSizeDisplay));
            OnPropertyChanged(nameof(ScanSummaryDisplay));
            OnPropertyChanged(nameof(HasScanSummary));
            OnPropertyChanged(nameof(HasScanSummaryVisibility));
        }
    }

    public bool HasResult => _lastResult != null;
    public bool HasActiveResult => ActiveResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility => HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility HasActiveResultVisibility => HasActiveResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        SettingsStore.SettingsChanged -= OnSettingsChanged;
        _scanner.StopScan();
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }
}
