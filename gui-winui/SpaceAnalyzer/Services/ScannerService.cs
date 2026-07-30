using System.Diagnostics;
using System.Text.Json;

namespace SpaceAnalyzer.Services;

/// <summary>
/// Calls the Rust scanner CLI (space-analyzer-pro) and parses JSON output.
/// </summary>
public class ScannerService
{
    private readonly string _scannerPath;

    public ScannerService(string? scannerPath = null)
    {
        // Default: look for the binary in the same directory as the app
        _scannerPath = scannerPath
            ?? Path.Combine(AppContext.BaseDirectory, "space-analyzer-pro.exe");
    }

    /// <summary>
    /// Returns true if the Rust scanner binary is available.
    /// </summary>
    public bool IsAvailable => File.Exists(_scannerPath);

    /// <summary>
    /// Run a directory scan and return structured results.
    /// </summary>
    public async Task<ScanResult?> ScanDirectoryAsync(
        string path,
        bool deep = false,
        IProgress<double>? progress = null,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            throw new FileNotFoundException(
                $"Scanner binary not found at {_scannerPath}. " +
                "Build it with: cargo build --release --bin space-analyzer-pro");

        var args = $"scan --path \"{path}\" --format json";
        if (deep) args += " --deep";

        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = new Process { StartInfo = psi };
        process.Start();

        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);

        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
            throw new Exception($"Scanner failed (exit {process.ExitCode}): {stderr}");

        return JsonSerializer.Deserialize<ScanResult>(stdout, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });
    }

    /// <summary>
    /// Get disk space info for all volumes.
    /// </summary>
    public async Task<List<DiskVolume>> GetDiskVolumesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return GetFallbackVolumes();

        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            Arguments = "disk-info --format json",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = new Process { StartInfo = psi };
        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        return JsonSerializer.Deserialize<List<DiskVolume>>(stdout, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        }) ?? GetFallbackVolumes();
    }

    private static List<DiskVolume> GetFallbackVolumes()
    {
        return DriveInfo.GetDrives()
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
}

// ── Data models matching Rust CLI JSON output ──

public class ScanResult
{
    public int TotalFiles { get; set; }
    public ulong TotalSizeBytes { get; set; }
    public double TotalSizeMb { get; set; }
    public double DurationSecs { get; set; }
    public Dictionary<string, int> FileTypes { get; set; } = new();
    public Dictionary<string, ulong> ExtensionSizes { get; set; } = new();
    public List<FileEntry> LargestFiles { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public string Path { get; set; } = "";
    public ulong TotalDirs { get; set; }
    public List<DirEntry> TopDirectories { get; set; } = new();
    public List<string> EmptyDirs { get; set; } = new();
}

public class FileEntry
{
    public string Path { get; set; } = "";
    public ulong Size { get; set; }
}

public class DirEntry
{
    public string Path { get; set; } = "";
    public string Name { get; set; } = "";
    public ulong TotalSize { get; set; }
    public ulong FileCount { get; set; }
    public ulong DirCount { get; set; }
}

public class DiskVolume
{
    public string MountPoint { get; set; } = "";
    public string Label { get; set; } = "";
    public ulong TotalBytes { get; set; }
    public ulong AvailableBytes { get; set; }
    public string FileSystem { get; set; } = "";

    public ulong UsedBytes => TotalBytes - AvailableBytes;
    public double UsagePercent => TotalBytes > 0
        ? (double)UsedBytes / TotalBytes * 100.0
        : 0;
    public string TotalFormatted => FormatBytes(TotalBytes);
    public string UsedFormatted => FormatBytes(UsedBytes);
    public string AvailableFormatted => FormatBytes(AvailableBytes);

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
}
