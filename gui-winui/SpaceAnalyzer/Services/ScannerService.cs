// Licensed under the MIT License.

using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
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
    private Process? _currentScannerProcess;
    private readonly object _processLock = new();

    /// <summary>
    /// Maps the Rust scanner's snake_case JSON (e.g. "total_files") to the PascalCase
    /// C# models (e.g. <see cref="ScanResult.TotalFiles"/>). Case-insensitivity alone is
    /// insufficient � it ignores case but not the snake_case underscores, which left every
    /// field unmapped and caused results to deserialize to all-zeros.
    /// </summary>
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        // The node_modules_cleaner serializes RiskLevel as strings ("Low"/"Medium"/"High").
        // Without a string enum converter, System.Text.Json expects numbers and throws
        // when deserializing cleanup candidates. allowIntegerValues stays true so any
        // numeric enum values elsewhere still parse.
        Converters = { new JsonStringEnumConverter() },
    };

    private static readonly TimeSpan s_scannerTimeout = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan s_cleanerTimeout = TimeSpan.FromMinutes(10);

    public ScannerService(string? scannerPath = null)
    {
        _scannerPath = ResolveScannerPath(scannerPath);
    }

    /// <summary>
    /// Locate the Rust scanner binary. Priority: explicit path &gt; SPACE_ANALYZER_SCANNER
    /// env var &gt; beside the app &gt; target/{debug,release} found by walking up from the
    /// app directory. See <see cref="ResolveToolPath"/> for the shared resolution logic.
    /// </summary>
    private static string ResolveScannerPath(string? explicitPath)
        => ResolveToolPath("space-analyzer-pro.exe", "SPACE_ANALYZER_SCANNER", explicitPath);

    /// <summary>
    /// Locate a native tool binary by name. Priority: explicit path &gt; env var
    /// &gt; beside the app &gt; target/{debug,release} found by walking up from the app
    /// directory. Returns the best candidate path (which may not exist; callers should
    /// check <see cref="File.Exists"/> before launching).
    /// </summary>
    private static string ResolveToolPath(string exeName, string envVar, string? explicitPath)
    {
        if (!string.IsNullOrWhiteSpace(explicitPath) && File.Exists(explicitPath))
            return explicitPath;

        var envPath = Environment.GetEnvironmentVariable(envVar);
        if (!string.IsNullOrWhiteSpace(envPath) && File.Exists(envPath))
            return envPath;

        var beside = Path.Combine(AppContext.BaseDirectory, exeName);
        if (File.Exists(beside))
            return beside;

        // Walk up from the app directory to locate the Rust target output.
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (int i = 0; i < 8 && dir != null; i++)
        {
            foreach (var cfg in new[] { "debug", "release" })
            {
                var candidate = Path.Combine(dir.FullName, "target", cfg, exeName);
                if (File.Exists(candidate))
                    return candidate;
            }
            dir = dir.Parent;
        }

        // Fall back to the beside-app location (callers can check File.Exists).
        return beside;
    }

    /// <summary>
    /// Returns true if the Rust scanner binary is available.
    /// </summary>
    public bool IsAvailable => File.Exists(_scannerPath);

    /// <summary>
    /// Run a directory scan and return structured results.
    /// </summary>
    public enum DepthMode
    {
        Default,
        Shallow,
        Custom,
        Deep
    }

    public async Task<ScanResult?> ScanDirectoryAsync(
        string path,
        DepthMode depthMode = DepthMode.Default,
        int maxDepth = 5,
        bool includeHidden = false,
        IProgress<double>? progress = null,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            throw new FileNotFoundException(
                $"Scanner binary not found at {_scannerPath}. " +
                "Build it with: cargo build --release --bin space-analyzer-pro");

        if (!Directory.Exists(path))
            throw new DirectoryNotFoundException($"Scan path does not exist: {path}");

        var args = $"scan --path \"{path}\" --format json";
        if (depthMode == DepthMode.Deep)
            args += " --deep";
        else if (depthMode == DepthMode.Shallow)
            args += " --shallow";
        else if (depthMode == DepthMode.Custom)
            args += $" --max-depth {maxDepth}";
        if (includeHidden)
            args += " --include-hidden";

        var output = await RunScannerAsync(args, ct);
        try
        {
            return JsonSerializer.Deserialize<ScanResult>(output, s_jsonOptions)
                ?? throw new JsonException("Scanner returned empty result");
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan result: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Cancel the currently running scan by killing the scanner process tree.
    /// </summary>
    public void StopScan()
    {
        lock (_processLock)
        {
            if (_currentScannerProcess is not null && !_currentScannerProcess.HasExited)
            {
                try
                {
                    _currentScannerProcess.Kill(entireProcessTree: true);
                }
                catch { }
            }
        }
    }

    /// <summary>
    /// Export a scan result to a JSON file.
    /// </summary>
    public async Task<string> ExportScanResultAsync(ScanResult result, string outputPath, CancellationToken ct = default)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(result, options);
        await File.WriteAllTextAsync(outputPath, json, ct);
        return outputPath;
    }

    /// <summary>
    /// Get disk space info for all volumes.
    /// </summary>
    public async Task<List<DiskVolume>> GetDiskVolumesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return GetFallbackVolumes();

        var output = await RunScannerAsync("disk-info --format json", ct);
        try
        {
            var volumes = JsonSerializer.Deserialize<List<DiskVolume>>(output, s_jsonOptions);
            // If the scanner reported no volumes (e.g. sysinfo found none), fall back to
            // the local DriveInfo view so the dashboard still shows mounted drives.
            return volumes is { Count: > 0 } ? volumes : GetFallbackVolumes();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse disk info: {jex.Message}. Output: {Truncate(output)}", jex);
        }
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
        // The history subcommand prints nothing to stdout (and an error to stderr) when
        // the embedded database can't be opened; treat empty output as "no history".
        if (string.IsNullOrWhiteSpace(output))
            return new();
        try
        {
            return JsonSerializer.Deserialize<List<ScanHistoryRecord>>(output, s_jsonOptions) ?? new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan history: {jex.Message}. Output: {Truncate(output)}", jex);
        }
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
        // "No scan found with id X" is printed to stderr with empty stdout; treat that as
        // a missing record rather than a parse error.
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<ScanHistoryRecord>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan details: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Delete a scan record by ID.
    /// </summary>
    public async Task<bool> DeleteScanAsync(long id, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return false;

        try
        {
            var args = $"history --delete {id} --format json";
            var output = await RunScannerAsync(args, ct);
            return true;
        }
        catch
        {
            return false;
        }
    }
    public async Task<DedupResult?> RunDedupAnalysisAsync(string path, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var args = $"dedup --path \"{path}\" --format json";
        var output = await RunScannerAsync(args, ct);
        try
        {
            return JsonSerializer.Deserialize<DedupResult>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse dedup result: {jex.Message}. Output: {Truncate(output)}", jex);
        }
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
        // Resolve the cleaner the same way as the scanner (env var > beside app >
        // target/{release,debug} walked up from the app dir), so cleanup analysis works
        // in dev builds without copying the binary next to the app.
        var cleanerPath = ResolveToolPath("node_modules_cleaner.exe", "SPACE_ANALYZER_CLEANER", null);
        if (!File.Exists(cleanerPath))
            return null;

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
            // Read stdout/stderr concurrently to avoid deadlocks when the cleaner writes
            // enough to either pipe to fill its OS buffer.
            var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
            var stderrTask = process.StandardError.ReadToEndAsync(ct);

            using var timeoutCts = new CancellationTokenSource(s_cleanerTimeout);
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
            try
            {
                await process.WaitForExitAsync(linkedCts.Token);
            }
            catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
            {
                try { process.Kill(entireProcessTree: true); } catch { }
                throw new TimeoutException($"node_modules_cleaner timed out after {s_cleanerTimeout.TotalMinutes} minutes");
            }

            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            if (process.ExitCode != 0)
            {
                if (!File.Exists(tempOutput))
                    throw new Exception($"Cleaner failed (exit {process.ExitCode}): {stderr}");
            }

            if (!File.Exists(tempOutput))
                return null;

            var json = await File.ReadAllTextAsync(tempOutput, ct);
            try
            {
                return JsonSerializer.Deserialize<CleanupAnalysis>(json, s_jsonOptions);
            }
            catch (JsonException jex)
            {
                throw new Exception($"Failed to parse cleanup analysis: {jex.Message}. Output: {Truncate(json)}", jex);
            }
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

        lock (_processLock)
        {
            _currentScannerProcess = new Process { StartInfo = psi };
        }

        var process = _currentScannerProcess;
        process.Start();
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = process.StandardError.ReadToEndAsync(ct);

        using var timeoutCts = new CancellationTokenSource(s_scannerTimeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            throw new TimeoutException($"Scanner timed out after {s_scannerTimeout.TotalMinutes} minutes");
        }
        finally
        {
            lock (_processLock)
            {
                if (_currentScannerProcess == process)
                    _currentScannerProcess = null;
            }
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
            throw new Exception($"Scanner failed (exit {process.ExitCode}): {stderr}");

        return stdout;
    }

    private static string Truncate(string s) => s.Length <= 500 ? s : s[..500] + "...(truncated)";

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
