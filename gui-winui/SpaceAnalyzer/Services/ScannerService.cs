// Licensed under the MIT License.

using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

/// <summary>
/// Calls the Rust scanner CLI (space-analyzer-cli) and parses JSON output.
/// Data models now live in <see cref="SpaceAnalyzer.Models"/> for reuse
/// across ViewModels and Views.
/// </summary>
public partial class ScannerService : IDisposable
{
    private readonly string _scannerPath;
    private Process? _currentScannerProcess;
    private CancellationTokenSource? _stopCts;
    private CancellationTokenSource? _cleanerStopCts;
    private readonly object _processLock = new();
    private bool _disposed;

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
        => ResolveToolPath("space-analyzer-cli.exe", "SPACE_ANALYZER_SCANNER", explicitPath);

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
    /// Returns the resolved scanner binary path.
    /// </summary>
    public string ScannerPath => _scannerPath;

    /// <summary>
    /// Returns true if the Rust scanner binary is available.
    /// </summary>
    public bool IsAvailable => File.Exists(_scannerPath);

    /// <summary>
    /// Semantic version of the resolved scanner binary, probed via
    /// <c>space-analyzer-cli --version</c>. Null until <see cref="GetCapabilitiesAsync"/>
    /// runs (or if the CLI is unavailable). Lets the GUI surface the backend
    /// version and gate features on CLI capability instead of silently degrading
    /// when the bundled CLI is older/newer than the GUI expects.
    /// </summary>
    public string? ScannerVersion { get; private set; }

    /// <summary>
    /// Detected CLI capabilities. Defaults to "all supported" so callers keep
    /// current behavior until a positive absence is observed via <see cref="GetCapabilitiesAsync"/>.
    /// </summary>
    public ScannerCapabilities Capabilities { get; private set; } = new();

    private Task<ScannerCapabilities>? _capTask;

    /// <summary>
    /// Probes the scanner once (cached) for its version and per-subcommand flag
    /// support via <c>--help</c>. Capability flags start true and are only set
    /// false when the flag is positively absent, so an unknown/changed help
    /// format preserves the assume-supported default rather than stripping features.
    /// </summary>
    public Task<ScannerCapabilities> GetCapabilitiesAsync(CancellationToken ct = default)
        => _capTask ??= ProbeCapabilitiesAsync(ct);

    /// <summary>
    /// Populates <see cref="ScannerVersion"/> and returns true when the CLI is
    /// present and responded. Delegates to <see cref="GetCapabilitiesAsync"/>.
    /// </summary>
    public async Task<bool> ProbeVersionAsync(CancellationToken ct = default)
    {
        var caps = await GetCapabilitiesAsync(ct);
        return !string.IsNullOrEmpty(caps.Version);
    }

    private async Task<ScannerCapabilities> ProbeCapabilitiesAsync(CancellationToken ct)
    {
        var caps = new ScannerCapabilities();
        Capabilities = caps; // publish defaults immediately (no spawn when unavailable)
        if (!IsAvailable)
            return caps;

        var version = await RunCliCaptureAsync(new[] { "--version" }, ct);
        var vLine = (version ?? string.Empty).Trim();
        var vIdx = vLine.LastIndexOf(' ');
        ScannerVersion = vIdx >= 0 ? vLine[(vIdx + 1)..] : vLine;
        caps.Version = ScannerVersion;

        var historyHelp = await TryRunHelpAsync("history", ct);
        if (historyHelp.Length > 0)
        {
            caps.HistorySortBy = historyHelp.Contains("--sort-by");
            caps.HistorySearch = historyHelp.Contains("--search");
            caps.HistoryOnlyDuplicates = historyHelp.Contains("--only-duplicates");
            caps.HistoryCategoryTotals = historyHelp.Contains("--category-totals");
            caps.HistoryDuplicateAnalysis = historyHelp.Contains("--duplicates");
            caps.HistoryDropRelative = historyHelp.Contains("--drop-relative");
            caps.HistoryBackfillCategories = historyHelp.Contains("--backfill-categories");
        }

        var scanHelp = await TryRunHelpAsync("scan", ct);
        if (scanHelp.Length > 0)
            caps.ScanProgressJson = scanHelp.Contains("--progress-json");

        var dbHelp = await TryRunHelpAsync("db", ct);
        if (dbHelp.Length > 0)
        {
            caps.DbPruneFileCache = dbHelp.Contains("--prune-file-cache");
            caps.DbPruneDiskSpace = dbHelp.Contains("--prune-disk-space");
        }

        return caps;
    }

    private async Task<string> RunCliCaptureAsync(IEnumerable<string> args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var process = new Process { StartInfo = psi };
        process.Start();
        var outTask = process.StandardOutput.ReadToEndAsync(ct);
        var errTask = process.StandardError.ReadToEndAsync(ct);
        try { await process.WaitForExitAsync(ct); }
        catch { try { process.Kill(entireProcessTree: true); } catch { } }
        return (await outTask) + (await errTask);
    }

    private async Task<string> TryRunHelpAsync(string subcommand, CancellationToken ct)
    {
        try { return await RunCliCaptureAsync(new[] { subcommand, "--help" }, ct); }
        catch { return string.Empty; }
    }

    /// <summary>
    /// Per-flag capability detection for the Rust CLI. Every flag defaults to
    /// true (assume supported); <see cref="ProbeCapabilitiesAsync"/> only clears
    /// a flag when a <c>--help</c> probe positively shows it is absent, so an
    /// unknown/changed help format preserves current behavior instead of
    /// wrongly stripping features.
    /// </summary>
    public sealed class ScannerCapabilities
    {
        public string? Version { get; set; }
        public bool HistorySortBy { get; set; } = true;
        public bool HistorySearch { get; set; } = true;
        public bool HistoryOnlyDuplicates { get; set; } = true;
        public bool HistoryCategoryTotals { get; set; } = true;
        public bool HistoryDuplicateAnalysis { get; set; } = true;
        public bool HistoryDropRelative { get; set; } = true;
        public bool HistoryBackfillCategories { get; set; } = true;
        public bool ScanProgressJson { get; set; } = true;
        public bool DbPruneFileCache { get; set; } = true;
        public bool DbPruneDiskSpace { get; set; } = true;
    }

    /// <summary>
    /// Reads all key/value settings from the embedded database by
    /// invoking <c>space-analyzer-cli settings get --format json</c>.
    /// Returns an empty dictionary if the CLI is unavailable or the
    /// command fails.
    /// </summary>
    public async Task<Dictionary<string, string>> GetSettingsAsync(
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new Dictionary<string, string>();
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = _scannerPath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            psi.ArgumentList.Add("settings");
            psi.ArgumentList.Add("get");
            psi.ArgumentList.Add("--format");
            psi.ArgumentList.Add("json");
            using var process = new Process { StartInfo = psi };
            process.Start();
            var stderrTask = process.StandardError.ReadToEndAsync(ct);
            var json = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync(ct);
            _ = await stderrTask;
            if (process.ExitCode != 0)
                return new Dictionary<string, string>();
            if (string.IsNullOrWhiteSpace(json))
                return new Dictionary<string, string>();
            var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                json,
                s_jsonOptions);
            var result = new Dictionary<string, string>();
            if (parsed != null)
            {
                foreach (var kvp in parsed)
                {
                    result[kvp.Key] = kvp.Value.ValueKind == JsonValueKind.String
                        ? kvp.Value.GetString() ?? string.Empty
                        : kvp.Value.GetRawText();
                }
            }
            return result;
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }

    /// <summary>
    /// Writes a batch of key/value settings to the embedded database by
    /// invoking <c>space-analyzer-cli settings set --key K --value V</c>
    /// for each pair.
    /// </summary>
    public async Task SetSettingsAsync(
        IReadOnlyDictionary<string, string> values,
        CancellationToken ct = default)
    {
        if (!IsAvailable || values.Count == 0)
            return;
        try
        {
            foreach (var kvp in values)
            {
                var psi = new ProcessStartInfo
                {
                    FileName = _scannerPath,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                psi.ArgumentList.Add("settings");
                psi.ArgumentList.Add("set");
                psi.ArgumentList.Add("--key");
                psi.ArgumentList.Add(kvp.Key);
                psi.ArgumentList.Add("--value");
                psi.ArgumentList.Add(kvp.Value);
                using var process = new Process { StartInfo = psi };
                process.Start();

                // Drain both streams so a chatty/large response cannot fill the pipe
                // buffer and deadlock the process before it exits.
                var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
                var stderrTask = process.StandardError.ReadToEndAsync(ct);

                using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
                try
                {
                    await process.WaitForExitAsync(linkedCts.Token);
                }
                catch (OperationCanceledException)
                {
                    try { process.Kill(entireProcessTree: true); } catch { }
                    throw;
                }

                await Task.WhenAll(stdoutTask, stderrTask);
            }
        }
        catch
        {
            // Non-fatal: settings are still written to LocalSettings cache.
        }
    }

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

    /// <summary>When false, the scanner is told to run on CPU only (--no-gpu).</summary>
    public bool GpuAcceleration { get; set; } = true;

    /// <summary>When true, the scanner reuses its incremental file cache (--cache)
    /// to skip files unchanged since the previous scan of the same path.</summary>
    public bool UseFileCache { get; set; } = false;
    // -- Internal helpers --

    /// <summary>
    /// Run the scanner with the given arguments and return stdout text.
    /// Throws on non-zero exit codes.
    /// If progress is provided, parses __PROGRESS__ lines from stderr
    /// and reports percentage updates.
    /// Uses ArgumentList to prevent argument injection via path values.
    /// </summary>
    private async Task<string> RunScannerAsync(IEnumerable<string> args, CancellationToken ct, IProgress<StreamProgress>? progress = null)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        CancellationTokenSource stopCts;
        Process process;
        lock (_processLock)
        {
            _stopCts?.Cancel();
            _stopCts?.Dispose();
            stopCts = new CancellationTokenSource();
            _stopCts = stopCts;
            process = new Process { StartInfo = psi };
            _currentScannerProcess = process;
        }

        try
        {
            process.Start();
        }
        catch (Exception ex)
        {
            lock (_processLock)
            {
                if (_currentScannerProcess == process)
                    _currentScannerProcess = null;
                _stopCts = null;
            }
            throw new Exception($"Failed to start scanner: {ex.Message}", ex);
        }

        var stderrTask = ReadStderrWithProgressAsync(process.StandardError, progress, ct);
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);

        using var timeoutCts = new CancellationTokenSource(s_scannerTimeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, stopCts.Token, timeoutCts.Token);
        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            if (timeoutCts.IsCancellationRequested)
            {
                try { process.Kill(entireProcessTree: true); } catch { }
                throw new TimeoutException($"Scanner timed out after {s_scannerTimeout.TotalMinutes} minutes");
            }
            try { process.Kill(entireProcessTree: true); } catch { }
            throw;
        }
        finally
        {
            lock (_processLock)
            {
                if (_currentScannerProcess == process)
                    _currentScannerProcess = null;
                _stopCts = null;
            }
        }

        var stderr = await stderrTask;
        var stdout = await stdoutTask;

        if (process.ExitCode != 0)
            throw new Exception($"Scanner failed (exit {process.ExitCode}): {stderr}");

        return stdout;
    }

    /// <summary>
    /// Reads stderr line by line, parsing __PROGRESS__ prefixed lines
    /// and reporting the percentage via IProgress.
    /// Returns the full stderr text for error reporting.
    /// </summary>
    private static async Task<string> ReadStderrWithProgressAsync(
        System.IO.StreamReader stderr,
        IProgress<StreamProgress>? progress,
        CancellationToken ct)
    {
        var sb = new System.Text.StringBuilder();
        if (progress is null)
        {
            // Consume stderr to prevent deadlocks even if no progress reporting
            var content = await stderr.ReadToEndAsync(ct);
            return content;
        }

        while (true)
        {
            var line = await stderr.ReadLineAsync(ct);
            if (line is null)
                break;
            sb.AppendLine(line);
            if (line.StartsWith("__PROGRESS__"))
            {
                var json = line["__PROGRESS__".Length..];
                try
                {
                    // The JSON carries the full ScanProgress payload (files_scanned,
                    // directories_scanned, total_size, percentage, current_file, …), so the
                    // caller gets the live file + location, not just a percentage.
                    var sp = System.Text.Json.JsonSerializer.Deserialize<StreamProgress>(json, s_jsonOptions);
                    if (sp is not null)
                        progress.Report(sp);
                }
                catch
                {
                    // Ignore malformed progress lines
                }
            }
        }
        return sb.ToString();
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

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        lock (_processLock)
        {
            _stopCts?.Cancel();
            _stopCts?.Dispose();
            _stopCts = null;
            _cleanerStopCts?.Cancel();
            _cleanerStopCts?.Dispose();
            _cleanerStopCts = null;
            if (_currentScannerProcess is { HasExited: false })
            {
                try { _currentScannerProcess.Kill(entireProcessTree: true); } catch { }
            }
            _currentScannerProcess?.Dispose();
            _currentScannerProcess = null;
        }
        GC.SuppressFinalize(this);
    }
}
