// Licensed under the MIT License.
using System.IO;
using System.Linq;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class HistoryViewModel
{
    public async Task LoadDetailsAsync(ScanHistoryRecord record)
    {
        try
        {
            AppLog.Page($"LoadDetailsAsync id={record.Id}");
            IsLoading = true;
            StatusMessage = "Loading details...";
            var details = await _scanner.GetScanDetailsAsync(record.Id);
            SelectedRecord = details ?? record;
            StatusMessage = "Details loaded";
            AppLog.Page($"LoadDetailsAsync id={record.Id} -> {(details is null ? "fallback-to-list-record" : "details-loaded")}, dirs={SelectedRecord.TopDirectories.Count}, files={SelectedRecord.LargestFiles.Count}");
        }
        catch (Exception ex)
        {
            AppLog.Exception(ex, $"LoadDetailsAsync id={record.Id}");
            StatusMessage = $"Failed to load details: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>Load a specific history record by id and open its details view.
    /// Used by the "Saved to history · View details" bridge from the scan page.</summary>
    public async Task SelectRecordByIdAsync(long id)
    {
        try
        {
            AppLog.Page($"SelectRecordByIdAsync id={id}");
            IsLoading = true;
            StatusMessage = "Loading details...";
            var record = await _scanner.GetScanDetailsAsync(id);
            if (record == null)
            {
                StatusMessage = $"Scan record {id} not found";
                return;
            }
            SelectedRecord = record;
            StatusMessage = "Details loaded";
        }
        catch (Exception ex)
        {
            AppLog.Exception(ex, $"SelectRecordByIdAsync id={id}");
            StatusMessage = $"Failed to load details: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    public void BackToList()
    {
        SelectedRecord = null;
    }

    public async Task DeleteHistoryAsync(long id)
    {
        try
        {
            IsLoading = true;
            StatusMessage = "Deleting...";
            var success = await _scanner.DeleteScanAsync(id);
            if (success)
            {
                History = History.Where(r => r.Id != id).ToList();
                TotalCount = Math.Max(0, TotalCount - 1);
                if (_selectedRecord?.Id == id)
                    SelectedRecord = null;
                StatusMessage = "Deleted";
                AppNotifications.Success("Scan record deleted", $"Record {id} removed from history");
                await LoadTrendAsync();
            }
            else
            {
                StatusMessage = "Delete failed — scanner unavailable";
                AppNotifications.Error("Delete failed", "Scanner is unavailable");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] Delete failed: {ex}");
            StatusMessage = $"Delete failed: {ex.Message}";
            AppNotifications.Error("Delete failed", ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }

}
