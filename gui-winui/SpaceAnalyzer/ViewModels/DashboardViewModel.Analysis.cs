// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class DashboardViewModel
{
    /// <summary>
    /// Compute bloat findings, cleanup recommendations, and a storage forecast
    /// from the scan history. Runs synchronously over in-memory data.
    /// </summary>
    /// <summary>
    /// Compute bloat findings, cleanup recommendations, and a storage forecast
    /// from the scan history. Bloat detection and the storage forecast are pulled
    /// from the Rust backend (<c>bloat</c> / <c>predict</c> subcommands) so the
    /// WinUI surfaces the actual Rust classifier/prediction; each falls back to
    /// the local heuristic in <see cref="AnalysisEngine"/> when the CLI is
    /// unavailable or returns nothing.
    /// </summary>
    private async Task LoadAnalysisPanelsAsync(List<ScanHistoryRecord> history)
    {
        AnalysisUsingOfflineFallback = false;
        try
        {
            var latest = history.FirstOrDefault();
            if (latest != null)
            {
                BloatFindings = await GetBloatFindingsWithFallbackAsync(latest);
                Recommendations = await GetRecommendationsWithFallbackAsync(latest);
            }
            else
            {
                BloatFindings = new List<BloatFinding>();
                Recommendations = new List<Recommendation>();
            }

            StorageForecast = await GetForecastWithFallbackAsync(history);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[DashboardViewModel] LoadAnalysisPanels failed: {ex}");
        }
    }

    private async Task<List<BloatFinding>> GetBloatFindingsWithFallbackAsync(ScanHistoryRecord latest)
    {
        try
        {
            var backend = await _scanner.GetBloatFindingsAsync(latest.Id);
            if (backend is { Count: > 0 })
                return backend;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[DashboardViewModel] backend bloat failed: {ex}");
        }
        AnalysisUsingOfflineFallback = true;
        return AnalysisEngine.GetBloatFindings(latest);
    }

    private async Task<List<Recommendation>> GetRecommendationsWithFallbackAsync(ScanHistoryRecord latest)
    {
        try
        {
            var backend = await _scanner.GetRecommendationsAsync(latest.Id);
            if (backend is { Count: > 0 })
                return backend;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[DashboardViewModel] backend recommendations failed: {ex}");
        }
        AnalysisUsingOfflineFallback = true;
        return AnalysisEngine.GetRecommendations(latest);
    }

    private async Task<StoragePrediction> GetForecastWithFallbackAsync(List<ScanHistoryRecord> history)
    {
        try
        {
            var backend = await _scanner.GetStorageForecastAsync(30);
            if (backend is not null)
                return backend;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[DashboardViewModel] backend forecast failed: {ex}");
        }
        AnalysisUsingOfflineFallback = true;
        return AnalysisEngine.PredictStorage(history, 30);
    }
}
