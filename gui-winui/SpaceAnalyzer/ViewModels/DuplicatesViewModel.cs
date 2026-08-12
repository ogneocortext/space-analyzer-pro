// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class DuplicatesViewModel : ViewModelBase, IDisposable
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
        set { _scanPath = value; OnPropertyChanged(); }
    }

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); }
    }
    public bool IsNotScanning => !_isScanning;

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
    // DedupResult.TotalDuplicateFiles is long (Rust usize); narrow to int for display.
    public int TotalDuplicateFiles => (int)(_lastResult?.TotalDuplicateFiles ?? 0);
    public string PotentialSavingsDisplay => _lastResult?.PotentialSavingsDisplay ?? "";
    public List<DuplicateGroup> DuplicateGroups => _lastResult?.DuplicateGroups ?? new();

    // ── Sorting ──

    private string _sortKey = "Wasted";
    public string SortKey
    {
        get => _sortKey;
        set
        {
            if (_sortKey == value) return;
            _sortKey = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(SortedGroups));
        }
    }

    /// <summary>Sorted copy of the groups, used by the results list (newest/largest first).</summary>
    public List<DuplicateGroup> SortedGroups
    {
        get
        {
            if (_lastResult == null) return new List<DuplicateGroup>();
            return _sortKey switch
            {
                "Size" => _lastResult.DuplicateGroups.OrderByDescending(g => g.Size).ToList(),
                "Files" => _lastResult.DuplicateGroups.OrderByDescending(g => g.FileCount).ToList(),
                _ => _lastResult.DuplicateGroups.OrderByDescending(g => g.WastedBytes).ToList(),
            };
        }
    }

    public int SortIndex
    {
        get => _sortKey == "Size" ? 1 : _sortKey == "Files" ? 2 : 0;
        set => SortKey = value switch { 1 => "Size", 2 => "Files", _ => "Wasted" };
    }

    // ── Selection (for removal) ──

    public bool HasSelection => _lastResult != null && _lastResult.DuplicateGroups.Any(g => g.IsSelected);
    public int SelectedCount => _lastResult?.DuplicateGroups.Count(g => g.IsSelected) ?? 0;

    private bool _isRemoving;
    public bool IsRemoving
    {
        get => _isRemoving;
        set { _isRemoving = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotRemoving)); }
    }
    public bool IsNotRemoving => !_isRemoving;

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
        // DuplicateGroup has no INotifyPropertyChanged, so the per-group checkboxes
        // (TwoWay-bound to IsSelected) won't refresh from a model-side change unless
        // the bound collection is replaced. SortedGroups returns a fresh list, forcing
        // the ItemsRepeater to rebuild and re-read IsSelected.
        OnPropertyChanged(nameof(SortedGroups));
    }

    public async Task AnalyzeAsync()
    {
        if (IsScanning || string.IsNullOrWhiteSpace(ScanPath))
            return;

        try
        {
            IsScanning = true;
            StatusMessage = "Analyzing duplicates...";
            LastResult = null;

            var result = await _scanner.RunDedupAnalysisAsync(ScanPath);
            LastResult = result;

            if (result != null && result.DuplicateGroups.Any())
            {
                StatusMessage = $"Found {result.DuplicateGroups.Count} duplicate groups, {result.TotalDuplicateFiles} files, {result.PotentialSavingsDisplay} reclaimable";
                AppNotifications.Success("Duplicate analysis complete",
                    $"{result.TotalDuplicateFiles} files in {result.DuplicateGroups.Count} groups ({result.PotentialSavingsDisplay} reclaimable)");
            }
            else
            {
                StatusMessage = "No duplicate files found";
                AppNotifications.Show("Duplicate analysis", "No duplicate files found");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] Analysis failed: {ex}");
            StatusMessage = $"Analysis failed: {ex.Message}";
            AppNotifications.Error("Duplicate analysis failed", ex.Message);
        }
        finally
        {
            IsScanning = false;
        }
    }

    /// <summary>
    /// Applies hard links for every duplicate in the last analysis. Hard-linking
    /// collapses identical copies onto one inode, reclaiming space without ever
    /// destroying file content (every path keeps opening normally). This is the
    /// safe, non-destructive reclaim path - nothing is sent to the Recycle Bin.
    /// </summary>
    public async Task ApplyHardlinksAsync()
    {
        if (IsScanning || string.IsNullOrWhiteSpace(ScanPath))
            return;

        try
        {
            IsScanning = true;
            StatusMessage = "Hardlinking duplicates...";
            var result = await _scanner.RunDedupAnalysisAsync(ScanPath, CancellationToken.None, apply: true);
            if (result != null)
            {
                var saved = result.SpaceSavedBytes ?? 0UL;
                StatusMessage = saved > 0
                    ? $"Hardlinked duplicates - {ByteFormatter.FormatBytes(saved)} reclaimed"
                    : "No reclaimable space (duplicates already collapsed or none found)";
                AppNotifications.Success("Hardlink complete",
                    saved > 0 ? $"{ByteFormatter.FormatBytes(saved)} reclaimed" : "Nothing to reclaim");
            }
            else
            {
                StatusMessage = "Hardlink failed: no result from scanner.";
                AppNotifications.Error("Hardlink failed", "The scanner returned no result.");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] Hardlink failed: {ex}");
            StatusMessage = $"Hardlink failed: {ex.Message}";
            AppNotifications.Error("Hardlink failed", ex.Message);
        }
        finally
        {
            IsScanning = false;
        }
    }

    // ── Deletion-impact preview (dependencies subcommand) ──

    private string _impactPath = string.Empty;
    public string ImpactPath
    {
        get => _impactPath;
        set { _impactPath = value; OnPropertyChanged(); }
    }

    private DependencyReport? _impactReport;
    public DependencyReport? ImpactReport
    {
        get => _impactReport;
        set
        {
            _impactReport = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasImpact));
            OnPropertyChanged(nameof(ImpactSummary));
            OnPropertyChanged(nameof(ImpactRelatedCount));
            OnPropertyChanged(nameof(ImpactSameStemCount));
            OnPropertyChanged(nameof(ImpactSiblingCount));
            OnPropertyChanged(nameof(ImpactSymlinkSourceCount));
            OnPropertyChanged(nameof(ImpactSiblingFiles));
        }
    }
    public bool HasImpact => _impactReport != null;
    public string ImpactSummary => _impactReport?.Summary ?? string.Empty;
    public int ImpactRelatedCount => _impactReport?.TotalRelated ?? 0;
    public int ImpactSameStemCount => _impactReport?.SameStemFiles.Count ?? 0;
    public int ImpactSiblingCount => _impactReport?.SiblingFiles.Count ?? 0;
    public int ImpactSymlinkSourceCount => _impactReport?.SymlinkSources.Count ?? 0;
    /// <summary>Null-safe list for the impact preview's sibling-files repeater.</summary>
    public List<RelatedFile> ImpactSiblingFiles => _impactReport?.SiblingFiles ?? new List<RelatedFile>();

    private bool _isAnalyzingImpact;
    public bool IsAnalyzingImpact
    {
        get => _isAnalyzingImpact;
        set { _isAnalyzingImpact = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotAnalyzingImpact)); }
    }
    public bool IsNotAnalyzingImpact => !_isAnalyzingImpact;

    /// <summary>
    /// Runs the Rust <c>dependencies</c> analysis on a single file so the user can
    /// see exactly which sibling/symlink/duplicate files would be affected BEFORE
    /// deleting anything. Nothing is deleted by this action.
    /// </summary>
    public async Task AnalyzeImpactAsync()
    {
        if (IsAnalyzingImpact || string.IsNullOrWhiteSpace(ImpactPath))
            return;

        try
        {
            IsAnalyzingImpact = true;
            StatusMessage = "Analyzing deletion impact...";
            var report = await _scanner.GetDependencyReportAsync(ImpactPath, CancellationToken.None);
            ImpactReport = report;
            StatusMessage = report != null
                ? $"Impact analysis complete: {report.TotalRelated} related file(s)."
                : "Impact analysis returned no data for that path.";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] Impact analysis failed: {ex}");
            StatusMessage = $"Impact analysis failed: {ex.Message}";
        }
        finally
        {
            IsAnalyzingImpact = false;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Fired after a non-zero number of files were sent to the Recycle Bin, so the
    /// host page can offer the user a chance to empty the bin (or restore files).
    /// </summary>
    public event EventHandler<int>? FilesSentToRecycleBin;

    public async Task RemoveSelectedAsync()
    {
        if (_lastResult == null) return;
        var groups = _lastResult.DuplicateGroups
            .Where(g => g.IsSelected && g.Files.Count > 1)
            .ToList();
        if (groups.Count == 0) return;

        IsRemoving = true;
        int removed = 0;
        ulong freed = 0;
        try
        {
            foreach (var g in groups)
            {
                // Keep the first file; remove the remaining identical copies by
                // routing them through the Recycle Bin so nothing is permanently
                // lost until the user explicitly empties it.
                for (int i = 1; i < g.Files.Count; i++)
                {
                    var file = g.Files[i];
                    try
                    {
                        if (System.IO.File.Exists(file) && FileOperations.SendToRecycleBin(file))
                        {
                            removed++;
                            freed += g.Size;
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] recycle failed {file}: {ex}");
                    }
                }
            }

            StatusMessage = $"Sent {removed} duplicate copies to the Recycle Bin ({ByteFormatter.FormatBytes(freed)} reclaimable)";
            AppNotifications.Success("Duplicates removed", $"{removed} duplicate copies moved to the Recycle Bin");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Removal failed: {ex.Message}";
            AppNotifications.Error("Duplicate removal failed", ex.Message);
        }
        finally
        {
            IsRemoving = false;
        }

        if (removed > 0)
            FilesSentToRecycleBin?.Invoke(this, removed);

        await AnalyzeAsync();
    }

}
