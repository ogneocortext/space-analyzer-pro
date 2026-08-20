// Licensed under the MIT License.
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using Xunit;
using Xunit.Abstractions;

namespace SpaceAnalyzer.Tests;

/// <summary>
/// Interactive probe for the agentic tool-progress streaming. Calls the REAL
/// scanner streaming path (the exact method <c>run_scan</c> uses) and the REAL
/// <c>search --progress-json</c> CLI (the exact path <c>search_files</c> uses),
/// rendering the bubble text with the EXACT formatting/throttle logic from
/// AIAssistantViewModel.Chat.cs, so we can observe cadence, formatting, and gaps
/// in practice. Set PROBE_PATH to a directory to scan; defaults to the repo.
/// </summary>
public class StreamingProbeTests
{
    private readonly ITestOutputHelper _output;

    public StreamingProbeTests(ITestOutputHelper output)
    {
        _output = output;
    }

    private static string CliPath =>
        Environment.GetEnvironmentVariable("SPACE_ANALYZER_SCANNER")
        ?? Path.Combine(RepoRoot, "target", "release", "space-analyzer-cli.exe");

    private static string RepoRoot =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".."));

    /// <summary>Verbatim copy of the VM's bubble progress text (post name-dedupe).</summary>
    private static string RenderBubble(string fn, StreamProgress p)
    {
        var bare = p.Percentage > 0
            ? $"— {p.Percentage:0}% · {p.FilesScanned:N0} files…"
            : p.FilesScanned > 0
                ? $"— {p.FilesScanned:N0} files…"
                : "— …";
        return $"[{fn}] Running {bare}";
    }

    [Fact]
    public async Task Probe_RunScanToolProgressStreaming()
    {
        var cli = CliPath;
        var scanPath = Environment.GetEnvironmentVariable("PROBE_PATH") ?? RepoRoot;
        if (!File.Exists(cli) || !Directory.Exists(scanPath))
        {
            _output.WriteLine($"SKIP: CLI not found ({cli}) or path missing ({scanPath}). Build the CLI and set SPACE_ANALYZER_SCANNER/PROBE_PATH to run this probe.");
            return;
        }

        var scanner = new ScannerService(cli);
        var fnName = "run_scan";
        var totalEvents = 0;
        var accepted = 0;
        var firstProgress = true;
        var throttle = Stopwatch.StartNew();
        var scanStart = Stopwatch.StartNew();
        double? lastAcceptedMs = null;
        double minInt = double.MaxValue, maxInt = 0;

        void Log(string s) { _output.WriteLine(s); Console.WriteLine(s); }

        Log($"ToolBubble seed: [{fnName}] Running…");
        Log("--- run_scan progress stream (200ms throttle, verbatim VM formatting) ---");

        var progress = new Progress<StreamProgress>(p =>
        {
            totalEvents++;
            if (!firstProgress && throttle.ElapsedMilliseconds < 200) return; // verbatim throttle
            firstProgress = false;
            throttle.Restart();

            var now = scanStart.Elapsed.TotalMilliseconds;
            if (lastAcceptedMs.HasValue)
            {
                minInt = Math.Min(minInt, now - lastAcceptedMs.Value);
                maxInt = Math.Max(maxInt, now - lastAcceptedMs.Value);
            }
            lastAcceptedMs = now;
            accepted++;
            Log($"  +{now:0}ms  {RenderBubble(fnName, p)}");
        });

        var result = await scanner.ScanDirectoryStreamingAsync(scanPath, ScannerService.DepthMode.Default, onProgress: progress, ct: CancellationToken.None);

        Log("--- summary ---");
        Log($"  total events: {totalEvents}, accepted (post-throttle): {accepted}");
        if (accepted > 1) Log($"  update interval: min {minInt:0}ms / max {maxInt:0}ms");
        Log($"  result: {result?.TotalFiles:N0} files, {result?.TotalDirs:N0} dirs, {result?.TotalSizeBytes / (1024.0 * 1024 * 1024):0.00} GB");
        Assert.NotNull(result);
    }

    [Fact]
    public async Task Probe_SearchToolProgressStreaming()
    {
        var cli = CliPath;
        var scanPath = Environment.GetEnvironmentVariable("PROBE_PATH") ?? RepoRoot;
        if (!File.Exists(cli) || !Directory.Exists(scanPath))
        {
            _output.WriteLine($"SKIP: CLI not found ({cli}) or path missing ({scanPath}). Build the CLI and set SPACE_ANALYZER_SCANNER/PROBE_PATH to run this probe.");
            return;
        }

        var fnName = "search_files";
        var totalEvents = 0;
        var accepted = 0;
        var firstProgress = true;
        var throttle = Stopwatch.StartNew();
        var scanStart = Stopwatch.StartNew();
        double? lastAcceptedMs = null;
        double minInt = double.MaxValue, maxInt = 0;

        void Log(string s) { _output.WriteLine(s); Console.WriteLine(s); }

        Log($"ToolBubble seed: [{fnName}] Running…");
        Log("--- search_files progress stream (real `search --progress-json`, 200ms throttle) ---");

        var psi = new ProcessStartInfo
        {
            FileName = cli,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add("search");
        psi.ArgumentList.Add("--path"); psi.ArgumentList.Add(scanPath);
        psi.ArgumentList.Add("--extension"); psi.ArgumentList.Add("rs");
        psi.ArgumentList.Add("--progress-json");
        psi.ArgumentList.Add("--format"); psi.ArgumentList.Add("json");
        psi.ArgumentList.Add("--limit"); psi.ArgumentList.Add("5");

        using var process = new Process { StartInfo = psi };
        process.Start();

        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        // Mirror ToolExecutor.Helpers.RunCliAsync: drain stderr, parse __PROGRESS__.
        var stderrTask = Task.Run(async () =>
        {
            var sb = new System.Text.StringBuilder();
            string? line;
            while ((line = await process.StandardError.ReadLineAsync()) is not null)
            {
                sb.AppendLine(line);
                if (line.StartsWith("__PROGRESS__"))
                {
                    var json = line["__PROGRESS__".Length..];
                    try
                    {
                        var sp = System.Text.Json.JsonSerializer.Deserialize<StreamProgress>(json);
                        if (sp is null) continue;
                        totalEvents++;
                        if (!firstProgress && throttle.ElapsedMilliseconds < 200) continue; // verbatim throttle
                        firstProgress = false;
                        throttle.Restart();
                        var now = scanStart.Elapsed.TotalMilliseconds;
                        if (lastAcceptedMs.HasValue)
                        {
                            minInt = Math.Min(minInt, now - lastAcceptedMs.Value);
                            maxInt = Math.Max(maxInt, now - lastAcceptedMs.Value);
                        }
                        lastAcceptedMs = now;
                        accepted++;
                        Log($"  +{now:0}ms  {RenderBubble(fnName, sp)}");
                    }
                    catch { /* ignore malformed */ }
                }
            }
            return sb.ToString();
        });

        await process.WaitForExitAsync();
        _ = await stdoutTask;
        _ = await stderrTask;

        Log("--- summary ---");
        Log($"  total events: {totalEvents}, accepted (post-throttle): {accepted}");
        if (accepted > 1) Log($"  update interval: min {minInt:0}ms / max {maxInt:0}ms");
        Log($"  search exit code: {process.ExitCode}");
        Assert.Equal(0, process.ExitCode);
    }
}
