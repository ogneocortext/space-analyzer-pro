// Licensed under the MIT License.

using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Pure, in-process analysis that turns a scan's largest files / top directories and
/// the historical scan trend into bloat findings, cleanup recommendations, and a
/// storage forecast. Mirrors the heuristic logic in the Rust CLI
/// (<c>offline_ai.rs</c>, <c>cli/recommendations.rs</c>, <c>tool_registry/execution.rs</c>)
/// so the WinUI UI can surface it without shelling out to the scanner.
/// </summary>
public static class AnalysisEngine
{
    private const ulong HundredMb = 100UL * 1024 * 1024;
    private const ulong FiveHundredMb = 500UL * 1024 * 1024;
    private const double GbDivisor = 1024.0 * 1024 * 1024;

    private static readonly HashSet<string> s_videoExts = new() { ".mp4", ".avi", ".mkv", ".mov", ".wmv" };
    private static readonly HashSet<string> s_installerExts = new() { ".exe", ".msi", ".zip" };

    // ── Recommendations (gap 2.4) ──

    public static List<Recommendation> GetRecommendations(ScanHistoryRecord scan)
    {
        // Priority uses the same convention as Recommendation.PriorityLabel:
        // 1 = High (most urgent), 2 = Medium, 3 = Low. The Rust backend
        // (render::build_recommendations) ranks severity 3 = most urgent and
        // ScannerService.Recommend.cs inverts it on ingest to 1 = High, so this
        // local fallback must agree or urgent items would sort last / show as Low.
        var actions = new List<(int Priority, Recommendation Rec)>();

        foreach (var dir in scan.TopDirectories)
        {
            var lower = dir.Path.ToLowerInvariant();
            if (lower.Contains("cache") || lower.Contains("temp") || lower.Contains("tmp"))
            {
                actions.Add((1, new Recommendation
                {
                    Priority = 1,
                    Title = "Clear cache / temp folder",
                    Detail = $"{dir.Path} ({dir.FileCount:N0} files) — safe to clear via disk cleanup or app settings",
                    EstimatedSavingsBytes = dir.TotalSize,
                }));
            }
        }

        var installerSize = (ulong)scan.LargestFiles
            .Where(f => s_installerExts.Contains(System.IO.Path.GetExtension(f.Path).ToLowerInvariant())
                        && f.Size > HundredMb)
            .Sum(f => (double)f.Size);
        if (installerSize > HundredMb)
            actions.Add((1, new Recommendation
            {
                Priority = 1,
                Title = "Remove old installers",
                Detail = "Old installer files can be deleted after confirming the apps still work",
                EstimatedSavingsBytes = installerSize,
            }));

        foreach (var file in scan.LargestFiles)
        {
            var lower = file.Path.ToLowerInvariant();
            if (file.Size > HundredMb)
            {
                if (lower.Contains("ollama") || lower.Contains("models") || lower.Contains("blobs"))
                    actions.Add((2, new Recommendation
                    {
                        Priority = 2,
                        Title = "Prune unused AI models",
                        Detail = $"{file.Path} — consider `ollama prune` or removing unused models",
                        EstimatedSavingsBytes = file.Size,
                    }));
                else if (lower.Contains(".cache") || lower.Contains("pip"))
                    actions.Add((2, new Recommendation
                    {
                        Priority = 2,
                        Title = "Purge package cache",
                        Detail = $"{file.Path} — consider `pip cache purge` or manual cleanup",
                        EstimatedSavingsBytes = file.Size,
                    }));
            }
        }

        var nodeModulesSize = (ulong)scan.LargestFiles
            .Where(f => f.Path.ToLowerInvariant().Contains("node_modules"))
            .Sum(f => (double)f.Size);
        if (nodeModulesSize > HundredMb)
            actions.Add((3, new Recommendation
            {
                Priority = 3,
                Title = "Trim node_modules",
                Detail = "Dependency folders can be deleted in build directories and reinstalled with `npm ci`",
                EstimatedSavingsBytes = nodeModulesSize,
            }));

        actions.Sort((a, b) => a.Priority.CompareTo(b.Priority));
        return actions.Select(a => a.Rec).ToList();
    }

    // ── Bloat detection (gap 2.2) ──

    public static List<BloatFinding> GetBloatFindings(ScanHistoryRecord scan)
    {
        var findings = new List<BloatFinding>();

        foreach (var dir in scan.TopDirectories)
        {
            var lower = dir.Path.ToLowerInvariant();
            if (lower.Contains("cache") || lower.Contains("temp") || lower.Contains("tmp"))
                findings.Add(new BloatFinding
                {
                    Category = "Cache / Temp",
                    Description = $"{dir.FileCount:N0} files",
                    Path = dir.Path,
                    Size = dir.TotalSize,
                    Priority = 90,
                });
        }

        foreach (var file in scan.LargestFiles)
        {
            var lower = file.Path.ToLowerInvariant();
            var ext = System.IO.Path.GetExtension(file.Path).ToLowerInvariant();

            if (s_videoExts.Contains(ext) && file.Size > FiveHundredMb)
                findings.Add(Make(file, "Large Video", "May benefit from archiving to external storage", 80));
            else if (lower.Contains("ollama") || lower.Contains("models") || lower.Contains("blobs"))
                findings.Add(Make(file, "AI Model", "Local model weights — remove unused models to reclaim space", 85));
            else if (s_installerExts.Contains(ext))
                findings.Add(Make(file, "Installer", "Setup binary — usually safe to delete after install", 70));
            else if (lower.Contains("node_modules"))
                findings.Add(Make(file, "Dependencies", "Reinstallable build dependencies", 60));
            else if (ext is ".tmp" or ".log" or ".cache" || lower.Contains("cache") || lower.Contains("temp"))
                findings.Add(Make(file, "Cache / Temp", "Transient file — usually safe to delete", 90));
        }

        findings.Sort((a, b) => b.Size.CompareTo(a.Size));
        return findings.Take(15).ToList();
    }

    private static BloatFinding Make(FileSizeEntry f, string category, string description, int priority) => new()
    {
        Category = category,
        Description = description,
        Path = f.Path,
        Size = f.Size,
        Priority = priority,
    };

    // ── Storage forecast (gap 2.3) ──

    public static StoragePrediction PredictStorage(IEnumerable<ScanHistoryRecord> history, int daysAhead)
    {
        var points = history
            .Select(r => new { Record = r, Ts = TryParse(r.Timestamp) })
            .Where(x => x.Ts.HasValue && x.Record.TotalSizeBytes > 0)
            .OrderBy(x => x.Ts!.Value)
            .ToList();

        if (points.Count < 2)
        {
            var latest = points.LastOrDefault()?.Record;
            return new StoragePrediction
            {
                DaysAhead = daysAhead,
                CurrentSizeGb = latest != null ? latest.TotalSizeBytes / GbDivisor : 0,
                PredictedSizeGb = latest != null ? latest.TotalSizeBytes / GbDivisor : 0,
                ScansUsed = points.Count,
            };
        }

        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        int n = points.Count;
        for (int i = 0; i < n; i++)
        {
            double x = points[i].Ts!.Value;
            double y = points[i].Record.TotalSizeBytes;
            sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
        }

        double denom = n * sumX2 - sumX * sumX;
        double slope = Math.Abs(denom) < 1e-9 ? 0 : (n * sumXY - sumX * sumY) / denom;
        double intercept = (sumY - slope * sumX) / n;

        long lastTs = points[^1].Ts!.Value;
        long futureTs = lastTs + (long)(TimeSpan.FromDays(daysAhead).TotalSeconds);
        double predictedBytes = slope * futureTs + intercept;
        double currentBytes = points[^1].Record.TotalSizeBytes;

        return new StoragePrediction
        {
            DaysAhead = daysAhead,
            CurrentSizeGb = currentBytes / GbDivisor,
            PredictedSizeGb = predictedBytes / GbDivisor,
            GrowthRateGbPerDay = slope * 86400 / GbDivisor,
            ScansUsed = n,
            FirstScan = points[0].Record.Timestamp,
            LastScan = points[^1].Record.Timestamp,
        };
    }

    private static long? TryParse(string? timestamp)
    {
        if (string.IsNullOrWhiteSpace(timestamp))
            return null;
        if (DateTime.TryParse(timestamp, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return new DateTimeOffset(dt).ToUnixTimeSeconds();
        return null;
    }
}
