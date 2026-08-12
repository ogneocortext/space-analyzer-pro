// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the Smart Search page. Performs an async recursive
/// folder walk with name and size filters.
/// </summary>
public class SmartSearchViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private CancellationTokenSource _cts = new();
    private bool _disposed;
    private volatile bool _isSearchingFlag;

    // ── Search criteria ──

    private string _searchPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string SearchPath
    {
        get => _searchPath;
        set { _searchPath = value; OnPropertyChanged(); }
    }

    private string _searchQuery = string.Empty;
    public string SearchQuery
    {
        get => _searchQuery;
        set { _searchQuery = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsInputValid)); }
    }
    public bool IsInputValid => !string.IsNullOrWhiteSpace(SearchQuery);

    private bool _matchExact;
    public bool MatchExact
    {
        get => _matchExact;
        set { _matchExact = value; OnPropertyChanged(); }
    }

    private bool _useWildcards;
    public bool UseWildcards
    {
        get => _useWildcards;
        set { _useWildcards = value; OnPropertyChanged(); }
    }

    private ulong _minSizeMb;
    public ulong MinSizeMb
    {
        get => _minSizeMb;
        set { _minSizeMb = value; OnPropertyChanged(); }
    }

    private bool _includeHidden;
    public bool IncludeHidden
    {
        get => _includeHidden;
        set { _includeHidden = value; OnPropertyChanged(); }
    }

    // ── Semantic (embedding) search ──

    /// <summary>
    /// When true, searches use semantic embeddings (the Rust <c>semantic-search</c>
    /// subcommand) instead of literal name matching. Requires an index first.
    /// </summary>
    private bool _isSemantic;
    public bool IsSemantic
    {
        get => _isSemantic;
        set
        {
            _isSemantic = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(SemanticAvailable));
            OnPropertyChanged(nameof(ShowFilenameResults));
            OnPropertyChanged(nameof(ShowFilenameEmpty));
            OnPropertyChanged(nameof(ShowSemanticResults));
        }
    }

    /// <summary>
    /// Minimum cosine-similarity threshold (0–100, shown as a percentage to the
    /// user). 0 means "no floor". Converted to a 0..1 <c>min_score</c> when
    /// calling the Rust <c>semantic-search</c> subcommand.
    /// </summary>
    private double _minScorePercent;
    public double MinScorePercent
    {
        get => _minScorePercent;
        set
        {
            _minScorePercent = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(MinScorePercentLabel));
        }
    }

    /// <summary>Live label for the threshold slider, e.g. "Min similarity: 60%".</summary>
    public string MinScorePercentLabel =>
        _minScorePercent <= 0 ? "Min similarity: off" : $"Min similarity: {_minScorePercent:0}%";

    /// <summary>Show the literal-name results panel only in filename mode with hits.</summary>
    public bool ShowFilenameResults => !_isSemantic && ResultCount > 0;
    /// <summary>Show the filename empty-state panel only in filename mode with no hits.</summary>
    public bool ShowFilenameEmpty => !_isSemantic && ResultCount == 0;
    /// <summary>Show the semantic results panel only in semantic mode with hits.</summary>
    public bool ShowSemanticResults => _isSemantic && SemanticResults.Count > 0;

    /// <summary>True once a directory has been indexed with embeddings.</summary>
    public bool SemanticAvailable => _indexedScanId.HasValue;
    private long? _indexedScanId;

    public ObservableCollection<SemanticSearchResult> SemanticResults { get; } = new();

    private int _semanticResultCount;
    public int SemanticResultCount
    {
        get => _semanticResultCount;
        set
        {
            _semanticResultCount = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(ShowSemanticResults));
        }
    }

    private bool _isIndexing;
    public bool IsIndexing
    {
        get => _isIndexing;
        set { _isIndexing = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotIndexing)); }
    }
    public bool IsNotIndexing => !_isIndexing;

    private string _indexStatus = "Not indexed yet. Index this folder with embeddings to enable semantic search.";
    public string IndexStatus
    {
        get => _indexStatus;
        set { _indexStatus = value; OnPropertyChanged(); }
    }

    // ── Search state ──

    private bool _isSearching;
    public bool IsSearching
    {
        get => _isSearching;
        set { _isSearching = value; _isSearchingFlag = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotSearching)); }
    }
    public bool IsNotSearching => !_isSearching;

    private string _statusMessage = "Ready to search.";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private ObservableCollection<SmartSearchResult> _results = new();
    public ObservableCollection<SmartSearchResult> Results => _results;

    private int _resultCount;
    public int ResultCount
    {
        get => _resultCount;
        set
        {
            _resultCount = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasResults));
            OnPropertyChanged(nameof(ShowFilenameResults));
            OnPropertyChanged(nameof(ShowFilenameEmpty));
        }
    }

    /// <summary>
    /// Whether at least one search result exists.
    /// </summary>
    public bool HasResults => _resultCount > 0;

    // ── Methods ──

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
        Results.Clear();
        ResultCount = 0;
        SemanticResults.Clear();

        try
        {
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
            StatusMessage = _isSemantic
                ? $"Found {SemanticResults.Count} semantic match(es)."
                : $"Found {ResultCount} match(es).";
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

    /// <summary>
    /// Index <see cref="SearchPath"/> with embeddings via the Rust <c>embed</c>
    /// subcommand so semantic search becomes available. Re-indexing reuses the
    /// same scan id so previous vectors are overwritten.
    /// </summary>
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
            // No index yet - build it, then search against it in one shot.
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
        var hits = await _scanner.SemanticSearchAsync(SearchQuery, _indexedScanId.Value, top: 50, minScore: minScore, ct);
        if (hits == null)
            return;

        foreach (var h in hits)
            SemanticResults.Add(h);
        SemanticResultCount = SemanticResults.Count;
    }

    private async Task SearchWithScannerAsync()
    {
        try
        {
            var result = await _scanner.ScanDirectoryAsync(SearchPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
            if (result is null)
                return;

            var query = SearchQuery.ToLowerInvariant();
            var match = MatchExact
                ? new Func<string, bool>(name => name.Equals(query, StringComparison.OrdinalIgnoreCase))
                : UseWildcards
                    ? new Func<string, bool>(name => WildcardMatches(name, query))
                    : new Func<string, bool>(name => name.Contains(query, StringComparison.OrdinalIgnoreCase));
            var minSizeBytes = MinSizeMb * 1024 * 1024;
            var collected = new List<SmartSearchResult>();

            // Match against actual files (the scanner's scanned_files map), not just
            // top-level directories, so a file-name query returns real hits.
            foreach (var kvp in result.ScannedFiles)
            {
                var name = Path.GetFileName(kvp.Key);
                if (match(name) && kvp.Value.Size >= minSizeBytes)
                {
                    collected.Add(new SmartSearchResult
                    {
                        Path = kvp.Key,
                        Name = name,
                        SizeBytes = kvp.Value.Size,
                        SizeDisplay = ByteFormatter.FormatBytes(kvp.Value.Size)
                    });
                }
            }

            foreach (var r in collected) Results.Add(r);
            ResultCount = Results.Count;
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

            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() =>
            {
                foreach (var r in collected) Results.Add(r);
                ResultCount = Results.Count;
            });
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
                        if (file.Length >= (long)minSizeBytes)
                        {
                            collected.Add(new SmartSearchResult
                            {
                                Path = file.FullName,
                                Name = file.Name,
                                SizeBytes = (ulong)file.Length,
                                SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                            });
                        }
                    }
                }
            }

            foreach (var subdir in dir.GetDirectories())
            {
                if (IncludeHidden || (subdir.Attributes & FileAttributes.Hidden) == 0)
                {
                    WalkDirectory(subdir, query, minSizeBytes, collected);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SmartSearchViewModel] WalkDirectory error: {ex}");
            // Skip inaccessible directories
        }
    }

    private static bool WildcardMatches(string input, string pattern)
    {
        if (string.IsNullOrEmpty(pattern))
            return true;

        // Support OR of multiple wildcard patterns: "*.jpg|*.png|*.gif" matches a
        // file whose name satisfies ANY one pattern. Used by category drills that
        // resolve to several extensions joined by '|'.
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

    public async Task BrowseForPathAsync()
    {
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                SearchPath = path;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SmartSearchViewModel] Browse failed: {ex}");
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }

}

/// <summary>
/// Drill-in preset passed when navigating to Smart Search from another page
/// (e.g. the Dashboard file-type chart, or the History Library Composition donut).
/// Pre-fills the search box and path so the user lands one tap away from the
/// results they were drilling toward. When <see cref="Category"/> is set (donut
/// drill) it resolves to that category's extensions and runs an OR-wildcard search.
/// </summary>
public sealed record SmartSearchPreset(string? Query = null, string? Path = null, string? Category = null);





