// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
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
public class SmartSearchViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private readonly CancellationTokenSource _cts = new();
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
        set { _resultCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasResults)); }
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

        IsSearching = true;
        StatusMessage = "Searching...";
        Results.Clear();
        ResultCount = 0;

        if (_scanner.IsAvailable)
        {
            await SearchWithScannerAsync();
        }
        else
        {
            await SearchWithManagedWalkAsync();
        }

        IsSearching = false;
        StatusMessage = $"Found {ResultCount} match(es).";
    }

    private async Task SearchWithScannerAsync()
    {
        try
        {
            var result = await _scanner.ScanDirectoryAsync(SearchPath, deep: true, ct: _cts.Token);
            if (result is null)
                return;

            var query = MatchExact ? SearchQuery : SearchQuery.ToLowerInvariant();
            var minSizeBytes = MinSizeMb * 1024 * 1024;
            var collected = new List<SmartSearchResult>();

            foreach (var dir in result.TopDirectories)
            {
                if (dir.Name.Contains(query, StringComparison.OrdinalIgnoreCase) && dir.TotalSize >= minSizeBytes)
                {
                    collected.Add(new SmartSearchResult
                    {
                        Path = dir.Path,
                        Name = dir.Name,
                        SizeBytes = dir.TotalSize,
                        SizeDisplay = ByteFormatter.FormatBytes(dir.TotalSize)
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
            var query = MatchExact ? SearchQuery : SearchQuery.ToLowerInvariant();
            var collected = new List<SmartSearchResult>();

            await Task.Run(() =>
            {
                WalkDirectory(new DirectoryInfo(SearchPath), query, minSizeBytes, collected);
            }, _cts.Token);

            // Continuation runs on the UI thread
            foreach (var r in collected) Results.Add(r);
            ResultCount = Results.Count;
        }
        catch (Exception ex)
        {
            StatusMessage = $"Search error: {ex.Message}";
        }
    }

    private void WalkDirectory(DirectoryInfo dir, string query, ulong minSizeBytes, List<SmartSearchResult> collected)
    {
        if (!_isSearchingFlag) return;

        try
        {
            foreach (var file in dir.GetFiles())
            {
                if (IncludeHidden || (file.Attributes & FileAttributes.Hidden) == 0)
                {
                    if (file.Name.Contains(query, StringComparison.OrdinalIgnoreCase) && file.Length >= (long)minSizeBytes)
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

            foreach (var subdir in dir.GetDirectories())
            {
                if (IncludeHidden || (subdir.Attributes & FileAttributes.Hidden) == 0)
                {
                    WalkDirectory(subdir, query, minSizeBytes, collected);
                }
            }
        }
        catch
        {
            // Skip inaccessible directories
        }
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
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

/// <summary>
/// A single search result for the Smart Search page.
/// </summary>
public class SmartSearchResult
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ulong SizeBytes { get; set; }
    public string SizeDisplay { get; set; } = string.Empty;
}



