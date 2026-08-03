// Licensed under the MIT License.

using System.ComponentModel;
using System.Runtime.CompilerServices;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class DuplicatesViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;

    public DuplicatesViewModel()
    {
    }

    private string _scanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string ScanPath
    {
        get => _scanPath;
        set { _scanPath = value; OnPropertyChanged(); }
    }

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); }
    }
    public bool IsNotScanning => !_isScanning;

    private string _statusMessage = "Ready to analyze";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private DedupResult? _lastResult;
    public DedupResult? LastResult
    {
        get => _lastResult;
        set { _lastResult = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasResult)); OnPropertyChanged(nameof(HasResultVisibility)); OnPropertyChanged(nameof(DuplicateGroupCount)); OnPropertyChanged(nameof(TotalDuplicateFiles)); OnPropertyChanged(nameof(PotentialSavingsDisplay)); OnPropertyChanged(nameof(DuplicateGroups)); }
    }
    public bool HasResult => _lastResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility => HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;

    public int DuplicateGroupCount => _lastResult?.DuplicateGroups.Count ?? 0;
    // DedupResult.TotalDuplicateFiles is long (Rust usize); narrow to int for display.
    public int TotalDuplicateFiles => (int)(_lastResult?.TotalDuplicateFiles ?? 0);
    public string PotentialSavingsDisplay => _lastResult?.PotentialSavingsDisplay ?? "";
    public List<DuplicateGroup> DuplicateGroups => _lastResult?.DuplicateGroups ?? new();

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

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
