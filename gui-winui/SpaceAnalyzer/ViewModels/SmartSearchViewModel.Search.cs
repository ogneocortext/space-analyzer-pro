// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class SmartSearchViewModel
{
    public async Task SearchAsync()
    {
        if (IsSearching || string.IsNullOrWhiteSpace(SearchPath) || string.IsNullOrWhiteSpace(SearchQuery))
            return;

        _cts.Dispose();
        var newCts = new CancellationTokenSource();
        _cts = newCts;

        var ct = _cts.Token;
        IsSearching = true;
        StatusMessage = "Searching...";
        _results.Clear();
        DisplayResults.Clear();
        GroupedResults.Clear();
        ResultCount = 0;
        HardCapped = false;
        SemanticResults.Clear();
        SemanticResultCount = 0;

        try
        {
            if (string.IsNullOrWhiteSpace(SearchPath) || !Directory.Exists(SearchPath))
            {
                StatusMessage = $"Path not found: {SearchPath}";
                return;
            }

            if (_isSemantic)
            {
                await SearchSemanticAsync(ct);
            }
            else if (_scanner.IsAvailable)
            {
                await SearchWithScannerAsync();
            }
            else
            {
                await SearchWithManagedWalkAsync();
            }

            if (StatusMessage == "Searching...")
            {
                if (_isSemantic)
                {
                    StatusMessage = HardCapped
                        ? $"Found {SemanticResults.Count} semantic match(es) shown (capped at {HardCap})."
                        : $"Found {SemanticResults.Count} semantic match(es).";
                }
                else
                {
                    var more = HardCapped ? $" (capped at {HardCap})" : (HasMore ? " — Show all to reveal the rest" : "");
                    StatusMessage = $"Showing {ShownCount} of {ResultCount} match(es){more}.";
                }
            }
        }
        catch (OperationCanceledException)
        {
            StatusMessage = "Search cancelled.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Search error: {ex.Message}";
        }
        finally
        {
            IsSearching = false;
        }
    }

    public async Task DrillIntoAsync(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder))
            return;
        SearchPath = folder;
        await SearchAsync();
    }

    public async Task DrillIntoGroupAsync(SearchResultGroup group)
    {
        if (group is null) return;
        if (!string.IsNullOrEmpty(group.DrillPath))
        {
            await DrillIntoAsync(group.DrillPath);
            return;
        }
        if (!string.IsNullOrEmpty(group.DrillQuery))
        {
            SearchQuery = group.DrillQuery;
            UseWildcards = true;
            await SearchAsync();
            return;
        }
        group.IsExpanded = !group.IsExpanded;
    }

    public void CancelSearch()
    {
        if (!IsSearching)
            return;
        try { _cts.Cancel(); } catch (ObjectDisposedException) { /* already torn down */ }
        StatusMessage = "Search cancelled.";
    }

    public async Task IndexAsync()
    {
        if (IsIndexing || string.IsNullOrWhiteSpace(SearchPath))
            return;

        _cts.Dispose();
        var newCts = new CancellationTokenSource();
        _cts = newCts;

        var ct = _cts.Token;
        IsIndexing = true;
        IndexStatus = "Indexing with embeddings...";
        try
        {
            var result = await _scanner.EmbedDirectoryAsync(
                SearchPath,
                _indexedScanId,
                includeHidden: IncludeHidden,
                ct: ct);
            if (result != null)
            {
                _indexedScanId = result.ScanId;
                OnPropertyChanged(nameof(SemanticAvailable));
                IndexStatus = $"Indexed {result.Embedded} file(s) with {result.Model} (scan #{result.ScanId}).";
                AppNotifications.Success("Semantic index ready",
                    $"{result.Embedded} file(s) indexed for semantic search.");
            }
            else
            {
                IndexStatus = "Indexing failed: no result from scanner.";
                AppNotifications.Error("Indexing failed", "The scanner returned no result.");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SmartSearchViewModel] Index failed: {ex}");
            IndexStatus = $"Indexing failed: {ex.Message}";
            AppNotifications.Error("Indexing failed", ex.Message);
        }
        finally
        {
            IsIndexing = false;
        }
    }

    private async Task SearchSemanticAsync(CancellationToken ct)
    {
        if (!_indexedScanId.HasValue)
        {
            await IndexAsync();
            if (!_indexedScanId.HasValue)
                return;
        }

        if (!_scanner.IsAvailable)
        {
            StatusMessage = "Semantic search requires the Rust scanner with an embedding model.";
            return;
        }

        double? minScore = _minScorePercent > 0 ? _minScorePercent / 100.0 : null;
        var liveCt = _cts.Token;
        var hits = await _scanner.SemanticSearchAsync(SearchQuery, _indexedScanId.Value, top: SemanticTopK, minScore: minScore, liveCt);
        if (hits == null)
        {
            StatusMessage = "Semantic search returned no results.";
            return;
        }

        foreach (var h in hits)
        {
            if (SemanticResults.Count >= HardCap) { HardCapped = true; break; }
            SemanticResults.Add(h);
        }
        SemanticResultCount = SemanticResults.Count;
    }

    private async Task SearchWithScannerAsync()
    {
        try
        {
            var result = await _scanner.ScanDirectoryAsync(SearchPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
            if (result is null)
                return;

            if (result.ScannedFiles.Count == 0)
            {
                StatusMessage = "Indexing summary only; using local file walk for name search.";
                await SearchWithManagedWalkAsync();
                return;
            }

            var query = SearchQuery.ToLowerInvariant();
            var match = MatchExact
                ? new Func<string, bool>(name => name.Equals(query, StringComparison.OrdinalIgnoreCase))
                : UseWildcards
                    ? new Func<string, bool>(name => WildcardMatches(name, query))
                    : new Func<string, bool>(name => name.Contains(query, StringComparison.OrdinalIgnoreCase));
            var minSizeBytes = MinSizeMb * 1024 * 1024;

            foreach (var kvp in result.ScannedFiles)
            {
                if (_results.Count >= HardCap) { HardCapped = true; break; }
                var name = Path.GetFileName(kvp.Key);
                if (match(name) && kvp.Value.Size >= minSizeBytes)
                {
                    var mtime = kvp.Value.Mtime;
                    _results.Add(new SmartSearchResult
                    {
                        Path = kvp.Key,
                        Name = name,
                        SizeBytes = kvp.Value.Size,
                        SizeDisplay = ByteFormatter.FormatBytes(kvp.Value.Size),
                        SizeRaw = kvp.Value.Size.ToString("N0"),
                        ModifiedDisplay = FormatUnixSeconds(mtime),
                        Mtime = mtime
                    });
                }
            }

            FinalizeFilenameResults();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Scan error: {ex.Message}. Falling back to managed search.";
            await SearchWithManagedWalkAsync();
        }
    }

    private async Task SearchWithManagedWalkAsync()
    {
        try
        {
            var minSizeBytes = MinSizeMb * 1024 * 1024;
            var query = SearchQuery.ToLowerInvariant();
            var collected = new List<SmartSearchResult>();

            await Task.Run(() =>
            {
                WalkDirectory(new DirectoryInfo(SearchPath), query, minSizeBytes, collected);
            }, _cts.Token);

            foreach (var r in collected)
            {
                if (_results.Count >= HardCap) { HardCapped = true; break; }
                _results.Add(r);
            }

            FinalizeFilenameResults();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Search error: {ex.Message}";
        }
    }

    private void WalkDirectory(DirectoryInfo dir, string query, ulong minSizeBytes, List<SmartSearchResult> collected)
    {
        if (!_isSearchingFlag || _cts.IsCancellationRequested)
            return;

        try
        {
            foreach (var file in dir.GetFiles())
            {
                if (IncludeHidden || (file.Attributes & FileAttributes.Hidden) == 0)
                {
                    if (MatchExact
                        ? string.Equals(file.Name, query, StringComparison.OrdinalIgnoreCase)
                        : UseWildcards
                            ? WildcardMatches(file.Name, query)
                            : file.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
                    {
                        if ((ulong)file.Length >= minSizeBytes)
                        {
                            var mtime = new DateTimeOffset(file.LastWriteTimeUtc).ToUnixTimeSeconds();
                            collected.Add(new SmartSearchResult
                            {
                                Path = file.FullName,
                                Name = file.Name,
                                SizeBytes = (ulong)file.Length,
                                SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length),
                                SizeRaw = ((ulong)file.Length).ToString("N0"),
                                ModifiedDisplay = FormatUnixSeconds(mtime),
                                Mtime = mtime
                            });
                        }
                    }
                }
            }

            foreach (var subdir in dir.GetDirectories())
            {
                if (IncludeHidden || (subdir.Attributes & FileAttributes.Hidden) == 0)
                {
                    if (!_followSymlinks && (subdir.Attributes & FileAttributes.ReparsePoint) != 0)
                        continue;
                    WalkDirectory(subdir, query, minSizeBytes, collected);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SmartSearchViewModel] WalkDirectory error: {ex}");
        }
    }

    private static bool WildcardMatches(string input, string pattern)
    {
        if (string.IsNullOrEmpty(pattern))
            return true;

        if (pattern.Contains('|'))
        {
            foreach (var part in pattern.Split('|'))
                if (WildcardMatches(input, part))
                    return true;
            return false;
        }

        var segments = pattern.Split('*', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0)
            return true;

        var lowerInput = input.ToLowerInvariant();
        var currentIndex = 0;

        if (!pattern.StartsWith("*"))
        {
            if (!lowerInput.StartsWith(segments[0], StringComparison.OrdinalIgnoreCase))
                return false;
            currentIndex = segments[0].Length;
        }

        for (var i = pattern.StartsWith("*") ? 0 : 1; i < segments.Length; i++)
        {
            var segment = segments[i];
            var foundIndex = lowerInput.IndexOf(segment, currentIndex, StringComparison.OrdinalIgnoreCase);
            if (foundIndex < 0)
                return false;
            currentIndex = foundIndex + segment.Length;
        }

        if (!pattern.EndsWith("*") && currentIndex < lowerInput.Length)
            return lowerInput.EndsWith(segments[^1], StringComparison.OrdinalIgnoreCase);

        return true;
    }

    private static string FormatUnixSeconds(long secs)
    {
        try { return DateTimeOffset.FromUnixTimeSeconds(secs).LocalDateTime.ToString("yyyy-MM-dd HH:mm"); }
        catch { return "-"; }
    }
}
