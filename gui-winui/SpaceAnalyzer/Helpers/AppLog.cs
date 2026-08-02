// Licensed under the MIT License.

using System;
using System.IO;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Simple file logger for diagnosing runtime UI and navigation issues.
/// </summary>
public static class AppLog
{
    private static readonly string LogPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SpaceAnalyzer",
        "ui-actions.log");

    private static int _sequence;

    static AppLog()
    {
        try
        {
            var dir = Path.GetDirectoryName(LogPath);
            if (dir != null && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);
        }
        catch { /* no-op */ }
    }

    public static void Write(string category, string message)
    {
        try
        {
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{++_sequence}] [{category}] {message}";
            File.AppendAllText(LogPath, line + Environment.NewLine);
        }
        catch { /* swallow logging failures */ }
    }

    public static void Nav(string message) => Write("NAV", message);
    public static void Page(string message) => Write("PAGE", message);
    public static void Action(string message) => Write("ACTION", message);
    public static void Error(string message) => Write("ERROR", message);
    public static void Error(string message, Exception ex) => Write("ERROR", $"{message} | {ex.GetType().Name}: {ex.Message}");
}
