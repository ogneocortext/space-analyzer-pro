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
            try
            {
                DuplicateAnalysis = await _scanner.GetDuplicateAnalysisAsync(record.Id);
            }
            catch (Exception dex)
            {
                AppLog.Exception(dex, $"LoadDetailsAsync duplicates id={record.Id}");
                DuplicateAnalysis = new List<DuplicateAnalysisRecord>();
            }
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

    /// <summary>
    /// Run a duplicate-file analysis on the selected scan's path and refresh the
    /// stored analysis (the backend persists it, so it then shows in this view).
    /// </summary>
    public async Task RunDuplicateAnalysisAsync()
    {
        if (SelectedRecord == null) return;
        try
        {
            IsLoading = true;
            StatusMessage = "Running duplicate analysis...";
            var result = await _scanner.RunDedupAnalysisAsync(SelectedRecord.Path, linkScanId: SelectedRecord.Id);
            DuplicateAnalysis = await _scanner.GetDuplicateAnalysisAsync(SelectedRecord.Id);
            if (result != null)
                StatusMessage = $"Found {result.DuplicateGroups.Count} duplicate group(s)";
            else
                StatusMessage = "Duplicate analysis complete";
        }
        catch (Exception ex)
        {
            AppLog.Exception(ex, $"RunDuplicateAnalysisAsync id={SelectedRecord.Id}");
            StatusMessage = $"Duplicate analysis failed: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
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

    // ── Stored duplicate-file analysis for the selected scan ──

    private List<DuplicateAnalysisRecord> _duplicateAnalysis = new();

    public List<DuplicateAnalysisRecord> DuplicateAnalysis
    {
        get => _duplicateAnalysis;
        set
        {
            _duplicateAnalysis = value;
            var latest = _duplicateAnalysis.FirstOrDefault();
            DuplicateAnalysisLatest = latest;
            HasDuplicateAnalysis = latest != null;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasDuplicateAnalysis));
            OnPropertyChanged(nameof(DuplicateAnalysisLatest));
            OnPropertyChanged(nameof(DuplicateAnalysisDisplay));
            OnPropertyChanged(nameof(DuplicateGroupCountDisplay));
            OnPropertyChanged(nameof(DuplicateGroups));
        }
    }

    /// <summary>Flattened group list of the latest stored analysis (empty when none).</summary>
    public List<DuplicateGroup> DuplicateGroups =>
        DuplicateAnalysisLatest?.Groups ?? new List<DuplicateGroup>();

    /// <summary>Most recent stored analysis for the selected scan (or null).</summary>
    public DuplicateAnalysisRecord? DuplicateAnalysisLatest { get; private set; }

    /// <summary>True when the selected scan has at least one stored duplicate analysis.</summary>
    public bool HasDuplicateAnalysis { get; private set; }

    /// <summary>Compact summary for the details header, e.g. "12 groups · 1.2 GB reclaimable".</summary>
    public string DuplicateAnalysisDisplay
    {
        get
        {
            if (DuplicateAnalysisLatest == null) return string.Empty;
            return $"{DuplicateAnalysisLatest.GroupCount} group{(DuplicateAnalysisLatest.GroupCount == 1 ? "" : "s")} · {DuplicateAnalysisLatest.PotentialSavingsDisplay} reclaimable";
        }
    }

    /// <summary>Group count for the latest analysis, for compact display.</summary>
    public string DuplicateGroupCountDisplay =>
        DuplicateAnalysisLatest == null ? "0" : DuplicateAnalysisLatest.GroupCount.ToString();

}
