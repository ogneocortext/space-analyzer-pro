// Licensed under the MIT License.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ToolExecutor
{
    private static string NormalizePath(string path)
        => path.Trim().TrimEnd('\\').TrimEnd('/').ToUpperInvariant();

    /// <summary>
    /// Resolves the directory to operate on for scan-backed tools. Priority:
    /// explicit tool argument &gt; path mentioned in the user's message &gt; the most
    /// recently scanned directory (previous fallback).
    /// </summary>
    private async Task<string> ResolveScanPathAsync(
        Dictionary<string, object> args,
        CancellationToken ct)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path))
            path = ExtractDirectoryPath(_userMessage) ?? string.Empty;

        if (string.IsNullOrWhiteSpace(path))
        {
            var (latest, _) = await _scanner.GetScanHistoryPageAsync(limit: 1, ct: ct);
            if (latest.Count > 0)
                path = latest[0].Path;
        }

        return path;
    }

    /// <summary>
    /// Tries to find a directory the user is targeting in their message text.
    /// Handles quoted/backticked paths first, then drive-letter paths with
    /// spaces, validating each candidate against the filesystem. Returns an
    /// existing directory (or the parent of an existing file), else null.
    /// </summary>
    private static string? ExtractDirectoryPath(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // Quoted/backticked paths first (e.g. "C:\Some Folder" or `C:\Some Folder`).
        foreach (var quote in new[] { '"', '`' })
        {
            var pattern = quote + "([^\r\n" + quote + "]+)" + quote;
            foreach (Match m in Regex.Matches(text, pattern))
            {
                var path = m.Groups[1].Value.Trim();
                if (IsExistingDirectory(path))
                    return path;
            }
        }

        // Drive-letter anchors (C:\ ...). Starting at each anchor, grow the candidate
        // from the end of the message inward, dropping trailing prose one word at a
        // time until the remaining text resolves to a real directory.
        foreach (Match anchor in Regex.Matches(text, "[A-Za-z]:\\\\"))
        {
            var candidate = text[anchor.Index..].Trim();
            while (candidate.Length > 3)
            {
                if (IsExistingDirectory(candidate))
                    return candidate;

                var boundary = -1;
                for (int i = candidate.Length - 1; i >= 0; i--)
                {
                    if (char.IsWhiteSpace(candidate[i]) || candidate[i] == ',')
                    {
                        boundary = i;
                        break;
                    }
                }
                if (boundary <= 0)
                    break;
                candidate = candidate[..boundary].TrimEnd('\\').Trim();
            }
        }

        // UNC share anchors (\\server\share ...). Network paths have no drive
        // letter, so the drive-letter regex above never matches them. Uses the
        // same candidate-growth logic to strip trailing prose word by word.
        foreach (Match anchor in Regex.Matches(text, @"\\\\"))
        {
            var candidate = text[anchor.Index..].Trim();
            while (candidate.Length > 3)
            {
                if (IsExistingDirectory(candidate))
                    return candidate;

                var boundary = -1;
                for (int i = candidate.Length - 1; i >= 0; i--)
                {
                    if (char.IsWhiteSpace(candidate[i]) || candidate[i] == ',')
                    {
                        boundary = i;
                        break;
                    }
                }
                if (boundary <= 0)
                    break;
                candidate = candidate[..boundary].TrimEnd('\\').Trim();
            }
        }

        return null;
    }

    private static bool IsExistingDirectory(string path)
    {
        if (Directory.Exists(path))
            return true;
        if (File.Exists(path))
            return Directory.GetParent(path)?.FullName is { } parent && Directory.Exists(parent);
        return false;
    }

    private async Task<string> RunCliAsync(IEnumerable<string> args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _scanner.ScannerPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        using var process = new Process { StartInfo = psi };
        process.Start();

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            return ct.IsCancellationRequested
                ? "Operation was cancelled by the user."
                : "Operation timed out after 2 minutes.";
        }

        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);

        if (process.ExitCode != 0)
        {
            var detail = string.IsNullOrWhiteSpace(stderr) ? string.IsNullOrWhiteSpace(stdout) ? "No details available." : stdout : stderr;
            return $"Error (exit {process.ExitCode}): {detail}";
        }

        return stdout;
    }

    private static string GetString(Dictionary<string, object> args, string key)
    {
        if (!args.TryGetValue(key, out var v))
            return string.Empty;
        if (v is JsonElement je)
            return JsonElementToString(je);
        return v?.ToString() ?? string.Empty;
    }

    private static string? GetOptionalString(Dictionary<string, object> args, string key)
    {
        if (!args.TryGetValue(key, out var v))
            return null;
        if (v is JsonElement je)
            return JsonElementToString(je);
        return v?.ToString();
    }

    /// <summary>
    /// Returns a JsonElement's value as a plain string. String kinds return their text;
    /// numbers/booleans are coerced to their textual form (e.g. "100", "true") instead of
    /// the raw JSON token, so downstream string consumers never receive a JSON literal
    /// like <c>123</c> or <c>true</c> that they would then mishandle.
    /// </summary>
    private static string JsonElementToString(JsonElement je)
    {
        return je.ValueKind switch
        {
            JsonValueKind.String => je.GetString() ?? string.Empty,
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Number => je.GetRawText(),
            _ => je.GetRawText(),
        };
    }

    private static int GetInt(Dictionary<string, object> args, string key, int defaultValue)
    {
        if (!args.TryGetValue(key, out var v))
            return defaultValue;

        if (v is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.Number)
            {
                // Use Int64 instead of Int32 to avoid InvalidOperationException on
                // numbers larger than int.MaxValue (e.g. min_size_mb=999999),
                // clamping the result back into the int range.
                if (je.TryGetInt64(out var longVal))
                    return (int)Math.Clamp(longVal, int.MinValue, int.MaxValue);
                return (int)Math.Round(je.GetDouble());
            }
            return long.TryParse(je.GetRawText(), out var n)
                ? (int)Math.Clamp(n, int.MinValue, int.MaxValue)
                : defaultValue;
        }
        if (v is int i) return i;
        if (v is long l) return (int)Math.Clamp(l, int.MinValue, int.MaxValue);
        if (v is double d) return (int)d;
        return int.TryParse(v.ToString(), out var parsed) ? parsed : defaultValue;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _scanner?.Dispose();
    }
}
