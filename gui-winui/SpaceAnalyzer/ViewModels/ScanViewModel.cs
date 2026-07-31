using System.ComponentModel;
using System.Runtime.CompilerServices;
using Microsoft.UI;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public class ScanViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private bool _disposed;

    public ScanViewModel()
    {
    }

    // ── Scan options ──

    private string _scanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string ScanPath
    {
        get => _scanPath;
        set { _scanPath = value; OnPropertyChanged(); }
    }

    private bool _deepScan;
    public bool DeepScan
    {
        get => _deepScan;
        set { _deepScan = value; OnPropertyChanged(); }
    }

    private bool _includeHidden;
    public bool IncludeHidden
    {
        get => _includeHidden;
        set { _includeHidden = value; OnPropertyChanged(); }
    }

    // ── Scan state ──

    private bool _isScanning;
    public bool IsScanning
    {
        get => _isScanning;
        set { _isScanning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotScanning)); }
    }
    public bool IsNotScanning => !_isScanning;

    private string _statusMessage = "Ready to scan";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private ScanResult? _lastResult;
    public ScanResult? LastResult
    {
        get => _lastResult;
        set { _lastResult = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasResult)); OnPropertyChanged(nameof(HasResultVisibility)); OnPropertyChanged(nameof(ResultFilesDisplay)); OnPropertyChanged(nameof(ResultSizeDisplay)); OnPropertyChanged(nameof(ResultDurationDisplay)); OnPropertyChanged(nameof(ResultDirsDisplay)); }
    }
    public bool HasResult => _lastResult != null;
    public Microsoft.UI.Xaml.Visibility HasResultVisibility => HasResult ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public string ResultFilesDisplay => LastResult != null ? $"{LastResult.TotalFiles:N0} files" : "";
    public string ResultSizeDisplay => LastResult != null ? $"{LastResult.TotalSizeMb:F1} MB" : "";
    public string ResultDurationDisplay => LastResult != null ? $"{LastResult.DurationSecs:F1}s" : "";
    public string ResultDirsDisplay => LastResult != null ? $"{LastResult.TopDirectories.Count}" : "";

    public List<DirEntry> TopDirectories => LastResult?.TopDirectories ?? new();

    // ── Methods ──

    public async Task ScanAsync(CancellationToken ct = default)
    {
        if (IsScanning || string.IsNullOrWhiteSpace(ScanPath))
            return;

        try
        {
            IsScanning = true;
            StatusMessage = "Scanning...";
            LastResult = null;

            var result = await _scanner.ScanDirectoryAsync(
                ScanPath,
                deep: DeepScan,
                includeHidden: IncludeHidden,
                progress: null,
                ct);

            LastResult = result;
            if (result != null)
            {
                StatusMessage = $"Scan complete: {result.TotalFiles:N0} files, {result.TotalSizeMb:F1} MB in {result.DurationSecs:F1}s";
            }
            else
            {
                StatusMessage = "Scan completed with no result.";
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Scan failed: {ex}");
            StatusMessage = $"Scan failed: {ex.Message}";
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
