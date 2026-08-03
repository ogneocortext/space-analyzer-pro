// Licensed under the MIT License.

using System;
using System.IO;
using System.Threading;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Simple file logger for diagnosing runtime UI and navigation issues.
/// Thread-safe: uses <see cref="Interlocked.Increment"/> for sequence numbering
/// and a <see cref="StreamWriter"/> with explicit flushing for concurrent writes.
/// </summary>
public static class AppLog
{
    private static readonly string LogPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SpaceAnalyzer",
        "ui-actions.log");

    private static int _sequence;
    private static readonly StreamWriter? s_writer;

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
        try
        {
            var seq = Interlocked.Increment(ref _sequence);
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{seq}] [{category}] {message}";
            s_writer?. WriteLine(line);
        }
        catch { /* swallow logging failures */ }
    }

    public static void Nav(string message) => Write("NAV", message);
    public static void Page(string message) => Write("PAGE", message);
    public static void Action(string message) => Write("ACTION", message);
    public static void Error(string message) => Write("ERROR", message);
    public static void Error(string message, Exception ex) => Write("ERROR", $"{message} | {ex.GetType().Name}: {ex.Message}");
}
