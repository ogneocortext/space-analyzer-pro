// Licensed under the MIT License.
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ScannerService
{

    public async Task<ScanResult?> ScanDirectoryAsync(
        string path,
        DepthMode depthMode = DepthMode.Default,
        int maxDepth = 5,
        bool includeHidden = false,
        IProgress<StreamProgress>? progress = null,
        CancellationToken ct = default,
        bool? useGpu = null,
        bool? useCache = null)
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
        if (useCache ?? UseFileCache)
            argList.Add("--cache");
        // Bound the directory/file breakdown the CLI returns. The CLI now caps
        // top_directories/largest_files to --top; the GUI wants a generous slice
        // for its treemap/largest-files views, not the CLI's 20-item default.
        argList.Add("--top");
        argList.Add("250");
        if (progress is not null)
        {
            var scanCaps = await GetCapabilitiesAsync(ct);
            if (scanCaps.ScanProgressJson)
                argList.Add("--progress-json");
        }

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
    /// <summary>
    /// The id of the scan-history record written by the most recent streaming
    /// scan, when it was launched with <c>saveToHistory: true</c>. Null otherwise.
    /// The GUI uses this to offer a "View in History" bridge after a scan.
    /// </summary>
    public long? LastSavedHistoryId { get; private set; }

    public async Task<ScanResult?> ScanDirectoryStreamingAsync(
        string path,
        DepthMode depthMode = DepthMode.Default,
        int maxDepth = 5,
        bool includeHidden = false,
        IProgress<StreamProgress>? onProgress = null,
        CancellationToken ct = default,
        bool? useGpu = null,
        bool? useCache = null,
        bool saveToHistory = false)
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
        if (useCache ?? UseFileCache)
            argList.Add("--cache");
        // Bound the directory/file breakdown the CLI returns. The CLI now caps
        // top_directories/largest_files to --top; the GUI wants a generous slice
        // for its treemap/largest-files views, not the CLI's 20-item default.
        argList.Add("--top");
        argList.Add("250");

        if (saveToHistory)
            argList.Add("--save-history");
        LastSavedHistoryId = null;

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

        // Drain stderr concurrently with stdout. ReadStderrAsync returns the
        // full captured text (not just void), so a failed scan can report the
        // real backend error instead of an empty message.
        var stderrTask = ReadStderrAsync(process.StandardError, ct);

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
                        else if (eventType == "saved")
                        {
                            if (root.TryGetProperty("id", out var idProp) && idProp.TryGetInt64(out var savedId))
                            {
                                LastSavedHistoryId = savedId;
                            }
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
            // stderr was already fully drained by the concurrent ReadStderrAsync
            // task above; reuse its captured text rather than re-reading the
            // (now exhausted) stream, which would return an empty string.
            var stderr = await stderrTask;
            throw new Exception($"Scanner failed (exit {process.ExitCode}): {stderr}");
        }

        return finalResult;
    }

    private static async Task<string> ReadStderrAsync(
        System.IO.StreamReader stderr,
        CancellationToken ct)
    {
        try
        {
            var sb = new System.Text.StringBuilder();
            while (await stderr.ReadLineAsync(ct) is { } line)
            {
                sb.AppendLine(line);
                if (ct.IsCancellationRequested)
                    break;
            }
            return sb.ToString();
        }
        catch
        {
            // Ignore - stderr is not parsed in streaming mode
            return string.Empty;
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
}
