using System.Diagnostics;
using System.Text.Json;
using Microsoft.UI;
using Microsoft.UI.Xaml.Media;

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

    /// <summary>
    /// Get recent scan history from the embedded database.
    /// </summary>
    public async Task<List<ScanHistoryRecord>> GetScanHistoryAsync(int limit = 50, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new List<ScanHistoryRecord>();

        var args = $"history --limit {limit} --format json";

        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            Arguments = args,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = new Process { StartInfo = psi };
        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
            return new List<ScanHistoryRecord>();

        return JsonSerializer.Deserialize<List<ScanHistoryRecord>>(stdout, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        }) ?? new List<ScanHistoryRecord>();
    }

    /// <summary>
    /// Get full details for a single scan by ID.
    /// </summary>
    public async Task<ScanHistoryRecord?> GetScanDetailsAsync(long id, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var args = $"history --id {id} --format json";

        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            Arguments = args,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = new Process { StartInfo = psi };
        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
            return null;

        return JsonSerializer.Deserialize<ScanHistoryRecord>(stdout, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });
    }

    /// <summary>
    /// Run duplicate-file analysis on a directory.
    /// </summary>
    public async Task<DedupResult?> RunDedupAnalysisAsync(string path, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var args = $"dedup --path \"{path}\" --format json";

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
            throw new Exception($"Dedup failed (exit {process.ExitCode}): {stderr}");

        return JsonSerializer.Deserialize<DedupResult>(stdout, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });
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

public class ScanHistoryRecord
{
    public long Id { get; set; }
    public string Path { get; set; } = "";
    public int TotalFiles { get; set; }
    public ulong TotalSizeBytes { get; set; }
    public double TotalSizeMb { get; set; }
    public double DurationSecs { get; set; }
    public string FileTypesJson { get; set; } = "";
    public string ExtensionSizesJson { get; set; } = "";
    public string TopDirectoriesJson { get; set; } = "";
    public string LargestFilesJson { get; set; } = "";
    public bool DeepScan { get; set; }
    public ulong PotentialCleanupBytes { get; set; }
    public string Timestamp { get; set; } = "";

    public DateTime ScanDate => DateTime.Parse(Timestamp).ToLocalTime();
    public string DateDisplay => ScanDate.ToString("yyyy-MM-dd HH:mm");
    public string TotalSizeDisplay => FormatBytes(TotalSizeBytes);
    public string DurationDisplay => $"{(int)DurationSecs / 60}m {(int)DurationSecs % 60}s";
    public string FilesDisplay => $"{TotalFiles:N0} files";

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

public class DuplicateGroup
{
    public string Hash { get; set; } = "";
    public ulong Size { get; set; }
    public int FileCount { get; set; }
    public List<string> Files { get; set; } = new();
    public ulong WastedBytes { get; set; }
    public string WastedDisplay => ByteFormatter.FormatBytes(WastedBytes);
    public string SizeDisplay => ByteFormatter.FormatBytes(Size);
}

public class DedupResult
{
    public List<DuplicateGroup> DuplicateGroups { get; set; } = new();
    public int TotalDuplicateFiles { get; set; }
    public ulong PotentialSavingsBytes { get; set; }
    public string PotentialSavingsDisplay => ByteFormatter.FormatBytes(PotentialSavingsBytes);
}

public static class ByteFormatter
{
    public static string FormatBytes(ulong bytes)
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
    public string UsagePercentFormatted => $"{UsagePercent:F1}%";
    public string UsedDisplay => UsedFormatted;
    public string TotalDisplay => TotalFormatted;
    public string AvailableDisplay => AvailableFormatted;
    public string UsagePercentDisplay => UsagePercentFormatted;

    public SolidColorBrush UsageBrush => new(UsagePercent switch
    {
        >= 90 => Colors.Red,
        >= 70 => Colors.Gold,
        _ => Colors.Green,
    });

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
