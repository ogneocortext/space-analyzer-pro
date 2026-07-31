// Licensed under the MIT License.

using System.Diagnostics;
using System.Text.Json;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

/// <summary>
/// Calls the Rust scanner CLI (space-analyzer-pro) and parses JSON output.
/// Data models now live in <see cref="SpaceAnalyzer.Models"/> for reuse
/// across ViewModels and Views.
/// </summary>
public class ScannerService
{
    private readonly string _scannerPath;

    /// <summary>
    /// Maps the Rust scanner's snake_case JSON (e.g. "total_files") to the PascalCase
    /// C# models (e.g. <see cref="ScanResult.TotalFiles"/>). Case-insensitivity alone is
    /// insufficient — it ignores case but not the snake_case underscores, which left every
    /// field unmapped and caused results to deserialize to all-zeros.
    /// </summary>
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public ScannerService(string? scannerPath = null)
    {
        _scannerPath = ResolveScannerPath(scannerPath);
    }

    /// <summary>
    /// Locate the Rust scanner binary. Priority: explicit path > SPACE_ANALYZER_SCANNER env var
    /// &gt; beside the app &gt; target/{release,debug} found by walking up from the app directory.
    /// </summary>
    private static string ResolveScannerPath(string? explicitPath)
    {
        if (!string.IsNullOrWhiteSpace(explicitPath) && File.Exists(explicitPath))
            return explicitPath;

        var envPath = Environment.GetEnvironmentVariable("SPACE_ANALYZER_SCANNER");
        if (!string.IsNullOrWhiteSpace(envPath) && File.Exists(envPath))
            return envPath;

        var beside = Path.Combine(AppContext.BaseDirectory, "space-analyzer-pro.exe");
        if (File.Exists(beside))
            return beside;

        // Walk up from the app directory to locate the Rust target output.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (int i = 0; i < 8 && dir != null; i++)
        {
            foreach (var cfg in new[] { "release", "debug" })
            {
                var candidate = Path.Combine(dir.FullName, "target", cfg, "space-analyzer-pro.exe");
                if (File.Exists(candidate))
                    return candidate;
            }
            dir = dir.Parent;
        }

        // Fall back to the default location (IsAvailable will report false if missing).
        return beside;
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
        bool includeHidden = false,
        IProgress<double>? progress = null,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            throw new FileNotFoundException(
                $"Scanner binary not found at {_scannerPath}. " +
                "Build it with: cargo build --release --bin space-analyzer-pro");

        var args = $"scan --path \"{path}\" --format json";
        if (deep) args += " --deep";
        if (includeHidden) args += " --include-hidden";

        var output = await RunScannerAsync(args, ct);
        return JsonSerializer.Deserialize<ScanResult>(output, s_jsonOptions);
    }

    /// <summary>
    /// Get disk space info for all volumes.
    /// </summary>
    public async Task<List<DiskVolume>> GetDiskVolumesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return GetFallbackVolumes();

        var output = await RunScannerAsync("disk-info --format json", ct);
        return JsonSerializer.Deserialize<List<DiskVolume>>(output, s_jsonOptions) ?? GetFallbackVolumes();
    }

    /// <summary>
    /// Get recent scan history from the embedded database.
    /// </summary>
    public async Task<List<ScanHistoryRecord>> GetScanHistoryAsync(int limit = 50, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new List<ScanHistoryRecord>();

        var args = $"history --limit {limit} --format json";
        var output = await RunScannerAsync(args, ct);
        return JsonSerializer.Deserialize<List<ScanHistoryRecord>>(output, s_jsonOptions) ?? new();
    }

    /// <summary>
    /// Get full details for a single scan by ID.
    /// </summary>
    public async Task<ScanHistoryRecord?> GetScanDetailsAsync(long id, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var args = $"history --id {id} --format json";
        var output = await RunScannerAsync(args, ct);
        return JsonSerializer.Deserialize<ScanHistoryRecord>(output, s_jsonOptions);
    }

    /// <summary>
    /// Run duplicate-file analysis on a directory.
    /// </summary>
    public async Task<DedupResult?> RunDedupAnalysisAsync(string path, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var args = $"dedup --path \"{path}\" --format json";
        var output = await RunScannerAsync(args, ct);
        return JsonSerializer.Deserialize<DedupResult>(output, s_jsonOptions);
    }

    /// <summary>
    /// Run node_modules cleanup analysis via the native cleaner binary.
    /// </summary>
    public async Task<CleanupAnalysis?> RunCleanupAnalysisAsync(
        string path,
        bool cleanup = false,
        ulong minSizeMb = 100,
        ulong unusedDays = 30,
        CancellationToken ct = default)
    {
        var cleanerPath = Path.Combine(AppContext.BaseDirectory, "node_modules_cleaner.exe");
        if (!File.Exists(cleanerPath))
            cleanerPath = "node_modules_cleaner";

        var tempOutput = Path.Combine(Path.GetTempPath(), $"nm_clean_{Guid.NewGuid():N}.json");
        try
        {
            var args = $"\"{path}\" --output \"{tempOutput}\" --dry-run";
            if (cleanup) args = $"\"{path}\" --output \"{tempOutput}\" --cleanup";
            args += $" --min-size {minSizeMb} --unused-days {unusedDays}";

            var psi = new ProcessStartInfo
            {
                FileName = cleanerPath,
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
            {
                if (!File.Exists(tempOutput))
                    throw new Exception($"Cleaner failed (exit {process.ExitCode}): {stderr}");
            }

            if (!File.Exists(tempOutput))
                return null;

            var json = await File.ReadAllTextAsync(tempOutput, ct);
            return JsonSerializer.Deserialize<CleanupAnalysis>(json, s_jsonOptions);
        }
        finally
        {
            if (File.Exists(tempOutput))
            {
                try { File.Delete(tempOutput); } catch { }
            }
        }
    }

    // -- Internal helpers --

    /// <summary>
    /// Run the scanner with the given arguments and return stdout text.
    /// Throws on non-zero exit codes.
    /// </summary>
    private async Task<string> RunScannerAsync(string args, CancellationToken ct)
    {
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

        return stdout;
    }

    private static List<DiskVolume> GetFallbackVolumes()
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
}
