// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class InstalledAppsViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;

    public InstalledAppsViewModel()
    {
    }

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); }
    }
    public bool IsNotScanning => !_isScanning;

    private string _statusMessage = "Ready to analyze installed applications";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private AppInventoryReport? _lastResult;
    public AppInventoryReport? LastResult
    {
        get => _lastResult;
        set
        {
            _lastResult = value;
            OnPropertyChanged();
                OnPropertyChanged(nameof(HasResult));
                OnPropertyChanged(nameof(HasResultVisibility));
                OnPropertyChanged(nameof(RedundantGroups));
                OnPropertyChanged(nameof(NotableGroups));
                OnPropertyChanged(nameof(HasNotable));
                OnPropertyChanged(nameof(TotalApps));
                OnPropertyChanged(nameof(DuplicateLocationGroups));
                OnPropertyChanged(nameof(MultiVersionGroups));
                OnPropertyChanged(nameof(TotalWastedDisplay));
                OnPropertyChanged(nameof(HasRedundancy));
        }
    }
    public bool HasResult => _lastResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility =>
        HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public int TotalApps => _lastResult?.TotalApps ?? 0;
    public int DuplicateLocationGroups => _lastResult?.DuplicateLocationGroups ?? 0;
    public int MultiVersionGroups => _lastResult?.MultiVersionGroups ?? 0;
    public string TotalWastedDisplay => _lastResult?.TotalWastedDisplay ?? "";
    public bool HasRedundancy => _lastResult?.HasRedundancy ?? false;
    public List<AppGroup> RedundantGroups => _lastResult?.RedundantGroups ?? new();

    /// <summary>
    /// Groups that are not flagged as redundant but are still worth surfacing:
    /// container/runtime data (Docker) and any large single-location install
    /// (>= 1 GB). The CLI intentionally reports Docker artifacts as distinct,
    /// non-redundant groups, so without this they would never appear on the page.
    /// </summary>
    public List<AppGroup> NotableGroups =>
        _lastResult?.Groups.Where(g => !g.HasRedundancy && (g.Source == "docker" || g.TotalSizeBytes >= 1_000_000_000)).ToList()
        ?? new();
    public bool HasNotable => NotableGroups.Count > 0;

    public async Task AnalyzeAsync()
    {
        if (IsScanning)
            return;

        try
        {
            IsScanning = true;
            StatusMessage = "Enumerating installed applications and dev tools...";
            LastResult = null;

            var result = await _scanner.RunAppInventoryAsync(CancellationToken.None);
            LastResult = result;

            if (result != null && result.HasRedundancy)
            {
                StatusMessage = $"Found {result.DuplicateLocationGroups} duplicate-location and " +
                                $"{result.MultiVersionGroups} multi-version install group(s) " +
                                $"({result.TotalWastedDisplay} reclaimable from older versions)";
                AppNotifications.Success("Installed-app inventory complete",
                    $"{result.DuplicateLocationGroups} duplicate-location, {result.MultiVersionGroups} multi-version groups");
            }
            else if (result != null)
            {
                StatusMessage = "Inventory complete — no duplicate-location or multi-version installs detected.";
                AppNotifications.Show("Installed-app inventory", "No redundant installs detected.");
            }
            else
            {
                StatusMessage = "Inventory returned no data.";
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[InstalledAppsViewModel] Analysis failed: {ex}");
            StatusMessage = $"Analysis failed: {ex.Message}";
            AppNotifications.Error("Installed-app inventory failed", ex.Message);
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
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }
}
