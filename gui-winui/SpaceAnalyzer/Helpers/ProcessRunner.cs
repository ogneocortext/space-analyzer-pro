// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Threading;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Outcome of a CLI run: the process exit code plus captured stdout/stderr.
/// Non-zero exit codes are NOT thrown — callers decide how to interpret them.
/// </summary>
public sealed record ProcessRunResult
{
    public int ExitCode { get; init; }
    public string StdOut { get; init; } = string.Empty;
    public string StdErr { get; init; } = string.Empty;
}

/// <summary>
/// Single source of truth for launching the Rust CLI and other external tools.
/// Every call site that previously hand-rolled a <see cref="ProcessStartInfo"/>
/// (redirect stdio, no shell, no window, kill-on-cancel, timeout) now routes
/// through <see cref="CreateCliStartInfo"/> + <see cref="RunAsync"/> so the
/// launch/cancel/timeout/kill semantics stay identical across the app.
/// </summary>
public static class ProcessRunner
{
    /// <summary>
    /// Builds a redirect-all, no-shell, no-window <see cref="ProcessStartInfo"/>
    /// and appends each argument via <see cref="ProcessStartInfo.ArgumentList"/>
    /// to prevent argument injection through path values.
    /// </summary>
    public static ProcessStartInfo CreateCliStartInfo(string fileName, IEnumerable<string> args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var a in args)
            psi.ArgumentList.Add(a);
        return psi;
    }

    /// <summary>
    /// Starts the process and awaits exit with a linked cancellation/timeout.
    /// On cancellation the process tree is killed; a timeout raises
    /// <see cref="TimeoutException"/>, a plain cancellation raises
    /// <see cref="OperationCanceledException"/>. When <paramref name="progress"/>
    /// is provided, stderr is drained line-by-line so <c>__PROGRESS__</c> lines
    /// can be surfaced live; otherwise it is read in one shot for error reporting.
    /// </summary>
    public static async Task<ProcessRunResult> RunAsync(
        ProcessStartInfo psi,
        CancellationToken ct,
        TimeSpan timeout,
        IProgress<StreamProgress>? progress = null)
    {
        using var process = new Process { StartInfo = psi };
        process.Start();

        var stderrTask = progress is not null
            ? ReadStderrWithProgressAsync(process.StandardError, progress, ct)
            : process.StandardError.ReadToEndAsync(ct);
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);

        using var timeoutCts = new CancellationTokenSource(timeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            if (timeoutCts.IsCancellationRequested)
                throw new TimeoutException($"Operation timed out after {timeout.TotalMinutes} minutes");
            throw;
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        return new ProcessRunResult { ExitCode = process.ExitCode, StdOut = stdout, StdErr = stderr };
    }

    /// <summary>
    /// Reads stderr line by line, parsing <c>__PROGRESS__</c>-prefixed lines into
    /// <see cref="StreamProgress"/> and reporting them via <paramref name="progress"/>.
    /// Mirrors the prior <c>ScannerService.ReadStderrWithProgressAsync</c> behavior.
    /// </summary>
    private static async Task<string> ReadStderrWithProgressAsync(
        System.IO.StreamReader stderr,
        IProgress<StreamProgress> progress,
        CancellationToken ct)
    {
        var sb = new StringBuilder();
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
                    var sp = System.Text.Json.JsonSerializer.Deserialize<StreamProgress>(json);
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
}
