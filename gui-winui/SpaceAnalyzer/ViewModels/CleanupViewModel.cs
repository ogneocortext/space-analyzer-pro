// Licensed under the MIT License.

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using SpaceAnalyzer.Helpers;
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

    public async Task AnalyzeTempAsync()
    {
        if (_disposed || IsAnalyzing || string.IsNullOrWhiteSpace(TargetPath))
            return;

        _cts.Dispose();
        _cts = new CancellationTokenSource();

        try
        {
            IsAnalyzing = true;
            StatusMessage = $"Scanning {TargetPath} for temp/cache entries...";
            TempEntries = new ObservableCollection<TempCleanupEntry>();

            var dir = new DirectoryInfo(TargetPath);
            if (!dir.Exists)
            {
                StatusMessage = "Target directory does not exist.";
                AppNotifications.Show("Cleanup", "Target directory does not exist");
                return;
            }

            var entries = new List<TempCleanupEntry>();
            await Task.Run(() =>
            {
                foreach (var fs in dir.EnumerateFileSystemInfos("*", SearchOption.TopDirectoryOnly))
                {
                    bool isDir = (fs.Attributes & FileAttributes.Directory) == FileAttributes.Directory;
                    entries.Add(new TempCleanupEntry
                    {
                        Path = fs.FullName,
                        IsDirectory = isDir,
                        SizeBytes = FileOperations.GetSize(fs.FullName),
                        LastWrite = fs.LastWriteTimeUtc,
                    });
                }
            }, _cts.Token);

            entries.Sort((a, b) => b.SizeBytes.CompareTo(a.SizeBytes));
            foreach (var e in entries)
                e.PropertyChanged += (_, _) =>
                {
                    OnPropertyChanged(nameof(TempSelectedCount));
                    OnPropertyChanged(nameof(TempHasSelection));
                    OnPropertyChanged(nameof(TempSelectedSizeDisplay));
                };
            TempEntries = new ObservableCollection<TempCleanupEntry>(entries);

            StatusMessage = $"Found {entries.Count} entries ({TempSelectedSizeDisplay} total). Select items to clean.";
            AppNotifications.Success("Temp scan complete", $"{entries.Count} entries found in {TargetPath}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CleanupViewModel] Temp analysis failed: {ex}");
            StatusMessage = $"Analysis failed: {ex.Message}";
            AppNotifications.Error("Temp analysis failed", ex.Message);
        }
        finally
        {
            IsAnalyzing = false;
        }
    }

    /// <summary>
    /// Sends all selected temp entries to the Recycle Bin. Returns a short summary.
    /// Assumes the UI has already confirmed the action with the user.
    /// </summary>
    public async Task<string> DeleteSelectedTempAsync()
    {
        var selected = _tempEntries.Where(e => e.IsSelected).ToList();
        if (selected.Count == 0) return "Nothing selected.";

        int removed = 0;
        ulong freed = 0;
        await Task.Run(() =>
        {
            foreach (var e in selected)
            {
                if (FileOperations.SendToRecycleBin(e.Path))
                {
                    removed++;
                    freed += e.SizeBytes;
                }
            }
        });

        // Drop removed entries from the list.
        foreach (var e in selected.Where(x => !File.Exists(x.Path) && !Directory.Exists(x.Path)))
            _tempEntries.Remove(e);

        string summary = $"Moved {removed} item(s) ({ByteFormatter.FormatBytes(freed)}) to Recycle Bin.";
        StatusMessage = summary;
        OnPropertyChanged(nameof(TempSelectedCount));
        OnPropertyChanged(nameof(TempSelectedSizeDisplay));
        AppNotifications.Success("Temp cleanup complete", summary);
        return summary;
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
                AppNotifications.Success("Cleanup analysis complete",
                    $"{result.NodeModulesCount} node_modules directories ({result.TotalCleanupSizeDisplay}) found");
            }
            else
            {
                StatusMessage = "No node_modules found or analysis returned no data.";
                AppNotifications.Show("Cleanup analysis", "No node_modules directories found");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CleanupViewModel] Analysis failed: {ex}");
            StatusMessage = $"Analysis failed: {ex.Message}";
            AppNotifications.Error("Cleanup analysis failed", ex.Message);
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
