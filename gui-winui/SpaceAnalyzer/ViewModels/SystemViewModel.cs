using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Diagnostics;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Services;
using Colors = Microsoft.UI.Colors;

namespace SpaceAnalyzer.ViewModels;

public class SystemViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly DispatcherTimer _refreshTimer;
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
    public SolidColorBrush CpuBrush => new(GetBarColor(CpuUsage));

    // ── Memory ──

    private double _memoryUsage;
    public double MemoryUsage
    {
        get => _memoryUsage;
        set { _memoryUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(MemoryUsageDisplay)); OnPropertyChanged(nameof(MemoryBrush)); }
    }
    public string MemoryUsageDisplay => $"{MemoryUsage:F1}%";
    public SolidColorBrush MemoryBrush => new(GetBarColor(MemoryUsage));

    private ulong _totalMemory;
    public ulong TotalMemory
    {
        get => _totalMemory;
        set { _totalMemory = value; OnPropertyChanged(); OnPropertyChanged(nameof(TotalMemoryDisplay)); }
    }
    public string TotalMemoryDisplay => FormatBytes(TotalMemory);

    private ulong _availableMemory;
    public ulong AvailableMemory
    {
        get => _availableMemory;
        set { _availableMemory = value; OnPropertyChanged(); OnPropertyChanged(nameof(AvailableMemoryDisplay)); }
    }
    public string AvailableMemoryDisplay => FormatBytes(AvailableMemory);

    private ulong _usedMemory;
    public ulong UsedMemory
    {
        get => _usedMemory;
        set { _usedMemory = value; OnPropertyChanged(); OnPropertyChanged(nameof(UsedMemoryDisplay)); }
    }
    public string UsedMemoryDisplay => FormatBytes(UsedMemory);

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
            var cpuCounter = new System.Diagnostics.PerformanceCounter(
                "Processor", "% Processor Time", "_Total", true);
            CpuUsage = Math.Min(100, cpuCounter.NextValue());

            var memStatus = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
            if (GlobalMemoryStatusEx(ref memStatus))
            {
                MemoryUsage = memStatus.dwMemoryLoad;
                TotalMemory = memStatus.ullTotalPhys;
                AvailableMemory = memStatus.ullAvailPhys;
                UsedMemory = TotalMemory - AvailableMemory;
            }

            LoadDiskVolumes();
            LoadTopProcesses();
        }
        catch
        {
            CpuUsage = 0;
            MemoryUsage = 0;
        }
    }

    private void LoadDiskVolumes()
    {
        DiskVolumes = DriveInfo.GetDrives()
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
                    MemoryDisplay = FormatBytes((ulong)p.WorkingSet64),
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

    private static Windows.UI.Color GetBarColor(double percent) => percent switch
    {
        >= 90 => Colors.Red,
        >= 70 => Colors.Gold,
        _ => Colors.Green,
    };

    private static string FormatBytes(ulong bytes)
    {
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double size = bytes;
        int unit = 0;
        while (size >= 1024 && unit < units.Length - 1)
        {
            size /= 1024;
            unit++;
        }
        return $"{size:F1} {units[unit]}";
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _refreshTimer.Stop();
        GC.SuppressFinalize(this);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

public class ProcessInfo
{
    public string Name { get; set; } = "";
    public int Id { get; set; }
    public ulong MemoryBytes { get; set; }
    public string MemoryDisplay { get; set; } = "";
    public string PidDisplay => $"PID: {Id}";
}
