// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class CleanupViewModel
{
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
}
