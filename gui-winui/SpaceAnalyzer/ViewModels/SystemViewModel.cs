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
/// ViewModel for the System Resources page: CPU usage, memory breakdown,
/// disk volumes, and top processes by memory.
/// </summary>
public class SystemViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly DispatcherTimer _refreshTimer;
    private PerformanceCounter? _cpuCounter;
    private bool _disposed;

    public SystemViewModel()
    {
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
        set { _topProcesses = value; OnPropertyChanged(); }
    }

    // ── Methods ──

    private void RefreshResources()
    {
        try
        {
            _cpuCounter ??= new PerformanceCounter(
                "Processor", "% Processor Time", "_Total", true);
            CpuUsage = Math.Min(100, _cpuCounter.NextValue());

            if (UiHelper.GetMemoryStatus(out var memStatus))
            {
                MemoryUsage = memStatus.dwMemoryLoad;
                TotalMemory = memStatus.ullTotalPhys;
                AvailableMemory = memStatus.ullAvailPhys;
                UsedMemory = memStatus.ullTotalPhys - memStatus.ullAvailPhys;
            }

            LoadDiskVolumes();
            LoadTopProcesses();
        }
        catch
        {
            _cpuCounter?.Dispose();
            _cpuCounter = null;
            CpuUsage = 0;
            MemoryUsage = 0;
        }
    }

    private void LoadDiskVolumes()
    {
        DiskVolumes = System.IO.DriveInfo.GetDrives()
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

    private void LoadTopProcesses()
    {
        try
        {
            var processes = Process.GetProcesses()
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
            TopProcesses = processes;
        }
        catch
        {
            TopProcesses = new List<ProcessInfo>();
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

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
