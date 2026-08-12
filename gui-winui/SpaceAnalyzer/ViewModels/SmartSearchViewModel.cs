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

/// <summary>
/// ViewModel for the Smart Search page. Performs an async recursive folder walk
/// with name, size, and grouping/sort options, and surfaces power-user controls
/// (raw bytes, density, metadata, symlink handling) behind an Advanced toggle.
/// </summary>
public class SmartSearchViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private CancellationTokenSource _cts = new();
    private bool _disposed;
    private volatile bool _isSearchingFlag;

    // Hard ceiling on kept results so a whole-drive query can never exhaust memory.
    private const int HardCap = 20000;

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
        set { _includeHidden = value; OnPropertyChanged(); SettingsStore.SetBool(SettingKeys.SsIncludeHidden, value); }
    }

    // ── Semantic (embedding) search ──

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
            OnPropertyChanged(nameof(ShowFlatResults));
            OnPropertyChanged(nameof(ShowGroupedResults));
        }
    }

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

    public string MinScorePercentLabel =>
        _minScorePercent <= 0 ? "Min similarity: off" : $"Min similarity: {_minScorePercent:0}%";

    public bool ShowFilenameResults => !_isSemantic && ResultCount > 0;
    public bool ShowFilenameEmpty => !_isSemantic && ResultCount == 0;
    public bool ShowSemanticResults => _isSemantic && SemanticResults.Count > 0;

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

    // Semantic top-K (power-user). Persisted.
    private int _semanticTopK = 50;
    public int SemanticTopK
    {
        get => _semanticTopK;
        set { _semanticTopK = Math.Max(1, value); OnPropertyChanged(); SettingsStore.Set(SettingKeys.SsSemanticTopK, value.ToString()); }
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

    // Full result set (kept; not directly bound to a list view).
    private readonly ObservableCollection<SmartSearchResult> _results = new();
    public ObservableCollection<SmartSearchResult> Results => _results;

    // Display-limited flat view (bound to the flat ItemsRepeater).
    public ObservableCollection<SmartSearchResult> DisplayResults { get; } = new();

    // Display-limited grouped view (bound to the grouped ItemsRepeater).
    public ObservableCollection<SearchResultGroup> GroupedResults { get; } = new();

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
            OnPropertyChanged(nameof(ShowGroupedResults));
            OnPropertyChanged(nameof(ShowFlatResults));
        }
    }

    /// <summary>How many of the full results are currently shown (progressive load).</summary>
    private int _displayCount = 500;
    public int DisplayCount
    {
        get => _displayCount;
        set { _displayCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasMore)); OnPropertyChanged(nameof(ShownCount)); }
    }

    /// <summary>True when more results exist beyond the currently displayed slice.</summary>
    public bool HasMore => _results.Count > _displayCount;

    /// <summary>Number of results actually displayed (min of display cap and total).</summary>
    public int ShownCount => Math.Min(_displayCount, _results.Count);

    /// <summary>Set when the full set hit the hard memory cap.</summary>
    private bool _hardCapped;
    public bool HardCapped
    {
        get => _hardCapped;
        set { _hardCapped = value; OnPropertyChanged(); }
    }

    public bool HasResults => _resultCount > 0;

    // ── Grouping / sorting / view options ──

    private GroupByMode _groupByMode = GroupByMode.None;
    public GroupByMode GroupByMode
    {
        get => _groupByMode;
        set
        {
            _groupByMode = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(ShowGroupedResults));
            OnPropertyChanged(nameof(ShowFlatResults));
            SettingsStore.Set(SettingKeys.SsGroupByMode, value.ToString());
            ApplyDisplay();
        }
    }

    /// <summary>Legacy convenience: true when grouping by folder (used only for simple gating).</summary>
    public bool GroupByDirectory => _groupByMode == GroupByMode.Folder;
    public bool ShowGroupedResults => ShowFilenameResults && _groupByMode != GroupByMode.None;
    public bool ShowFlatResults => ShowFilenameResults && _groupByMode == GroupByMode.None;

    private SortBy _sortBy = SortBy.Name;
    public SortBy SortBy
    {
        get => _sortBy;
        set
        {
            _sortBy = value;
            OnPropertyChanged();
            SettingsStore.Set(SettingKeys.SsSortBy, value.ToString());
            SortAndApply();
        }
    }

    private bool _showRawBytes;
    public bool ShowRawBytes
    {
        get => _showRawBytes;
        set { _showRawBytes = value; OnPropertyChanged(); SettingsStore.SetBool(SettingKeys.SsShowRawBytes, value); }
    }

    private bool _isCompactDensity;
    public bool IsCompactDensity
    {
        get => _isCompactDensity;
        set
        {
            _isCompactDensity = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DensityItemSpacing));
            OnPropertyChanged(nameof(DensityCardPadding));
            SettingsStore.SetBool(SettingKeys.SsCompactDensity, value);
        }
    }
    public double DensityItemSpacing => _isCompactDensity ? 4 : 12;
    public Thickness DensityCardPadding => _isCompactDensity ? new Thickness(8) : new Thickness(16);

    private bool _followSymlinks;
    public bool FollowSymlinks
    {
        get => _followSymlinks;
        set { _followSymlinks = value; OnPropertyChanged(); SettingsStore.SetBool(SettingKeys.SsFollowSymlinks, value); }
    }

    private bool _collapseSmallGroups = true;
    public bool CollapseSmallGroups
    {
        get => _collapseSmallGroups;
        set { _collapseSmallGroups = value; OnPropertyChanged(); SettingsStore.SetBool(SettingKeys.SsCollapseSmallGroups, value); ApplyDisplay(); }
    }

    private int _otherThresholdMb = 1;
    public int OtherThresholdMb
    {
        get => _otherThresholdMb;
        set { _otherThresholdMb = Math.Max(0, value); OnPropertyChanged(); SettingsStore.Set(SettingKeys.SsOtherThresholdMb, value.ToString()); ApplyDisplay(); }
    }

    private bool _isAdvancedMode;
    public bool IsAdvancedMode
    {
        get => _isAdvancedMode;
        set { _isAdvancedMode = value; OnPropertyChanged(); SettingsStore.SetBool(SettingKeys.SsAdvancedMode, value); }
    }

    private int _maxResults = 500;
    public int MaxResults
    {
        get => _maxResults;
        set
        {
            _maxResults = Math.Max(1, value);
            OnPropertyChanged();
            SettingsStore.Set(SettingKeys.SsMaxResults, value.ToString());
            // Re-anchor the display window to the new cap.
            DisplayCount = Math.Min(_maxResults, _results.Count);
            ApplyDisplay();
        }
    }

    public SmartSearchViewModel()
    {
        LoadSettings();
        _ = SettingsStore.EnsureLoadedAsync();
    }

    private void LoadSettings()
    {
        _includeHidden = SettingsStore.GetBool(SettingKeys.SsIncludeHidden, false);
        _maxResults = ParseInt(SettingsStore.Get(SettingKeys.SsMaxResults), 500);
        _displayCount = _maxResults;
        _showRawBytes = SettingsStore.GetBool(SettingKeys.SsShowRawBytes, false);
        _isCompactDensity = SettingsStore.GetBool(SettingKeys.SsCompactDensity, false);
        _followSymlinks = SettingsStore.GetBool(SettingKeys.SsFollowSymlinks, false);
        _collapseSmallGroups = SettingsStore.GetBool(SettingKeys.SsCollapseSmallGroups, true);
        _otherThresholdMb = ParseInt(SettingsStore.Get(SettingKeys.SsOtherThresholdMb), 1);
        _isAdvancedMode = SettingsStore.GetBool(SettingKeys.SsAdvancedMode, false);
        _semanticTopK = ParseInt(SettingsStore.Get(SettingKeys.SsSemanticTopK), 50);
        if (Enum.TryParse<GroupByMode>(SettingsStore.Get(SettingKeys.SsGroupByMode), true, out var g)) _groupByMode = g;
        if (Enum.TryParse<SortBy>(SettingsStore.Get(SettingKeys.SsSortBy), true, out var s)) _sortBy = s;
    }

    private static int ParseInt(string? raw, int fallback)
        => int.TryParse(raw, out var v) ? v : fallback;

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

    /// <summary>Re-scope the search to a specific folder (used by group drill-in).</summary>
    public async Task DrillIntoAsync(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder))
            return;
        SearchPath = folder;
        await SearchAsync();
    }

    /// <summary>Re-scope the search to a grouped result bucket (Folder path or
    /// Category/Extension query). Non-drillable buckets (Date/Size) just toggle.</summary>
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

    /// <summary>
    /// Sort the full result set, compute size-bar metadata, then project the
    /// display-limited flat + grouped views.
    /// </summary>
    private void FinalizeFilenameResults()
    {
        SortResults(_results);
        RecomputeBars();
        ResultCount = _results.Count;
        DisplayCount = Math.Min(_maxResults, _results.Count);
        ApplyDisplay();
    }

    /// <summary>Re-sort and re-project after a sort change (no new search).</summary>
    private void SortAndApply()
    {
        if (_results.Count == 0) return;
        SortResults(_results);
        RecomputeBars();
        ApplyDisplay();
    }

    private void RecomputeBars()
    {
        ulong max = 0;
        foreach (var r in _results)
            if (r.SizeBytes > max) max = r.SizeBytes;
        foreach (var r in _results)
        {
            r.SizeFraction = max > 0 ? (double)r.SizeBytes / max : 0;
            r.BarBrush = FileCategory.CategoryBrush(FileCategory.CategoryForExtension(Path.GetExtension(r.Name)));
        }
    }

    /// <summary>
    /// Project the full results into the display-limited <see cref="DisplayResults"/>
    /// and (when grouping) <see cref="GroupedResults"/> collections.
    /// </summary>
    private void ApplyDisplay()
    {
        DisplayResults.Clear();
        foreach (var r in _results.Take(_displayCount))
            DisplayResults.Add(r);

        GroupedResults.Clear();
        if (_groupByMode == GroupByMode.None)
            return;

        var groups = _results.Take(_displayCount)
            .GroupBy(GroupKey)
            .Select(g => BuildGroup(g.Key, g.ToList()))
            .ToList();

        if (_collapseSmallGroups && _groupByMode is GroupByMode.Folder or GroupByMode.Category or GroupByMode.Extension)
        {
            var threshold = (ulong)Math.Max(0, _otherThresholdMb) * 1024 * 1024;
            var small = groups.Where(g => g.TotalBytes < threshold).ToList();
            var keep = groups.Where(g => g.TotalBytes >= threshold).ToList();
            if (small.Count > 0)
            {
                keep.Add(BuildGroup("__other", small.SelectMany(g => g.Items).ToList(), $"Other ({small.Count} groups)"));
                groups = keep;
            }
        }

        foreach (var g in OrderGroups(groups))
            GroupedResults.Add(g);
    }

    /// <summary>Reveal the entire result set (drops the display cap).</summary>
    public void ShowAll()
    {
        DisplayCount = _results.Count;
        ApplyDisplay();
        OnPropertyChanged(nameof(HasMore));
        OnPropertyChanged(nameof(ShownCount));
        OnPropertyChanged(nameof(ResultCount));
    }

    /// <summary>Append another page of results (one <see cref="MaxResults"/> step).</summary>
    public void LoadMore()
    {
        DisplayCount = Math.Min(_results.Count, _displayCount + _maxResults);
        ApplyDisplay();
        OnPropertyChanged(nameof(HasMore));
        OnPropertyChanged(nameof(ShownCount));
        OnPropertyChanged(nameof(ResultCount));
    }

    public string ExportResultsJson()
    {
        var payload = _results.Select(r => new
        {
            r.Path,
            r.Name,
            r.SizeBytes,
            r.SizeDisplay,
            r.ModifiedDisplay,
            Mtime = r.Mtime
        });
        return System.Text.Json.JsonSerializer.Serialize(payload, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
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
                    // Skip reparse points (symlinks/junctions) unless explicitly following them.
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

    // ── Grouping / sorting helpers ──

    private SearchResultGroup BuildGroup(string key, List<SmartSearchResult> items, string? label = null)
    {
        string? drillPath = null;
        string? drillQuery = null;
        if (_groupByMode == GroupByMode.Folder && key != "__other")
            drillPath = key;
        else if (_groupByMode == GroupByMode.Extension && key != "__other" && key != "(no extension)")
            drillQuery = "*" + key;
        else if (_groupByMode == GroupByMode.Category && key != "__other")
        {
            var exts = FileCategory.ExtensionsForCategory(key);
            if (exts.Count > 0)
                drillQuery = string.Join("|", exts.Select(e => "*" + e));
        }

        return new SearchResultGroup
        {
            Key = key,
            Label = label ?? key,
            Items = SortItems(items),
            DrillPath = drillPath,
            DrillQuery = drillQuery
        };
    }

    private string GroupKey(SmartSearchResult r)
    {
        var ext = Path.GetExtension(r.Name);
        return _groupByMode switch
        {
            GroupByMode.Folder => Path.GetDirectoryName(r.Path) ?? r.Path,
            GroupByMode.Extension => string.IsNullOrEmpty(ext) ? "(no extension)" : ext.ToLowerInvariant(),
            GroupByMode.Category => FileCategory.CategoryForExtension(ext),
            GroupByMode.Date => DateKey(r.Mtime),
            GroupByMode.Size => SizeBand(r.SizeBytes),
            _ => r.Path
        };
    }

    private static string DateKey(long mtime)
    {
        if (mtime <= 0) return "Unknown date";
        try
        {
            var dt = DateTimeOffset.FromUnixTimeSeconds(mtime);
            return $"{dt.Year} / {dt.Month:00}";
        }
        catch { return "Unknown date"; }
    }

    private static string SizeBand(ulong size)
    {
        const ulong mb = 1024 * 1024;
        const ulong gb = 1024 * mb;
        if (size < mb) return "Under 1 MB";
        if (size < 10 * mb) return "1 – 10 MB";
        if (size < 100 * mb) return "10 – 100 MB";
        if (size < gb) return "100 MB – 1 GB";
        return "Over 1 GB";
    }

    private IEnumerable<SearchResultGroup> OrderGroups(List<SearchResultGroup> groups)
    {
        return _groupByMode switch
        {
            GroupByMode.Date => groups.OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase),
            GroupByMode.Size => groups.OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase),
            _ => groups.OrderByDescending(g => g.TotalBytes)
        };
    }

    private void SortResults(IEnumerable<SmartSearchResult> items)
    {
        var sorted = SortItems(items as List<SmartSearchResult> ?? items.ToList());
        _results.Clear();
        foreach (var r in sorted) _results.Add(r);
    }

    private List<SmartSearchResult> SortItems(List<SmartSearchResult> items)
    {
        var list = new List<SmartSearchResult>(items);
        switch (_sortBy)
        {
            case SortBy.Name:
                list.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
                break;
            case SortBy.Size:
                list.Sort((a, b) => b.SizeBytes.CompareTo(a.SizeBytes));
                break;
            case SortBy.Date:
                list.Sort((a, b) => b.Mtime.CompareTo(a.Mtime));
                break;
            case SortBy.Path:
                list.Sort((a, b) => string.Compare(a.Path, b.Path, StringComparison.OrdinalIgnoreCase));
                break;
            case SortBy.Extension:
                list.Sort((a, b) => string.Compare(Path.GetExtension(a.Name), Path.GetExtension(b.Name), StringComparison.OrdinalIgnoreCase));
                break;
        }
        return list;
    }

    private static string FormatUnixSeconds(long secs)
    {
        try { return DateTimeOffset.FromUnixTimeSeconds(secs).ToString("yyyy-MM-dd HH:mm"); }
        catch { return "-"; }
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
/// Drill-in preset passed when navigating to Smart Search from another page.
/// Pre-fills the search box and path so the user lands one tap away from the
/// results they were drilling toward. When <see cref="Category"/> is set (donut
/// drill) it resolves to that category's extensions and runs an OR-wildcard search.
/// </summary>
public sealed record SmartSearchPreset(string? Query = null, string? Path = null, string? Category = null);
