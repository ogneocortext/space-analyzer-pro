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

public partial class SmartSearchViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private CancellationTokenSource _cts = new();
    private bool _disposed;
    private volatile bool _isSearchingFlag;

    private const int HardCap = 20000;

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

    private readonly ObservableCollection<SmartSearchResult> _results = new();
    public ObservableCollection<SmartSearchResult> Results => _results;

    public ObservableCollection<SmartSearchResult> DisplayResults { get; } = new();

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

    private int _displayCount = 500;
    public int DisplayCount
    {
        get => _displayCount;
        set { _displayCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasMore)); OnPropertyChanged(nameof(ShownCount)); }
    }

    public bool HasMore => _results.Count > _displayCount;

    public int ShownCount => Math.Min(_displayCount, _results.Count);

    private bool _hardCapped;
    public bool HardCapped
    {
        get => _hardCapped;
        set { _hardCapped = value; OnPropertyChanged(); }
    }

    public bool HasResults => _resultCount > 0;

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
            DisplayCount = Math.Min(_maxResults, _results.Count);
            ApplyDisplay();
        }
    }

    public SmartSearchViewModel()
    {
        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        await SettingsStore.EnsureLoadedAsync();
        LoadSettings();
        NotifySettingsLoaded();
    }

    private void NotifySettingsLoaded()
    {
        OnPropertyChanged(nameof(IncludeHidden));
        OnPropertyChanged(nameof(MaxResults));
        OnPropertyChanged(nameof(DisplayCount));
        OnPropertyChanged(nameof(ShowRawBytes));
        OnPropertyChanged(nameof(IsCompactDensity));
        OnPropertyChanged(nameof(DensityItemSpacing));
        OnPropertyChanged(nameof(DensityCardPadding));
        OnPropertyChanged(nameof(FollowSymlinks));
        OnPropertyChanged(nameof(CollapseSmallGroups));
        OnPropertyChanged(nameof(OtherThresholdMb));
        OnPropertyChanged(nameof(IsAdvancedMode));
        OnPropertyChanged(nameof(SemanticTopK));
        OnPropertyChanged(nameof(GroupByMode));
        OnPropertyChanged(nameof(SortBy));
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

public sealed record SmartSearchPreset(string? Query = null, string? Path = null, string? Category = null);
