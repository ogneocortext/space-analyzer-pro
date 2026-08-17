// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.ViewModels;

public partial class SystemViewModel
{
    private double _cpuUsage;
    public double CpuUsage
    {
        get => _cpuUsage;
        set { _cpuUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(CpuUsageDisplay)); OnPropertyChanged(nameof(CpuBrush)); }
    }
    public string CpuUsageDisplay => $"{CpuUsage:F1}%";
    public SolidColorBrush CpuBrush => UiHelper.GetUsageBrush(CpuUsage);

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

    private List<DiskVolume> _diskVolumes = new();
    public List<DiskVolume> DiskVolumes
    {
        get => _diskVolumes;
        set { _diskVolumes = value; OnPropertyChanged(); }
    }

    private List<ProcessInfo> _topProcesses = new();
    public List<ProcessInfo> TopProcesses
    {
        get => _topProcesses;
        set { _topProcesses = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasTopProcesses)); }
    }

    public bool HasTopProcesses => _topProcesses.Count > 0;
}
