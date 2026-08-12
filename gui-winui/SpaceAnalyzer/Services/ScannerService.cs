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
public class ScannerService : IDisposable
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
    /// <c>space-analyzer-cli --version</c>. Null until <see cref="ProbeVersionAsync"/>
    /// runs (or if the CLI is unavailable). Lets the GUI surface the backend
    /// version and gate features on CLI capability instead of silently degrading
    /// when the bundled CLI is older/newer than the GUI expects.
    /// </summary>
    public string? ScannerVersion { get; private set; }

    /// <summary>
    /// Probes the scanner binary for its version string. Populates
    /// <see cref="ScannerVersion"/> and returns true when the CLI is present and
    /// responded. Safe to call on a background thread; never throws.
    /// </summary>
    public async Task<bool> ProbeVersionAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
        {
            ScannerVersion = null;
            return false;
        }
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = _scannerPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            psi.ArgumentList.Add("--version");
            using var process = new Process { StartInfo = psi };
            process.Start();
            var stdout = await process.StandardOutput.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);
            var line = (stdout ?? string.Empty).Trim();
            // clap prints "<package-name> <version>", e.g. "space-analyzer-pro-desktop 3.7.0".
            var idx = line.LastIndexOf(' ');
            ScannerVersion = idx >= 0 ? line[(idx + 1)..] : line;
            return true;
        }
        catch
        {
            ScannerVersion = null;
            return false;
        }
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

    public async Task<ScanResult?> ScanDirectoryAsync(
        string path,
        DepthMode depthMode = DepthMode.Default,
        int maxDepth = 5,
        bool includeHidden = false,
        IProgress<StreamProgress>? progress = null,
        CancellationToken ct = default,
        bool? useGpu = null)
    {
        if (!IsAvailable)
            throw new FileNotFoundException(
                $"Scanner binary not found at {_scannerPath}. " +
                "Build it with: cargo build --release --bin space-analyzer-cli");

        if (!Directory.Exists(path))
            throw new DirectoryNotFoundException($"Scan path does not exist: {path}");

        var argList = new List<string> { "scan", "--path", path, "--format", "json" };
        if (depthMode == DepthMode.Deep)
            argList.Add("--deep");
        else if (depthMode == DepthMode.Shallow)
            argList.Add("--shallow");
        else if (depthMode == DepthMode.Custom)
        {
            argList.Add("--max-depth");
            argList.Add(maxDepth.ToString());
        }
        if (includeHidden)
            argList.Add("--include-hidden");
        if (!(useGpu ?? GpuAcceleration))
            argList.Add("--no-gpu");
        if (progress is not null)
            argList.Add("--progress-json");

        int scanId = ScanActivityMonitor.Instance.BeginScan(path);
        try
        {
            var output = await RunScannerAsync(argList, ct, progress);
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
        finally
        {
            ScanActivityMonitor.Instance.EndScan(scanId);
        }
    }

    /// <summary>
    /// Run a directory scan in streaming mode. The CLI emits JSONL lines to stdout,
    /// each prefixed with {"type":"progress",...} or {"type":"complete",...}.
    /// The <paramref name="onProgress"/> callback is invoked for every progress line,
    /// and the final ScanResult is returned when the "complete" line is received.
    /// </summary>
    public async Task<ScanResult?> ScanDirectoryStreamingAsync(
        string path,
        DepthMode depthMode = DepthMode.Default,
        int maxDepth = 5,
        bool includeHidden = false,
        IProgress<StreamProgress>? onProgress = null,
        CancellationToken ct = default,
        bool? useGpu = null)
    {
        if (!IsAvailable)
            throw new FileNotFoundException(
                $"Scanner binary not found at {_scannerPath}. " +
                "Build it with: cargo build --release --bin space-analyzer-cli");

        if (!Directory.Exists(path))
            throw new DirectoryNotFoundException($"Scan path does not exist: {path}");

        var argList = new List<string> { "scan", "--path", path, "--format", "json", "--stream" };
        if (depthMode == DepthMode.Deep)
            argList.Add("--deep");
        else if (depthMode == DepthMode.Shallow)
            argList.Add("--shallow");
        else if (depthMode == DepthMode.Custom)
        {
            argList.Add("--max-depth");
            argList.Add(maxDepth.ToString());
        }
        if (includeHidden)
            argList.Add("--include-hidden");
        if (!(useGpu ?? GpuAcceleration))
            argList.Add("--no-gpu");

        int scanId = ScanActivityMonitor.Instance.BeginScan(path);
        var psi = new ProcessStartInfo
        {
            FileName = _scannerPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var a in argList) psi.ArgumentList.Add(a);

        CancellationTokenSource stopCts;
        Process process;
        lock (_processLock)
        {
            _stopCts?.Cancel();
            _stopCts?.Dispose();
            stopCts = new CancellationTokenSource();
            _stopCts = stopCts;
            _currentScannerProcess = new Process { StartInfo = psi };
            process = _currentScannerProcess;
        }
        try
        {
            process.Start();
        }
        catch (Exception ex)
        {
            _currentScannerProcess = null;
            throw new Exception($"Failed to start scanner: {ex.Message}", ex);
        }

        _ = ReadStderrAsync(process.StandardError, ct);

        var stdoutReader = process.StandardOutput;
        var finalResult = (ScanResult?)null;

        using var timeoutCts = new CancellationTokenSource(s_scannerTimeout);
        try
        {
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, stopCts.Token, timeoutCts.Token);

            string? line;
            while ((line = await stdoutReader.ReadLineAsync()) is not null)
            {
                if (string.IsNullOrWhiteSpace(line))
                    continue;

                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("type", out var typeProp))
                    {
                        var eventType = typeProp.GetString();
                        if (eventType == "progress")
                        {
                            var progress = JsonSerializer.Deserialize<StreamProgress>(line, s_jsonOptions);
                            if (progress != null)
                                onProgress?.Report(progress);
                        }
                        else if (eventType == "complete")
                        {
                            var complete = JsonSerializer.Deserialize<StreamComplete>(line, s_jsonOptions);
                            if (complete != null)
                            {
                                finalResult = new ScanResult
                                {
                                    TotalFiles = complete.TotalFiles,
                                    TotalSizeBytes = complete.TotalSizeBytes,
                                    TotalSizeMb = complete.TotalSizeMb,
                                    DurationSecs = complete.DurationSecs,
                                    FileTypes = complete.FileTypes.ToDictionary(kvp => kvp.Key, kvp => (long)kvp.Value),
                                    ExtensionSizes = complete.ExtensionSizes,
                                    CategorySizes = complete.CategorySizes,
                                    LargestFiles = complete.LargestFiles,
                                    Errors = complete.Errors,
                                    Path = complete.Path,
                                    TotalDirs = complete.TotalDirs,
                                    TopDirectories = complete.TopDirectories,
                                    EmptyDirs = complete.EmptyDirs,
                                    PotentialCleanupBytes = complete.PotentialCleanupBytes,
                                    Timestamp = complete.Timestamp,
                                };
                            }
                        }
                    }
                }
                catch (JsonException)
                {
                    // Skip non-JSON lines
                }

                // Check for cancellation
                if (stopCts.Token.IsCancellationRequested || ct.IsCancellationRequested)
                {
                    if (!process.HasExited)
                        process.Kill(entireProcessTree: true);
                    throw new OperationCanceledException("Scan was cancelled.");
                }
            }

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
            ScanActivityMonitor.Instance.EndScan(scanId);
        }

        if (process.ExitCode != 0)
        {
            var stderr = await process.StandardError.ReadToEndAsync(ct);
            throw new Exception($"Scanner failed (exit {process.ExitCode}): {stderr}");
        }

        return finalResult;
    }

    private static async Task ReadStderrAsync(
        System.IO.StreamReader stderr,
        CancellationToken ct)
    {
        try
        {
            while (await stderr.ReadLineAsync(ct) is not null)
            {
                if (ct.IsCancellationRequested)
                    break;
            }
        }
        catch
        {
            // Ignore - stderr is not parsed in streaming mode
        }
    }

    /// <summary>
    /// Cancel the currently running scan by killing the scanner process tree.
    /// </summary>
    public void StopScan()
    {
        lock (_processLock)
        {
            _stopCts?.Cancel();
            if (_currentScannerProcess is not null && !_currentScannerProcess.HasExited)
            {
                try
                {
                    _currentScannerProcess.Kill(entireProcessTree: true);
                }
                catch (InvalidOperationException)
                {
                    // Process already exited between HasExited check and Kill.
                }
            }
        }
    }

    /// <summary>
    /// Export a scan result to a file. Supported formats: json, csv, md, html.
    /// </summary>
    public async Task<string> ExportScanResultAsync(ScanResult result, string outputPath, string format = "json", CancellationToken ct = default)
    {
        format = format.ToLowerInvariant() switch
        {
            "csv" => "csv",
            "md" or "markdown" => "md",
            "html" or "htm" => "html",
            _ => "json",
        };

        var content = format switch
        {
            "csv" => SerializeToCsv(result),
            "md" => SerializeToMarkdown(result),
            "html" => SerializeToHtml(result),
            _ => JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }),
        };

        await File.WriteAllTextAsync(outputPath, content, ct);
        return outputPath;
    }

    private static string SerializeToCsv(ScanResult result)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Path,SizeBytes,SizeDisplay,Modified");
        foreach (var kvp in (result.ScannedFiles ?? new()).OrderByDescending(kv => kv.Value.Size))
        {
            var modified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).ToString("o");
            var path = kvp.Key.Replace("\"", "\"\"");
            sb.AppendLine($"\"{path}\",{kvp.Value.Size},\"{ByteFormatter.FormatBytes(kvp.Value.Size)}\",\"{modified}\"");
        }
        return sb.ToString();
    }

    private static string SerializeToMarkdown(ScanResult result)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"# Space Analyzer Scan: {result.Path}\n");
        sb.AppendLine($"- **Files:** {result.TotalFiles:N0}");
        sb.AppendLine($"- **Total Size:** {ByteFormatter.FormatBytes(result.TotalSizeBytes)}");
        sb.AppendLine($"- **Duration:** {result.DurationSecs:F1}s\n");
        sb.AppendLine("## Largest Files\n");
        sb.AppendLine("| Size | Path |");
        sb.AppendLine("|------|------|");
        foreach (var f in (result.LargestFiles ?? new()).Take(50))
        {
            var path = f.Path.Replace("|", "\\|");
            sb.AppendLine($"| {f.SizeDisplay} | `{path}` |");
        }
        return sb.ToString();
    }

    private static string SerializeToHtml(ScanResult result)
    {
        var esc = (string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html lang=\"en\"><head><meta charset=\"utf-8\">");
        sb.AppendLine($"<title>Space Analyzer Scan: {esc(result.Path)}</title>");
        sb.AppendLine("<style>body{font-family:Segoe UI,system-ui,sans-serif;margin:2rem;color:#1b1b1b}");
        sb.AppendLine("table{border-collapse:collapse;width:100%;margin-top:1rem}");
        sb.AppendLine("th,td{border:1px solid #d0d0d0;padding:.4rem .6rem;text-align:left}");
        sb.AppendLine("th{background:#f3f3f3}td.size{text-align:right;font-variant-numeric:tabular-nums}</style>");
        sb.AppendLine("</head><body>");
        sb.AppendLine($"<h1>Space Analyzer Scan: {esc(result.Path)}</h1>");
        sb.AppendLine("<ul>");
        sb.AppendLine($"<li><strong>Files:</strong> {result.TotalFiles:N0}</li>");
        sb.AppendLine($"<li><strong>Total Size:</strong> {ByteFormatter.FormatBytes(result.TotalSizeBytes)}</li>");
        sb.AppendLine($"<li><strong>Duration:</strong> {result.DurationSecs:F1}s</li>");
        sb.AppendLine("</ul>");
        sb.AppendLine("<h2>Largest Files</h2>");
        sb.AppendLine("<table><thead><tr><th>Size</th><th>Path</th></tr></thead><tbody>");
        foreach (var f in (result.LargestFiles ?? new()).Take(50))
            sb.AppendLine($"<tr><td class=\"size\">{f.SizeDisplay}</td><td>{esc(f.Path)}</td></tr>");
        sb.AppendLine("</tbody></table>");
        sb.AppendLine("</body></html>");
        return sb.ToString();
    }

    /// <summary>
    /// Get disk space info for all volumes.
    /// </summary>
    public async Task<List<DiskVolume>> GetDiskVolumesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return GetFallbackVolumes();

        var output = await RunScannerAsync(new[] { "disk-info", "--format", "json" }, ct);
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

        var output = await RunScannerAsync(new[] { "history", "--limit", limit.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new();
        try
        {
            // Handle both old (array) and new (paginated object) response formats
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<ScanHistoryRecord>>(output, s_jsonOptions) ?? new();
            if (doc.RootElement.TryGetProperty("records", out var records))
                return records.Deserialize<List<ScanHistoryRecord>>(s_jsonOptions) ?? new();
            return new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan history: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get scan history with pagination, search, and sort support.
    /// Returns (records, totalCount).
    /// </summary>
    public async Task<(List<ScanHistoryRecord> Records, long Total)> GetScanHistoryPageAsync(
        int limit = 50,
        int offset = 0,
        string? search = null,
        string sortBy = "timestamp",
        bool sortAsc = false,
        bool onlyDuplicates = false,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (new(), 0);

        // Only forward columns the CLI actually accepts; an invalid --sort-by silently
        // falls back to a default on the server and would make the UI sort indicator lie.
        var allowedSort = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "timestamp", "path", "total_size_bytes", "total_files",
        };
        var effectiveSortBy = allowedSort.Contains(sortBy) ? sortBy : "timestamp";

        var argList = new List<string> { "history", "--limit", limit.ToString(), "--offset", offset.ToString(), "--sort-by", effectiveSortBy };
        if (sortAsc) argList.Add("--sort-asc");
        if (!string.IsNullOrWhiteSpace(search)) { argList.Add("--search"); argList.Add(search); }
        if (onlyDuplicates) argList.Add("--only-duplicates");

        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (new(), 0);
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("records", out var recordsProp)
                && doc.RootElement.TryGetProperty("total", out var totalProp))
            {
                var records = recordsProp.Deserialize<List<ScanHistoryRecord>>(s_jsonOptions) ?? new();
                return (records, totalProp.GetInt64());
            }
            // Fallback: treat as plain array
            var fallback = JsonSerializer.Deserialize<List<ScanHistoryRecord>>(output, s_jsonOptions) ?? new();
            return (fallback, fallback.Count);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan history page: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get the lightweight chronological series of every scan (id, path,
    /// timestamp, size) for the "Size Trend" graph. This is independent of the
    /// paginated <see cref="History"/> list so the chart stays stable across
    /// page turns and searches.
    /// </summary>
    public async Task<List<HistoryTrendPoint>> GetScanHistoryTrendAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new();

        var output = await RunScannerAsync(new[] { "history", "--trend", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new();
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<HistoryTrendPoint>>(output, s_jsonOptions) ?? new();
            return new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse scan trend: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Aggregate the per-category size breakdown across every scan-history record
    /// (the backend sums each record's <c>category_sizes_json</c>). Returns a flat
    /// category -&gt; bytes map used by the History page "Library Composition" donut.
    /// </summary>
    public async Task<Dictionary<string, ulong>> GetCategoryHistoryAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new Dictionary<string, ulong>();

        var output = await RunScannerAsync(new[] { "history", "--category-totals", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new Dictionary<string, ulong>();

        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                var dict = new Dictionary<string, ulong>(StringComparer.OrdinalIgnoreCase);
                foreach (var prop in doc.RootElement.EnumerateObject())
                    if (prop.Value.TryGetUInt64(out var v))
                        dict[prop.Name] = v;
                return dict;
            }
            return new Dictionary<string, ulong>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse category history: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Get full details for a single scan by ID.
    /// </summary>
    public async Task<ScanHistoryRecord?> GetScanDetailsAsync(long id, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "history", "--id", id.ToString(), "--format", "json" }, ct);
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
            var output = await RunScannerAsync(new[] { "history", "--delete", id.ToString(), "--format", "json" }, ct);
            if (string.IsNullOrWhiteSpace(output))
                return false;
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("deleted", out var deleted))
                return deleted.GetBoolean();
            return false;
        }
        catch
        {
            return false;
        }
    }
    public async Task<DedupResult?> RunDedupAnalysisAsync(
        string path,
        CancellationToken ct = default,
        bool apply = false,
        bool? useGpu = null)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "dedup", "--path", path, "--format", "json" };
        if (apply)
        {
            argList.Add("--apply");
            // The backend refuses to modify any files without --yes in non-interactive
            // mode, so it must be supplied for an apply to actually create hard links.
            argList.Add("--yes");
        }
        if (!(useGpu ?? GpuAcceleration))
            argList.Add("--no-gpu");

        int scanId = ScanActivityMonitor.Instance.BeginScan(path);
        try
        {
            var output = await RunScannerAsync(argList, ct);
            try
            {
                return JsonSerializer.Deserialize<DedupResult>(output, s_jsonOptions);
            }
            catch (JsonException jex)
            {
                throw new Exception($"Failed to parse dedup result: {jex.Message}. Output: {Truncate(output)}", jex);
            }
        }
        finally
        {
            ScanActivityMonitor.Instance.EndScan(scanId);
        }
    }

    /// <summary>
    /// Remove scan records that captured nothing (zero files) via
    /// <c>history --prune-empty</c>. Returns the number removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneEmptyScansAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--prune-empty", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_empty", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("empty_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Remove scan records whose path is not absolute (e.g. relative "." scans)
    /// via <c>history --prune --drop-relative</c>. Returns the number removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneRelativeScansAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--prune", "--drop-relative", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("relative_path_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Recompute the per-category size breakdown for cached scans that predate
    /// the category column, using only the already-stored extension sizes.
    /// Returns the number of records back-filled.
    /// </summary>
    public async Task<(bool Success, int Updated, string Error)> BackfillCategoriesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--backfill-categories", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("backfilled", out var ok) && ok.GetBoolean())
            {
                var updated = root.TryGetProperty("records_updated", out var u) ? u.GetInt32() : 0;
                return (true, updated, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected back-fill response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Remove per-scan file-cache rows whose directory no longer has any saved
    /// scan history (stale incremental-scan caches) via <c>db --prune-file-cache</c>.
    /// Returns the number of cache rows removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneFileCacheAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "db", "--prune-file-cache", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_file_cache", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("cache_rows_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Drop disk-space snapshots older than <paramref name="keepHours"/> via
    /// <c>db --prune-disk-space N</c>. Returns the number of snapshots removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> PruneDiskSpaceAsync(int keepHours, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "db", "--prune-disk-space", keepHours.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned_disk_space", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("disk_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Compact the embedded database (VACUUM) to reclaim space left by deleted
    /// rows. Returns true on success.
    /// </summary>
    public async Task<(bool Success, string Error)> VacuumDatabaseAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "db", "--vacuum", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("vacuumed", out var ok) && ok.GetBoolean())
                return (true, string.Empty);
            if (root.TryGetProperty("error", out var err))
                return (false, err.GetString() ?? "Unknown error");
            return (false, "Unexpected vacuum response");
        }
        catch (JsonException jex)
        {
            return (false, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Read database maintenance stats (free/total/used pages and per-table row
    /// counts) via <c>db --info</c>.
    /// </summary>
    public async Task<DatabaseInfo?> GetDatabaseInfoAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "db", "--info", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<DatabaseInfo>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse database info: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Delete ALL scan history records via <c>history --clear</c>. Destructive.
    /// Returns the number of records removed.
    /// </summary>
    public async Task<(bool Success, int Removed, string Error)> ClearHistoryAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--clear", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("cleared", out var ok) && ok.GetBoolean())
            {
                var removed = root.TryGetProperty("records_removed", out var r) ? r.GetInt32() : 0;
                return (true, removed, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, err.GetString() ?? "Unknown error");
            return (false, 0, "Unexpected clear response");
        }
        catch (JsonException jex)
        {
            return (false, 0, $"Failed to parse result: {jex.Message}");
        }
    }

    /// <summary>
    /// Remove duplicate scan records from history, keeping the newest entry per
    /// (path, total size, file count). Returns the prune outcome.
    /// </summary>
    public async Task<(bool Success, int DuplicatesRemoved, int RelativeRemoved, string Error)> PruneDuplicateScansAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return (false, 0, 0, "Scanner unavailable");

        var output = await RunScannerAsync(new[] { "history", "--prune", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return (false, 0, 0, "Empty response from scanner");

        try
        {
            using var doc = JsonDocument.Parse(output);
            var root = doc.RootElement;
            if (root.TryGetProperty("pruned", out var pruned) && pruned.GetBoolean())
            {
                var dup = root.TryGetProperty("duplicate_records_removed", out var d) ? d.GetInt32() : 0;
                var rel = root.TryGetProperty("relative_path_records_removed", out var r) ? r.GetInt32() : 0;
                return (true, dup, rel, string.Empty);
            }
            if (root.TryGetProperty("error", out var err))
                return (false, 0, 0, err.GetString() ?? "Unknown error");
            return (false, 0, 0, "Unexpected prune response");
        }
        catch (JsonException jex)
        {
            return (false, 0, 0, $"Failed to parse prune result: {jex.Message}");
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
        var cleanerPath = ResolveToolPath("node_modules_cleaner.exe", "SPACE_ANALYZER_CLEANER", null);
        if (!File.Exists(cleanerPath))
            return null;

        int scanId = ScanActivityMonitor.Instance.BeginScan(path);
        var tempOutput = Path.Combine(Path.GetTempPath(), $"nm_clean_{Guid.NewGuid():N}.json");
        try
        {
            var argList = new List<string> { path, "--output", tempOutput };
            if (cleanup) argList.Add("--cleanup");
            argList.Add("--min-size");
            argList.Add(minSizeMb.ToString());
            argList.Add("--unused-days");
            argList.Add(unusedDays.ToString());

            var psi = new ProcessStartInfo
            {
                FileName = cleanerPath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (var a in argList) psi.ArgumentList.Add(a);

            _cleanerStopCts?.Cancel();
            _cleanerStopCts?.Dispose();
            using var stopCts = new CancellationTokenSource();
            _cleanerStopCts = stopCts;

            using var process = new Process { StartInfo = psi };
            process.Start();
            var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
            var stderrTask = process.StandardError.ReadToEndAsync(ct);

            using var timeoutCts = new CancellationTokenSource(s_cleanerTimeout);
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
                    throw new TimeoutException($"node_modules_cleaner timed out after {s_cleanerTimeout.TotalMinutes} minutes");
                }
                try { process.Kill(entireProcessTree: true); } catch { }
                throw;
            }
            finally
            {
                _cleanerStopCts = null;
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
            ScanActivityMonitor.Instance.EndScan(scanId);
        }
    }

    /// <summary>
    /// Analyze a single file's relationships and deletion impact via the
    /// Rust <c>dependencies</c> subcommand (file_relations::analyze_file_dependencies).
    /// </summary>
    public async Task<DependencyReport?> GetDependencyReportAsync(string path, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "dependencies", path, "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<DependencyReport>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse dependency report: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Generate and store semantic embeddings for a directory via the Rust
    /// <c>embed</c> subcommand. Returns the scan id the vectors are attached to
    /// (created when <paramref name="scanId"/> is null).
    /// </summary>
    public async Task<EmbedResult?> EmbedDirectoryAsync(
        string path,
        long? scanId = null,
        string? minSize = null,
        string? maxSize = null,
        bool includeHidden = false,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "embed", path, "--format", "json" };
        if (scanId.HasValue) { argList.Add("--scan-id"); argList.Add(scanId.Value.ToString()); }
        if (!string.IsNullOrWhiteSpace(minSize)) { argList.Add("--min-size"); argList.Add(minSize); }
        if (!string.IsNullOrWhiteSpace(maxSize)) { argList.Add("--max-size"); argList.Add(maxSize); }
        if (includeHidden) argList.Add("--include-hidden");

        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<EmbedResult>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse embed result: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Natural-language file search over a previously embedded scan via the Rust
    /// <c>semantic-search</c> subcommand. Returns ranked matches by similarity.
    /// </summary>
    public async Task<List<SemanticSearchResult>?> SemanticSearchAsync(
        string query,
        long scanId,
        int top = 20,
        CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "semantic-search", query, "--scan-id", scanId.ToString(), "--top", top.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("results", out var results))
                return results.Deserialize<List<SemanticSearchResult>>(s_jsonOptions) ?? new();
            // Tolerate a bare array response as well.
            return JsonSerializer.Deserialize<List<SemanticSearchResult>>(output, s_jsonOptions) ?? new();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse semantic search results: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// List volumes that expose an NTFS USN change journal via the Rust
    /// <c>usn volumes</c> subcommand.
    /// </summary>
    public async Task<List<string>?> GetUsnVolumesAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return new List<string>();

        var output = await RunScannerAsync(new[] { "usn", "volumes", "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return new List<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(output, s_jsonOptions) ?? new List<string>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse USN volumes: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Show USN journal status for a drive via the Rust <c>usn status</c> subcommand.
    /// </summary>
    public async Task<UsnJournalInfo?> GetUsnStatusAsync(string? drive = null, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "usn", "status", "--format", "json" };
        if (!string.IsNullOrWhiteSpace(drive)) argList.Add(drive);
        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<UsnJournalInfo>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse USN status: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Read recent USN journal changes for a drive via the Rust
    /// <c>usn changes</c> subcommand.
    /// </summary>
    public async Task<ChangeSet?> GetUsnChangesAsync(string drive, int max = 1000, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "usn", "changes", drive, "--max", max.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<ChangeSet>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse USN changes: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Detect bloat candidates in a stored scan using the Rust <c>bloat</c>
    /// subcommand (offline_ai::FilePatternClassifier). Returns null when the
    /// scanner is unavailable or the command fails, so the caller can fall back
    /// to its local heuristic.
    /// </summary>
    public async Task<List<BloatFinding>?> GetBloatFindingsAsync(long? scanId = null, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "bloat", "--format", "json" };
        if (scanId.HasValue && scanId.Value > 0)
        {
            argList.Add("--scan-id");
            argList.Add(scanId.Value.ToString());
        }

        var output = await RunScannerAsync(argList, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(output);
            if (doc.RootElement.TryGetProperty("findings", out var findings))
                return findings.Deserialize<List<BloatFinding>>(s_jsonOptions) ?? new List<BloatFinding>();
            return new List<BloatFinding>();
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse bloat findings: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Project future disk usage from the scan-history size trend via the Rust
    /// <c>predict</c> subcommand (linear regression over historical sizes).
    /// Returns null when the scanner is unavailable or the command fails, so the
    /// caller can fall back to its local heuristic.
    /// </summary>
    public async Task<StoragePrediction?> GetStorageForecastAsync(int days = 30, CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "predict", "--days", days.ToString(), "--format", "json" }, ct);
        if (string.IsNullOrWhiteSpace(output))
            return null;
        try
        {
            return JsonSerializer.Deserialize<StoragePrediction>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse storage forecast: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

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
