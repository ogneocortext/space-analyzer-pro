// Licensed under the MIT License.

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Simple file logger for diagnosing runtime UI and navigation issues.
/// Improvements over the original:
///  - Thread-safe writes (lock) so concurrent UI/IO/log timers can't interleave.
///  - Full exception detail (type, message, XAML line info, stack, inner chain)
///    via <see cref="Exception"/> / the <c>Error(string, Exception)</c> overload.
///  - A bounded in-memory ring buffer (<see cref="Recent"/>) for cheap live inspection.
///  - Automatic rotation so the log can't grow without bound.
/// </summary>
public static class AppLog
{
    private static readonly string LogPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SpaceAnalyzer",
        "ui-actions.log");

    private static readonly object s_lock = new();
    private static StreamWriter? s_writer;
    private static readonly int _maxBytes = 1 << 20; // 1 MB
    private static readonly int _ringCapacity = 400;
    private static readonly ConcurrentQueue<string> s_ring = new();
    private static int _sequence;

    static AppLog()
    {
        try
        {
            var dir = Path.GetDirectoryName(LogPath);
            if (dir != null && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);
            s_writer = new StreamWriter(LogPath, append: true) { AutoFlush = true };
        }
        catch { /* no-op */ }
    }

    public static void Write(string category, string message)
    {
        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{Interlocked.Increment(ref _sequence)}] [{category}] {message}";
        s_ring.Enqueue(line);
        while (s_ring.Count > _ringCapacity)
            s_ring.TryDequeue(out _);

        try
        {
            lock (s_lock)
            {
                RotateIfNeeded();
                s_writer?.WriteLine(line);
            }
        }
        catch { /* swallow logging failures */ }
    }

    public static void Nav(string message) => Write("NAV", message);
    public static void Page(string message) => Write("PAGE", message);
    public static void Action(string message) => Write("ACTION", message);
    public static void Error(string message) => Write("ERROR", message);

    /// <summary>Logs only the message; for full stack traces use <see cref="Exception(Exception, string)"/>.</summary>
    public static void Error(string message, Exception ex) => Exception(ex, message);

    /// <summary>Logs the full exception: type, message, XAML line info, stack trace and inner chain.</summary>
    public static void Exception(Exception ex, string? context = null)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrEmpty(context))
            sb.AppendLine(context);
        AppendException(sb, ex, 0);
        Write("ERROR", sb.ToString().TrimEnd());
    }

    private static void AppendException(StringBuilder sb, Exception ex, int depth)
    {
        var indent = new string(' ', depth * 2);
        sb.AppendLine($"{indent}{ex.GetType().FullName}: {ex.Message}");
        if (!string.IsNullOrEmpty(ex.StackTrace))
            sb.AppendLine($"{indent}  Stack: {ex.StackTrace.Replace("\n", "\n" + indent + "    ")}");
        if (ex.InnerException is { } inner)
        {
            sb.AppendLine($"{indent}Inner:");
            AppendException(sb, inner, depth + 1);
        }
    }

    /// <summary>Returns the most recent <paramref name="n"/> log lines (newest last).</summary>
    public static IReadOnlyList<string> Recent(int n = 100)
        => s_ring.TakeLast(Math.Max(1, Math.Min(n, _ringCapacity))).ToArray();

    private static void RotateIfNeeded()
    {
        try
        {
            var fi = new FileInfo(LogPath);
            if (!fi.Exists || fi.Length <= _maxBytes)
                return;
            s_writer?.Flush();
            s_writer?.Dispose();
            var backup = LogPath + ".1";
            if (File.Exists(backup))
                File.Delete(backup);
            File.Move(LogPath, backup);
            s_writer = new StreamWriter(LogPath, append: true) { AutoFlush = true };
            Write("NAV", "Log rotated (previous session archived to ui-actions.log.1)");
        }
        catch { /* keep going with whatever writer we have */ }
    }
}
