// Licensed under the MIT License.

using System.IO;
using System.Linq;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class HistoryViewModel
{
    // ── Load state ──

    private bool _isLoading;
    public bool IsLoading
    {
        get => _isLoading;
        set { _isLoading = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotLoading)); OnPropertyChanged(nameof(LoadingVisibility)); }
    }
    public bool IsNotLoading => !_isLoading;
    public Visibility LoadingVisibility => _isLoading ? Visibility.Visible : Visibility.Collapsed;

    private string _statusMessage = "Ready";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    // ── All-history category composition (Library Composition donut) ──

    private List<CategoryStat> _categoryHistory = new();
    public List<CategoryStat> CategoryHistory
    {
        get => _categoryHistory;
        private set
        {
            _categoryHistory = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasCategoryHistory));
            OnPropertyChanged(nameof(CategoryHistoryCountDisplay));
        }
    }
    public bool HasCategoryHistory => _categoryHistory.Count > 0;
    public string CategoryHistoryCountDisplay => HasCategoryHistory ? $"{_categoryHistory.Count} categories" : "No category data";

    public async Task LoadCategoryHistoryAsync()
    {
        try
        {
            var dict = await _scanner.GetCategoryHistoryAsync();
            if (dict.Count == 0)
            {
                CategoryHistory = new List<CategoryStat>();
                return;
            }
            ulong total = dict.Values.Aggregate(0UL, (acc, v) => acc + v);
            CategoryHistory = dict
                .OrderByDescending(kv => kv.Value)
                .Select(kv => new CategoryStat(kv.Key, kv.Value, total > 0 ? (double)kv.Value / total * 100.0 : 0))
                .ToList();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadCategoryHistory failed: {ex}");
            CategoryHistory = new List<CategoryStat>();
        }
    }

    public async Task LoadHistoryAsync()
    {
        CurrentPage = 1;
        await LoadPageAsync();
        await LoadTrendAsync();
        await LoadCategoryHistoryAsync();
        await LoadInventoryAsync();
        await LoadCalendarAsync();
    }

    public async Task LoadTrendAsync()
    {
        try
        {
            TrendRecords = await _scanner.GetScanHistoryTrendAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadTrend failed: {ex}");
            TrendRecords = new List<HistoryTrendPoint>();
        }
    }

    public async Task LoadPageAsync()
    {
        try
        {
            IsLoading = true;
            StatusMessage = "Loading history...";
            var offset = (CurrentPage - 1) * PageSize;
            var (records, total) = await _scanner.GetScanHistoryPageAsync(
                PageSize, offset,
                string.IsNullOrWhiteSpace(SearchText) ? null : SearchText,
                ServerSortBy, SortAsc, OnlyDuplicates);
            History = records;
            TotalCount = total;
            StatusMessage = TotalCount == 0 ? "No scan history found" : $"Showing {records.Count} of {TotalCount} scans";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HistoryViewModel] LoadPage failed: {ex}");
            StatusMessage = $"Failed to load history: {ex.Message}";
            History = new List<ScanHistoryRecord>();
            TotalCount = 0;
        }
        finally
        {
            IsLoading = false;
        }
    }

    public async Task NextPageAsync()
    {
        if (!HasNextPage) return;
        CurrentPage++;
        await LoadPageAsync();
    }

    public async Task PreviousPageAsync()
    {
        if (!HasPreviousPage) return;
        CurrentPage--;
        await LoadPageAsync();
    }

    public async Task SearchAsync()
    {
        CurrentPage = 1;
        await LoadPageAsync();
    }

    public void ClearSearch()
    {
        SearchText = string.Empty;
        CurrentPage = 1;
        _ = LoadPageAsync();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }
}
