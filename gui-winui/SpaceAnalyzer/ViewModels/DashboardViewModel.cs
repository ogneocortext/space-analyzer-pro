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
    private bool _disposed;

    public DashboardViewModel()
    {
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        _refreshTimer.Tick += (_, _) => RefreshSystemResources();
        _refreshTimer.Start();
    }

    // ── Hero Stat Cards ──

    private int _totalFiles;
    public int TotalFiles
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
        set { _diskVolumes = value; OnPropertyChanged(); }
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
    public string GpuUsageDisplay => $"{GpuUsage:F0}%";
    public SolidColorBrush GpuBrush => UiHelper.GetUsageBrush(GpuUsage);

    // ── Disk (aggregated storage usage across all ready drives) ──

    private double _diskUsage;
    public double DiskUsage
    {
        get => _diskUsage;
        set { _diskUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(DiskUsageDisplay)); OnPropertyChanged(nameof(DiskBrush)); }
    }
    public string DiskUsageDisplay => $"{DiskUsage:F0}%";
    public SolidColorBrush DiskBrush => UiHelper.GetUsageBrush(DiskUsage);

    // ── Loading state ──

    private bool _isLoading;
    public bool IsLoading
    {
        get => _isLoading;
        set { _isLoading = value; OnPropertyChanged(); }
    }

    // ── Methods ──

    /// <summary>
    /// Load disk volumes and populate hero stat cards from scan history.
    /// </summary>
    public async Task LoadDashboardAsync()
    {
        IsLoading = true;
        try
        {
            // Disk volumes
            DiskVolumes = await _scanner.GetDiskVolumesAsync();

            // Hero cards from scan history
            await LoadHeroStatsAsync();
        }
        catch
        {
            DiskVolumes = new List<DiskVolume>();
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// Populate the four hero stat cards:
    /// TotalFiles / TotalSize from the most recent scan, ScanCount from history length,
    /// and DuplicateCount from the most recent dedup run (0 if unavailable).
    /// </summary>
    private async Task LoadHeroStatsAsync()
    {
        try
        {
            var history = await _scanner.GetScanHistoryAsync(50);
            ScanCount = history.Count;

            var latest = history.FirstOrDefault();
            if (latest != null)
            {
                TotalFiles = latest.TotalFiles;
                TotalSizeBytes = latest.TotalSizeBytes;
            }
            else
            {
                TotalFiles = 0;
                TotalSizeBytes = 0;
            }

            // Best-effort dedup count from the last scan directory
            DuplicateCount = 0;
            if (latest != null && !string.IsNullOrEmpty(latest.Path) && _scanner.IsAvailable)
            {
                try
                {
                    var dedup = await _scanner.RunDedupAnalysisAsync(latest.Path);
                    DuplicateCount = dedup?.TotalDuplicateFiles ?? 0;
                }
                catch
                {
                    DuplicateCount = 0;
                }
            }
        }
        catch
        {
            // Non-fatal: hero cards stay at zero until history is available.
        }
    }

    private void RefreshSystemResources()
    {
        try
        {
            _cpuCounter ??= new PerformanceCounter("Processor", "% Processor Time", "_Total", true);
            CpuUsage = Math.Min(100, _cpuCounter.NextValue());

            if (UiHelper.GetMemoryStatus(out var memStatus))
            {
                MemoryUsage = Math.Min(100, memStatus.dwMemoryLoad);
            }

            // Aggregated storage usage across all ready drives (replaces the GPU placeholder)
            var readyDrives = System.IO.DriveInfo.GetDrives().Where(d => d.IsReady).ToArray();
            long totalSpace = readyDrives.Sum(d => d.TotalSize);
            long freeSpace = readyDrives.Sum(d => d.AvailableFreeSpace);
            DiskUsage = totalSpace > 0
                ? Math.Min(100, (double)(totalSpace - freeSpace) / totalSpace * 100.0)
                : 0;

            GpuUsage = 0;
        }
        catch
        {
            _cpuCounter?.Dispose();
            _cpuCounter = null;
            CpuUsage = 0;
            MemoryUsage = 0;
            GpuUsage = 0;
            DiskUsage = 0;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _refreshTimer.Stop();
        _cpuCounter?.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── INotifyPropertyChanged ──

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

