// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
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
public partial class SystemViewModel : ViewModelBase, IDisposable
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
}
