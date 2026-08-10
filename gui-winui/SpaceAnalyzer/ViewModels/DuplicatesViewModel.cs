// Licensed under the MIT License.

using System.ComponentModel;
using System.Runtime.CompilerServices;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class DuplicatesViewModel : INotifyPropertyChanged, IDisposable
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

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Deletes the extra copies of every selected group (keeps the first file of each group),
    /// then re-runs the analysis to refresh the view. Requires the user to have confirmed via
    /// the UI ContentDialog first.
    /// </summary>
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
                // Keep the first file; remove the remaining identical copies.
                for (int i = 1; i < g.Files.Count; i++)
                {
                    var file = g.Files[i];
                    try
                    {
                        if (System.IO.File.Exists(file))
                        {
                            System.IO.File.Delete(file);
                            removed++;
                            freed += g.Size;
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] delete failed {file}: {ex}");
                    }
                }
            }

            StatusMessage = $"Removed {removed} duplicate copies ({ByteFormatter.FormatBytes(freed)} reclaimed)";
            AppNotifications.Success("Duplicates removed", $"{removed} duplicate copies removed");
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

        await AnalyzeAsync();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
