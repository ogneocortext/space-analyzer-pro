// Licensed under the MIT License.
using System.IO;
using System.Linq;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class HistoryViewModel
{
    public async Task PruneDuplicateScansAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Removing duplicate scans...";
            var (success, duplicates, _, error) = await _scanner.PruneDuplicateScansAsync();
            if (success)
            {
                var msg = duplicates > 0
                    ? $"Removed {duplicates} duplicate scan record(s)."
                    : "No duplicate scans found.";
                StatusMessage = msg;
                AppNotifications.Success("Duplicates cleaned", msg);
                await LoadHistoryAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    // ── Database / cache management ──

    private DatabaseInfo? _dbInfo;
    public DatabaseInfo? DbInfo
    {
        get => _dbInfo;
        set
        {
            _dbInfo = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DbInfoSummary));
        }
    }
    public string DbInfoSummary => _dbInfo?.Summary ?? "Database info unavailable";

    /// <summary>Refresh the cache-stats panel without touching the history list.</summary>
    public async Task LoadDatabaseInfoAsync()
    {
        try
        {
            DbInfo = await _scanner.GetDatabaseInfoAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadDatabaseInfo failed: {ex}");
            DbInfo = null;
        }
    }

    public async Task PruneEmptyScansAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Removing empty scans...";
            var (success, removed, error) = await _scanner.PruneEmptyScansAsync();
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} empty scan record(s)."
                    : "No empty scans found.";
                StatusMessage = msg;
                AppNotifications.Success("Empty scans cleaned", msg);
                await LoadHistoryAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune empty failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneRelativeScansAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Removing non-absolute paths...";
            var (success, removed, error) = await _scanner.PruneRelativeScansAsync();
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} scan record(s) with invalid paths."
                    : "No invalid-path scans found.";
                StatusMessage = msg;
                AppNotifications.Success("Path prune complete", msg);
                await LoadHistoryAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune relative failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task BackfillCategoriesAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Recomputing categories...";
            var (success, updated, error) = await _scanner.BackfillCategoriesAsync();
            if (success)
            {
                var msg = updated > 0
                    ? $"Recomputed categories for {updated} scan(s)."
                    : "All scans already have category data.";
                StatusMessage = msg;
                AppNotifications.Success("Categories recomputed", msg);
                // Categories are read when a record's details are opened, so a list
                // reload is unnecessary; just refresh the stats panel.
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Back-fill failed: {error}";
                AppNotifications.Error("Back-fill failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Backfill failed: {ex}");
            StatusMessage = $"Back-fill failed: {ex.Message}";
            AppNotifications.Error("Back-fill failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task VacuumDatabaseAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Compacting database...";
            var (success, error) = await _scanner.VacuumDatabaseAsync();
            if (success)
            {
                StatusMessage = "Database compacted.";
                AppNotifications.Success("Database compacted", "Reclaimed free space.");
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Vacuum failed: {error}";
                AppNotifications.Error("Vacuum failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Vacuum failed: {ex}");
            StatusMessage = $"Vacuum failed: {ex.Message}";
            AppNotifications.Error("Vacuum failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneFileCacheAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Cleaning stale file cache...";
            var (success, removed, error) = await _scanner.PruneFileCacheAsync();
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} stale file-cache row(s)."
                    : "No stale file-cache entries found.";
                StatusMessage = msg;
                AppNotifications.Success("File cache cleaned", msg);
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune file cache failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task PruneDiskSpaceAsync(int keepHours)
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Pruning disk-space history...";
            var (success, removed, error) = await _scanner.PruneDiskSpaceAsync(keepHours);
            if (success)
            {
                var msg = removed > 0
                    ? $"Removed {removed} disk-space snapshot(s) older than {keepHours}h."
                    : "No old disk-space snapshots to remove.";
                StatusMessage = msg;
                AppNotifications.Success("Disk history pruned", msg);
                await LoadDatabaseInfoAsync();
            }
            else
            {
                StatusMessage = $"Prune failed: {error}";
                AppNotifications.Error("Prune failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Prune disk space failed: {ex}");
            StatusMessage = $"Prune failed: {ex.Message}";
            AppNotifications.Error("Prune failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task ClearHistoryAsync()
    {
        if (IsLoading) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Clearing all history...";
            var (success, removed, error) = await _scanner.ClearHistoryAsync();
            if (success)
            {
                var msg = $"Cleared {removed} scan record(s).";
                StatusMessage = msg;
                AppNotifications.Success("History cleared", msg);
                History = new List<ScanHistoryRecord>();
                TotalCount = 0;
                SelectedRecord = null;
                DbInfo = null;
                await LoadTrendAsync();
            }
            else
            {
                StatusMessage = $"Clear failed: {error}";
                AppNotifications.Error("Clear failed", error);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Clear failed: {ex}");
            StatusMessage = $"Clear failed: {ex.Message}";
            AppNotifications.Error("Clear failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

}
