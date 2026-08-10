// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the dashboard page: hero stat cards, disk volumes,
/// and live system-resource monitors (CPU, memory, disk).
/// </summary>
public class DashboardViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private readonly DispatcherTimer _refreshTimer;
    private PerformanceCounter? _cpuCounter;
    private bool _cpuCounterInitialized;
    private bool _disposed;

    public DashboardViewModel()
    {
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        _refreshTimer.Tick += (_, _) => RefreshSystemResources();
        ScanActivityMonitor.Instance.StateChanged += OnScanActivityChanged;
    }

    /// <summary>
    /// Captures the path/timestamp of a scan as soon as it starts so the impact
    /// panel can label the most recent scan even after it has finished.
    /// Invoked on the scan's thread; only plain fields are touched (no bindings
    /// are raised here, so cross-thread access is safe).
    /// </summary>
    private void OnScanActivityChanged(object? sender, EventArgs e)
    {
        var monitor = ScanActivityMonitor.Instance;
        if (monitor.IsScanning)
        {
            _lastScanPath = monitor.CurrentPath;
            _lastScanStartedAt = monitor.StartedAt;
        }
    }

    // ── Hero Stat Cards ──

    private long _totalFiles;
    public long TotalFiles
    {
        get => _totalFiles;
        set { _totalFiles = value; OnPropertyChanged(); OnPropertyChanged(nameof(TotalFilesDisplay)); }
    }
    public string TotalFilesDisplay => TotalFiles.ToString("N0");

    private double _totalSizeBytes;
    public double TotalSizeBytes
    {
        get => _totalSizeBytes;
        set { _totalSizeBytes = value; OnPropertyChanged(); OnPropertyChanged(nameof(TotalSizeDisplay)); }
    }
    public string TotalSizeDisplay => ByteFormatter.FormatBytes(_totalSizeBytes);

    private int _scanCount;
    public int ScanCount
    {
        get => _scanCount;
        set { _scanCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(ScanCountDisplay)); }
    }
    public string ScanCountDisplay => ScanCount.ToString("N0");

    // ── Analysis panels (bloat / recommendations / forecast) ──

    private List<Recommendation> _recommendations = new();
    public List<Recommendation> Recommendations
    {
        get => _recommendations;
        set { _recommendations = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasRecommendations)); }
    }
    public bool HasRecommendations => _recommendations.Count > 0;

    private List<BloatFinding> _bloatFindings = new();
    public List<BloatFinding> BloatFindings
    {
        get => _bloatFindings;
        set
        {
            _bloatFindings = value ?? new List<BloatFinding>();
            BloatTotalBytes = _bloatFindings.Sum(f => (long)f.Size);
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasBloatFindings));
            OnPropertyChanged(nameof(BloatTotalDisplay));
        }
    }
    public bool HasBloatFindings => _bloatFindings.Count > 0;

    public long BloatTotalBytes { get; private set; }
    public string BloatTotalDisplay =>
        BloatTotalBytes > 0 ? ByteFormatter.FormatBytes((ulong)BloatTotalBytes) : string.Empty;

    private StoragePrediction _storageForecast = new();
    public StoragePrediction StorageForecast
    {
        get => _storageForecast;
        set { _storageForecast = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasForecast)); }
    }
    public bool HasForecast => _storageForecast.ScansUsed >= 1;

    private int _duplicateCount;
    public int DuplicateCount
    {
        get => _duplicateCount;
        set { _duplicateCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(DuplicateCountDisplay)); }
    }
    public string DuplicateCountDisplay => DuplicateCount.ToString("N0");

    // ── Disk volumes ──

    private List<DiskVolume> _diskVolumes = new();
    public List<DiskVolume> DiskVolumes
    {
        get => _diskVolumes;
        set { _diskVolumes = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasDiskVolumes)); OnPropertyChanged(nameof(HasDiskVolumesVisibility)); }
    }
    public bool HasDiskVolumes => _diskVolumes.Any();
    public Microsoft.UI.Xaml.Visibility HasDiskVolumesVisibility => HasDiskVolumes ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    // ── Latest scan record (for file type pie chart) ──

    private ScanHistoryRecord? _latestScan;
    public ScanHistoryRecord? LatestScan
    {
        get => _latestScan;
        set { _latestScan = value; OnPropertyChanged(); }
    }

    // ── System resources ──

    private double _cpuUsage;
    public double CpuUsage
    {
        get => _cpuUsage;
        set { _cpuUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(CpuUsageDisplay)); OnPropertyChanged(nameof(CpuBrush)); }
    }
    public string CpuUsageDisplay => $"{CpuUsage:F0}%";
    public SolidColorBrush CpuBrush => UiHelper.GetUsageBrush(CpuUsage);

    private double _memoryUsage;
    public double MemoryUsage
    {
        get => _memoryUsage;
        set { _memoryUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(MemoryUsageDisplay)); OnPropertyChanged(nameof(MemoryBrush)); }
    }
    public string MemoryUsageDisplay => $"{MemoryUsage:F0}%";
    public SolidColorBrush MemoryBrush => UiHelper.GetUsageBrush(MemoryUsage);

    private double _gpuUsage;
    public double GpuUsage
    {
        get => _gpuUsage;
        set { _gpuUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuUsageDisplay)); OnPropertyChanged(nameof(GpuBrush)); }
    }

    private bool _gpuAvailable;
    /// <summary>
    /// False when Windows exposes no GPU Engine performance counters. The gauge then
    /// reports "n/a" instead of a hardcoded 0% that looks like a real reading.
    /// </summary>
    public bool GpuAvailable
    {
        get => _gpuAvailable;
        set { _gpuAvailable = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuUsageDisplay)); }
    }

    public string GpuUsageDisplay => GpuAvailable ? $"{GpuUsage:F0}%" : "n/a";
    public SolidColorBrush GpuBrush => UiHelper.GetUsageBrush(GpuUsage);

    private string _gpuName = string.Empty;
    public string GpuName
    {
        get => _gpuName;
        set { _gpuName = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuSubtitle)); }
    }

    private ulong _gpuMemoryBytes;
    public ulong GpuMemoryBytes
    {
        get => _gpuMemoryBytes;
        set { _gpuMemoryBytes = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuSubtitle)); }
    }

    /// <summary>Adapter name plus dedicated VRAM in use, for the GPU gauge caption.</summary>
    public string GpuSubtitle
    {
        get
        {
            if (!GpuAvailable)
                return "GPU counters unavailable";
            var name = string.IsNullOrWhiteSpace(GpuName) ? "GPU" : GpuName;
            return GpuMemoryBytes > 0
                ? $"{name} · {ByteFormatter.FormatBytes(GpuMemoryBytes)} VRAM"
                : name;
        }
    }

    // ── Historical data for charts ──

    private const int MaxHistoryPoints = 60;
    private readonly List<double> _cpuHistory = new();
    private readonly List<double> _memoryHistory = new();
    private readonly List<double> _diskHistory = new();
    private readonly List<double> _gpuHistory = new();

    // Parallel samples tagged with whether the file scanner was active at the
    // moment each resource sample was taken. Enables scan-vs-idle correlation.
    private readonly List<bool> _scanFlags = new();
    private readonly List<double> _scanBandValues = new();
    private string? _lastScanPath;
    private DateTimeOffset? _lastScanStartedAt;

    public IReadOnlyList<double> CpuHistory => _cpuHistory;
    public IReadOnlyList<double> MemoryHistory => _memoryHistory;
    public IReadOnlyList<double> DiskHistory => _diskHistory;
    public IReadOnlyList<double> GpuHistory => _gpuHistory;

    /// <summary>Per-sample band overlay for the sparklines: 100 while scanning, else 0.</summary>
    public IReadOnlyList<double> ScanBandValues => _scanBandValues;

    // ── Disk (aggregated storage usage across all ready drives) ──

    private double _diskUsage;
    public double DiskUsage
    {
        get => _diskUsage;
        set { _diskUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(DiskUsageDisplay)); OnPropertyChanged(nameof(DiskBrush)); }
    }
    public string DiskUsageDisplay => $"{DiskUsage:F0}%";
    public SolidColorBrush DiskBrush => UiHelper.GetUsageBrush(DiskUsage);

    // ── Scanner impact (scan-vs-idle resource correlation) ──

    private ScanImpactInfo _cpuScanImpact = new();
    private ScanImpactInfo _memoryScanImpact = new();
    private ScanImpactInfo _gpuScanImpact = new();
    private ScanImpactInfo _diskScanImpact = new();
    private bool _scanImpactAvailable;
    private string _scanImpactHeading = "Scanner Impact";
    private string _scanImpactSummary = "Run a scan to see how it affects system resources.";

    public ScanImpactInfo CpuScanImpact
    {
        get => _cpuScanImpact;
        private set { _cpuScanImpact = value; OnPropertyChanged(); }
    }
    public ScanImpactInfo MemoryScanImpact
    {
        get => _memoryScanImpact;
        private set { _memoryScanImpact = value; OnPropertyChanged(); }
    }
    public ScanImpactInfo GpuScanImpact
    {
        get => _gpuScanImpact;
        private set { _gpuScanImpact = value; OnPropertyChanged(); }
    }
    public ScanImpactInfo DiskScanImpact
    {
        get => _diskScanImpact;
        private set { _diskScanImpact = value; OnPropertyChanged(); }
    }
    public bool ScanImpactAvailable
    {
        get => _scanImpactAvailable;
        private set { _scanImpactAvailable = value; OnPropertyChanged(); }
    }
    public string ScanImpactHeading
    {
        get => _scanImpactHeading;
        private set { _scanImpactHeading = value; OnPropertyChanged(); }
    }
    public string ScanImpactSummary
    {
        get => _scanImpactSummary;
        private set { _scanImpactSummary = value; OnPropertyChanged(); }
    }
    // ── Quick Scan ──

    private string _quickScanPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string QuickScanPath
    {
        get => _quickScanPath;
        set { _quickScanPath = value; OnPropertyChanged(); }
    }

    private bool _isQuickScanning;
    public bool IsQuickScanning
    {
        get => _isQuickScanning;
        set { _isQuickScanning = value; OnPropertyChanged(); }
    }

    private string _quickScanStatus = "Ready";
    public string QuickScanStatus
    {
        get => _quickScanStatus;
        set { _quickScanStatus = value; OnPropertyChanged(); }
    }

    private string _quickScanResultText = string.Empty;
    public string QuickScanResultText
    {
        get => _quickScanResultText;
        set { _quickScanResultText = value; OnPropertyChanged(); }
    }

    private Visibility _quickScanResultVisibility = Visibility.Collapsed;
    public Visibility QuickScanResultVisibility
    {
        get => _quickScanResultVisibility;
        set { _quickScanResultVisibility = value; OnPropertyChanged(); }
    }

    public async Task QuickScanAsync()
    {
        if (IsQuickScanning || string.IsNullOrWhiteSpace(QuickScanPath) || !Directory.Exists(QuickScanPath))
        {
            QuickScanStatus = "Invalid path";
            return;
        }

        IsQuickScanning = true;
        QuickScanStatus = "Scanning...";
        QuickScanResultText = string.Empty;
        QuickScanResultVisibility = Visibility.Collapsed;

        try
        {
            var result = await _scanner.ScanDirectoryAsync(QuickScanPath);
            if (result != null)
            {
                QuickScanResultText = $"Scan complete: {result.TotalFiles:N0} files, {result.TotalSizeMb:F1} MB, {result.DurationSecs:F1}s";
                TotalFiles = result.TotalFiles;
                TotalSizeBytes = result.TotalSizeBytes;
                ScanCount++;
            }
            else
            {
                QuickScanResultText = "Scan completed with no result.";
            }
            QuickScanStatus = "Ready";
        }
        catch (Exception ex)
        {
            QuickScanResultText = $"Scan failed: {ex.Message}";
            QuickScanStatus = "Error";
        }
        finally
        {
            IsQuickScanning = false;
            QuickScanResultVisibility = Visibility.Visible;
        }
    }

    private bool _isLoading;
    public bool IsLoading
    {
        get => _isLoading;
        set { _isLoading = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotLoading)); }
    }
    public bool IsNotLoading => !_isLoading;
    public Visibility IsLoadingVisibility => _isLoading ? Visibility.Visible : Visibility.Collapsed;

    // ── Methods ──

    /// <summary>
    /// Load disk volumes and populate hero stat cards from scan history.
    /// </summary>
    public async Task LoadDashboardAsync()
    {
        IsLoading = true;
        try
        {
            DiskVolumes = await _scanner.GetDiskVolumesAsync();
            var history = await _scanner.GetScanHistoryAsync(50);
            LoadHeroStatsAsync(history);
            await LoadAnalysisPanelsAsync(history);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[DashboardViewModel] LoadDashboard failed: {ex}");
            DiskVolumes = new List<DiskVolume>();
        }
        finally
        {
            IsLoading = false;
        }
    }

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
        try
        {
            var latest = history.FirstOrDefault();
            if (latest != null)
            {
                BloatFindings = await GetBloatFindingsWithFallbackAsync(latest);
                Recommendations = AnalysisEngine.GetRecommendations(latest);
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
            System.Diagnostics.Debug.WriteLine($"[DashboardViewModel] LoadAnalysisPanels failed: {ex}");
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
            System.Diagnostics.Debug.WriteLine($"[DashboardViewModel] backend bloat failed: {ex}");
        }
        return AnalysisEngine.GetBloatFindings(latest);
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
            System.Diagnostics.Debug.WriteLine($"[DashboardViewModel] backend forecast failed: {ex}");
        }
        return AnalysisEngine.PredictStorage(history, 30);
    }

    /// <summary>
    /// Populate the four hero stat cards.
    /// Dedup count is loaded only once per session to avoid expensive repeated analysis.
    /// </summary>
    private void LoadHeroStatsAsync(List<ScanHistoryRecord> history)
    {
        try
        {
            ScanCount = history.Count;

            var latest = history.FirstOrDefault();
            if (latest != null)
            {
                TotalFiles = latest.TotalFiles;
                TotalSizeBytes = latest.TotalSizeBytes;
                LatestScan = latest;
            }
            else
            {
                TotalFiles = 0;
                TotalSizeBytes = 0;
                LatestScan = null;
            }

            // Duplicate count is intentionally NOT auto-computed here: hashing every
            // file in the latest scan's folder pegs disk/CPU for minutes at app start
            // just to fill one stat card. Users get real numbers on the Duplicates page.
            DuplicateCount = 0;
        }
        catch
        {
        }
    }

    private void RefreshSystemResources()
    {
        try
        {
            _cpuCounter ??= new PerformanceCounter("Processor", "% Processor Time", "_Total", true);
            if (!_cpuCounterInitialized)
            {
                _cpuCounterInitialized = true;
                _cpuCounter.NextValue();
                return;
            }

            CpuUsage = Math.Min(100, _cpuCounter.NextValue());

            if (UiHelper.GetMemoryStatus(out var memStatus))
            {
                // Compute memory usage from physical memory values for granular,
                // responsive updates instead of the coarse dwMemoryLoad metric.
                if (memStatus.ullTotalPhys > 0)
                {
                    MemoryUsage = Math.Min(100,
                        (double)(memStatus.ullTotalPhys - memStatus.ullAvailPhys) * 100.0
                        / memStatus.ullTotalPhys);
                }
            }

            // Aggregated storage usage across all ready drives (replaces the GPU placeholder)
            var readyDrives = System.IO.DriveInfo.GetDrives().Where(d => d.IsReady).ToArray();
            long totalSpace = readyDrives.Sum(d => d.TotalSize);
            long freeSpace = readyDrives.Sum(d => d.AvailableFreeSpace);
            DiskUsage = totalSpace > 0
                ? Math.Min(100, (double)(totalSpace - freeSpace) / totalSpace * 100.0)
                : 0;

            // Real GPU utilization from the Windows "GPU Engine" counters. Returns null
            // when the counters are missing, in which case the gauge reads "n/a".
            var gpuPercent = GpuMonitor.TryGetUsagePercent();
            GpuAvailable = gpuPercent.HasValue;
            GpuUsage = gpuPercent ?? 0;
            if (GpuAvailable)
            {
                if (string.IsNullOrEmpty(GpuName))
                    GpuName = GpuMonitor.TryGetAdapterName() ?? string.Empty;
                GpuMemoryBytes = GpuMonitor.TryGetDedicatedMemoryBytes() ?? 0;
            }

            // Store historical data points for time-series charts
            bool scanning = ScanActivityMonitor.Instance.IsScanning;
            _cpuHistory.Add(CpuUsage);
            _memoryHistory.Add(MemoryUsage);
            _diskHistory.Add(DiskUsage);
            _gpuHistory.Add(GpuUsage);
            _scanFlags.Add(scanning);
            _scanBandValues.Add(scanning ? 100 : 0);
            if (_cpuHistory.Count > MaxHistoryPoints)
            {
                _cpuHistory.RemoveAt(0);
                _memoryHistory.RemoveAt(0);
                _diskHistory.RemoveAt(0);
                _gpuHistory.RemoveAt(0);
                _scanFlags.RemoveAt(0);
                _scanBandValues.RemoveAt(0);
            }

            OnPropertyChanged(nameof(CpuHistory));
            OnPropertyChanged(nameof(MemoryHistory));
            OnPropertyChanged(nameof(DiskHistory));
            OnPropertyChanged(nameof(GpuHistory));
            OnPropertyChanged(nameof(ScanBandValues));

            RecomputeScanImpact();
        }
        catch
        {
            _cpuCounterInitialized = false;
            _cpuCounter?.Dispose();
            _cpuCounter = null;
            CpuUsage = 0;
            MemoryUsage = 0;
            GpuUsage = 0;
            DiskUsage = 0;
        }
    }

    /// <summary>
    /// Splits a resource history into scanning vs idle samples (using the parallel
    /// <see cref="_scanFlags"/>) and returns the average of each group.
    /// </summary>
    private static (double duringScan, double idle) SplitScanVsIdle(
        IReadOnlyList<double> history, IReadOnlyList<bool> flags)
    {
        double sumScan = 0, sumIdle = 0;
        int nScan = 0, nIdle = 0;
        int n = Math.Min(history.Count, flags.Count);
        for (int i = 0; i < n; i++)
        {
            if (flags[i]) { sumScan += history[i]; nScan++; }
            else { sumIdle += history[i]; nIdle++; }
        }
        return (nScan > 0 ? sumScan / nScan : 0, nIdle > 0 ? sumIdle / nIdle : 0);
    }

    /// <summary>
    /// Recomputes the scanner-impact panel: per-resource scan-vs-idle averages and a
    /// one-line summary of the largest deltas. Requires both scan and idle samples
    /// to be meaningful, otherwise the panel is hidden.
    /// </summary>
    private void RecomputeScanImpact()
    {
        int nScan = 0;
        foreach (var f in _scanFlags)
            if (f) nScan++;

        bool available = _cpuHistory.Count > 0 && nScan > 0 && (_scanFlags.Count - nScan) > 0;
        ScanImpactAvailable = available;

        if (!available)
        {
            CpuScanImpact = MemoryScanImpact = GpuScanImpact = DiskScanImpact = new ScanImpactInfo();
            ScanImpactSummary = "Run a scan to see how it affects system resources.";
            ScanImpactHeading = "Scanner Impact";
            return;
        }

        var cpu = SplitScanVsIdle(_cpuHistory, _scanFlags);
        var mem = SplitScanVsIdle(_memoryHistory, _scanFlags);
        var gpu = SplitScanVsIdle(_gpuHistory, _scanFlags);
        var disk = SplitScanVsIdle(_diskHistory, _scanFlags);

        CpuScanImpact = new ScanImpactInfo { DuringScan = cpu.duringScan, Idle = cpu.idle };
        MemoryScanImpact = new ScanImpactInfo { DuringScan = mem.duringScan, Idle = mem.idle };
        GpuScanImpact = new ScanImpactInfo { DuringScan = gpu.duringScan, Idle = gpu.idle };
        DiskScanImpact = new ScanImpactInfo { DuringScan = disk.duringScan, Idle = disk.idle };

        var deltas = new (string Name, ScanImpactInfo Info)[]
        {
            ("CPU", CpuScanImpact), ("Memory", MemoryScanImpact),
            ("GPU", GpuScanImpact), ("Disk", DiskScanImpact),
        }.Where(x => x.Info.Delta > 0.5)
         .OrderByDescending(x => x.Info.Delta)
         .Take(2)
         .ToArray();

        ScanImpactSummary = deltas.Length > 0
            ? string.Join("  ·  ", deltas.Select(d => $"{d.Name} {d.Info.DeltaDisplay}"))
            : "Scanning had minimal resource impact.";

        var pathLabel = string.IsNullOrWhiteSpace(_lastScanPath)
            ? "last scan"
            : _lastScanPath!;
        var timeLabel = _lastScanStartedAt.HasValue
            ? _lastScanStartedAt.Value.ToLocalTime().ToString("HH:mm:ss")
            : "";
        ScanImpactHeading = string.IsNullOrEmpty(timeLabel)
            ? $"Scanner Impact · {pathLabel}"
            : $"Scanner Impact · {pathLabel} · started {timeLabel}";
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _refreshTimer.Stop();
        ScanActivityMonitor.Instance.StateChanged -= OnScanActivityChanged;
        _cpuCounter?.Dispose();
        GC.SuppressFinalize(this);
    }

    public DispatcherTimer DispatcherTimer => _refreshTimer;

    // ── INotifyPropertyChanged ──

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

