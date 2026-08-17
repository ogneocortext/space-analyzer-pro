// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class DashboardViewModel
{
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
                if (memStatus.ullTotalPhys > 0)
                {
                    MemoryUsage = Math.Min(100,
                        (double)(memStatus.ullTotalPhys - memStatus.ullAvailPhys) * 100.0
                        / memStatus.ullTotalPhys);
                }
            }

            var readyDrives = System.IO.DriveInfo.GetDrives().Where(d => d.IsReady).ToArray();
            long totalSpace = readyDrives.Sum(d => d.TotalSize);
            long freeSpace = readyDrives.Sum(d => d.AvailableFreeSpace);
            DiskUsage = totalSpace > 0
                ? Math.Min(100, (double)(totalSpace - freeSpace) / totalSpace * 100.0)
                : 0;

            var gpuPercent = GpuMonitor.TryGetUsagePercent();
            GpuAvailable = gpuPercent.HasValue;
            GpuUsage = gpuPercent ?? 0;
            if (GpuAvailable)
            {
                if (string.IsNullOrEmpty(GpuName))
                    GpuName = GpuMonitor.TryGetAdapterName() ?? string.Empty;
                GpuMemoryBytes = GpuMonitor.TryGetDedicatedMemoryBytes() ?? 0;
            }

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
}
