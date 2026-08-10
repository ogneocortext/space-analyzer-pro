// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the System Resources page: CPU usage, memory breakdown,
/// disk volumes, and top processes by memory.
/// </summary>
public class SystemViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly DispatcherTimer _refreshTimer;
    private readonly Microsoft.UI.Dispatching.DispatcherQueue _dispatcherQueue;
    private PerformanceCounter? _cpuCounter;
    private bool _cpuCounterInitialized;
    private bool _refreshInFlight;
    private bool _disposed;

    public SystemViewModel()
    {
        _dispatcherQueue = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        _refreshTimer.Tick += (_, _) => RefreshResources();
        _refreshTimer.Start();

        RefreshResources();
    }

    // ── CPU ──

    private double _cpuUsage;
    public double CpuUsage
    {
        get => _cpuUsage;
        set { _cpuUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(CpuUsageDisplay)); OnPropertyChanged(nameof(CpuBrush)); }
    }
    public string CpuUsageDisplay => $"{CpuUsage:F1}%";
    public SolidColorBrush CpuBrush => UiHelper.GetUsageBrush(CpuUsage);

    // ── Memory ──

    private double _memoryUsage;
    public double MemoryUsage
    {
        get => _memoryUsage;
        set { _memoryUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(MemoryUsageDisplay)); OnPropertyChanged(nameof(MemoryBrush)); }
    }
    public string MemoryUsageDisplay => $"{MemoryUsage:F1}%";
    public SolidColorBrush MemoryBrush => UiHelper.GetUsageBrush(MemoryUsage);

    private ulong _totalMemory;
    public ulong TotalMemory
    {
        get => _totalMemory;
        set { _totalMemory = value; OnPropertyChanged(); OnPropertyChanged(nameof(TotalMemoryDisplay)); }
    }
    public string TotalMemoryDisplay => ByteFormatter.FormatBytes(TotalMemory);

    private ulong _availableMemory;
    public ulong AvailableMemory
    {
        get => _availableMemory;
        set { _availableMemory = value; OnPropertyChanged(); OnPropertyChanged(nameof(AvailableMemoryDisplay)); }
    }
    public string AvailableMemoryDisplay => ByteFormatter.FormatBytes(AvailableMemory);

    private ulong _usedMemory;
    public ulong UsedMemory
    {
        get => _usedMemory;
        set { _usedMemory = value; OnPropertyChanged(); OnPropertyChanged(nameof(UsedMemoryDisplay)); }
    }
    public string UsedMemoryDisplay => ByteFormatter.FormatBytes(UsedMemory);

    // ── GPU ──

    private double _gpuUsage;
    public double GpuUsage
    {
        get => _gpuUsage;
        set { _gpuUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuUsageDisplay)); OnPropertyChanged(nameof(GpuBrush)); }
    }

    private bool _gpuAvailable;
    public bool GpuAvailable
    {
        get => _gpuAvailable;
        set { _gpuAvailable = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuUsageDisplay)); OnPropertyChanged(nameof(GpuSubtitle)); }
    }

    public string GpuUsageDisplay => GpuAvailable ? $"{GpuUsage:F1}%" : "n/a";
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

    /// <summary>Adapter name plus dedicated VRAM in use, shown under the GPU gauge.</summary>
    public string GpuSubtitle
    {
        get
        {
            if (!GpuAvailable)
                return "GPU performance counters unavailable on this system";
            var name = string.IsNullOrWhiteSpace(GpuName) ? "GPU" : GpuName;
            return GpuMemoryBytes > 0
                ? $"{name} · {ByteFormatter.FormatBytes(GpuMemoryBytes)} dedicated memory in use"
                : name;
        }
    }

    // ── Disk ──

    private List<DiskVolume> _diskVolumes = new();
    public List<DiskVolume> DiskVolumes
    {
        get => _diskVolumes;
        set { _diskVolumes = value; OnPropertyChanged(); }
    }

    // ── Processes ──

    private List<ProcessInfo> _topProcesses = new();
    public List<ProcessInfo> TopProcesses
    {
        get => _topProcesses;
        set { _topProcesses = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasTopProcesses)); }
    }

    public bool HasTopProcesses => _topProcesses.Count > 0;

    // ── Methods ──

    private void RefreshResources()
    {
        try
        {
            _cpuCounter ??= new PerformanceCounter(
                "Processor", "% Processor Time", "_Total", true);
            if (!_cpuCounterInitialized)
            {
                _cpuCounterInitialized = true;
                _cpuCounter.NextValue();
                return;
            }

            CpuUsage = Math.Min(100, _cpuCounter.NextValue());

            if (UiHelper.GetMemoryStatus(out var memStatus))
            {
                MemoryUsage = memStatus.dwMemoryLoad;
                TotalMemory = memStatus.ullTotalPhys;
                AvailableMemory = memStatus.ullAvailPhys;
                UsedMemory = memStatus.ullTotalPhys - memStatus.ullAvailPhys;
            }

            // Real GPU utilization; GpuAvailable stays false when Windows exposes no
            // GPU Engine counters so the page shows "n/a" instead of a fake 0%.
            var gpuPercent = GpuMonitor.TryGetUsagePercent();
            GpuAvailable = gpuPercent.HasValue;
            GpuUsage = gpuPercent ?? 0;
            if (GpuAvailable)
            {
                if (string.IsNullOrEmpty(GpuName))
                    GpuName = GpuMonitor.TryGetAdapterName() ?? string.Empty;
                GpuMemoryBytes = GpuMonitor.TryGetDedicatedMemoryBytes() ?? 0;
            }
        }
        catch
        {
            _cpuCounterInitialized = false;
            _cpuCounter?.Dispose();
            _cpuCounter = null;
            CpuUsage = 0;
            MemoryUsage = 0;
        }

        // Enumerating all processes and querying drives can take hundreds of ms, so
        // that work runs off the UI thread and results are marshaled back here.
        if (_refreshInFlight) return;
        _refreshInFlight = true;
        _ = Task.Run(() =>
        {
            var volumes = ReadDiskVolumes();
            var processes = ReadTopProcesses();
            _dispatcherQueue.TryEnqueue(() =>
            {
                DiskVolumes = volumes;
                TopProcesses = processes;
                _refreshInFlight = false;
            });
        });
    }

    private static List<DiskVolume> ReadDiskVolumes()
    {
        try
        {
            return System.IO.DriveInfo.GetDrives()
                .Where(d => d.IsReady)
                .Select(d => new DiskVolume
                {
                    MountPoint = d.Name,
                    Label = d.VolumeLabel,
                    TotalBytes = (ulong)d.TotalSize,
                    AvailableBytes = (ulong)d.AvailableFreeSpace,
                    FileSystem = d.DriveFormat,
                })
                .ToList();
        }
        catch
        {
            return new List<DiskVolume>();
        }
    }

    private static List<ProcessInfo> ReadTopProcesses()
    {
        try
        {
            var allProcesses = Process.GetProcesses();
            try
            {
                return allProcesses
                    .Where(p => p.WorkingSet64 > 0)
                    .OrderByDescending(p => p.WorkingSet64)
                    .Take(10)
                    .Select(p => new ProcessInfo
                    {
                        Name = p.ProcessName,
                        MemoryBytes = (ulong)p.WorkingSet64,
                        Id = p.Id,
                    })
                    .ToList();
            }
            finally
            {
                foreach (var p in allProcesses)
                    try { p.Dispose(); } catch { }
            }
        }
        catch
        {
            return new List<ProcessInfo>();
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

    public DispatcherTimer DispatcherTimer => _refreshTimer;

    public void Refresh()
    {
        RefreshResources();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
