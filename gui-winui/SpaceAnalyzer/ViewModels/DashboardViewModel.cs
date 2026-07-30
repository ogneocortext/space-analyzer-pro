using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using SpaceAnalyzer.Services;
using Windows.UI;

namespace SpaceAnalyzer.ViewModels;

public class DashboardViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private readonly DispatcherTimer _refreshTimer;
    private bool _disposed;

    public DashboardViewModel()
    {
        _refreshTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        _refreshTimer.Tick += (_, _) => RefreshSystemResources();
        _refreshTimer.Start();

        LoadDiskVolumesAsync().ConfigureAwait(false);
    }

    // ── Stat card properties ──

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
    public string TotalSizeDisplay
    {
        get
        {
            double gb = TotalSizeBytes / (1024.0 * 1024.0 * 1024.0);
            return gb >= 1024 ? $"{gb / 1024.0:F2} TB" : $"{gb:F1} GB";
        }
    }

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
    public SolidColorBrush CpuBrush => new(GetBarColor(CpuUsage));

    private double _memoryUsage;
    public double MemoryUsage
    {
        get => _memoryUsage;
        set { _memoryUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(MemoryUsageDisplay)); OnPropertyChanged(nameof(MemoryBrush)); }
    }
    public string MemoryUsageDisplay => $"{MemoryUsage:F0}%";
    public SolidColorBrush MemoryBrush => new(GetBarColor(MemoryUsage));

    private double _gpuUsage;
    public double GpuUsage
    {
        get => _gpuUsage;
        set { _gpuUsage = value; OnPropertyChanged(); OnPropertyChanged(nameof(GpuUsageDisplay)); OnPropertyChanged(nameof(GpuBrush)); }
    }
    public string GpuUsageDisplay => $"{GpuUsage:F0}%";
    public SolidColorBrush GpuBrush => new(GetBarColor(GpuUsage));

    // ── Loading state ──

    private bool _isLoading;
    public bool IsLoading
    {
        get => _isLoading;
        set { _isLoading = value; OnPropertyChanged(); }
    }

    // ── Methods ──

    public async Task LoadDiskVolumesAsync()
    {
        try
        {
            IsLoading = true;
            DiskVolumes = await _scanner.GetDiskVolumesAsync();
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

    private void RefreshSystemResources()
    {
        try
        {
            var cpuCounter = new System.Diagnostics.PerformanceCounter(
                "Processor", "% Processor Time", "_Total", true);
            CpuUsage = Math.Min(100, cpuCounter.NextValue());

            var memStatus = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
            if (GlobalMemoryStatusEx(ref memStatus))
            {
                MemoryUsage = Math.Min(100, memStatus.dwMemoryLoad);
            }

            GpuUsage = 0;
        }
        catch
        {
            CpuUsage = 0;
            MemoryUsage = 0;
            GpuUsage = 0;
        }
    }

    private static Windows.UI.Color GetBarColor(double percent) => percent switch
    {
        >= 90 => Colors.Red,
        >= 70 => Colors.Gold,
        _ => Colors.Green,
    };

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _refreshTimer.Stop();
        GC.SuppressFinalize(this);
    }

    // ── INotifyPropertyChanged ──

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
