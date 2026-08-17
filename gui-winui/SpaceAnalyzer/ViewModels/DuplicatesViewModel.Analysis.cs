// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class DuplicatesViewModel
{
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
}
