// Licensed under the MIT License.

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using Microsoft.Data.Sqlite;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Lightweight, fault-tolerant application logger.
///
/// Sinks:
///  - An in-memory ring buffer (<see cref="Recent"/> / <see cref="RecentErrors"/>) for
///    cheap live inspection.
///  - A rotated plain-text file (ui-actions.log) as the durable primary record.
///  - An optional SQLite store (app-events.db) holding structured WARN+ events so
///    crashes/errors are queryable across sessions (see <see cref="QueryEvents"/>).
///
/// All public methods swallow their own failures: logging must never throw into a
/// caller that is itself reporting an error.
/// </summary>
public static class AppLog
{
    public enum Level
    {
        Trace = 0,
        Debug = 1,
        Info = 2,
        Warn = 3,
        Error = 4,
        Fatal = 5,
    }

    public sealed record AppEvent(long Id, DateTime TimestampUtc, Level Level, string Category, string Message, string? ExceptionText);

    private static readonly string LogDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SpaceAnalyzer");
    private static readonly string LogPath = Path.Combine(LogDir, "ui-actions.log");
    private static readonly string DbPath = Path.Combine(LogDir, "app-events.db");

    private static readonly object s_fileLock = new();
    private static StreamWriter? s_writer;
    private static long _currentBytes;

    private static readonly int _maxBytes = 1 << 20; // 1 MB
    private static readonly int _ringCapacity = 400;
    private static readonly ConcurrentQueue<string> s_ring = new();
    private static int _sequence;

    // Minimum level persisted to the file/ring. The DB sink has its own threshold (Warn).
    public static Level MinimumLevel { get; set; } = Level.Info;

    #region File sink init
    static AppLog()
    {
        try
        {
            if (!Directory.Exists(LogDir))
                Directory.CreateDirectory(LogDir);
            s_writer = new StreamWriter(LogPath, append: true) { AutoFlush = true };
            try { _currentBytes = new FileInfo(LogPath).Length; } catch { _currentBytes = 0; }
            // Emit a session-start marker (bypassing the ring) so every process
            // start is visible in the durable file even when the app crashes before
            // App.Boot() runs on the UI thread.
            try { EmitLocked($"{NowStamp()} [0] [BOOT] session start pid={Environment.ProcessId}"); } catch { }
        }
        catch { s_writer = null; }
    }
    #endregion

    #region Public API
    public static void Write(Level level, string category, string message, string? exceptionText = null)
    {
        if (level < MinimumLevel) return;
        var line = $"{NowStamp()} [{Interlocked.Increment(ref _sequence)}] [{LevelToken(level)}] [{category}] {message}";
        s_ring.Enqueue(line);
        while (s_ring.Count > _ringCapacity)
            s_ring.TryDequeue(out _);
        try
        {
            lock (s_fileLock)
            {
                EmitLocked(line);
            }
        }
        catch { /* swallow logging failures */ }

        // DB sink: persist WARN+ structured events for queryable crash analytics.
        if (level >= Level.Warn)
            AppendToDb(level, category, message, exceptionText);
    }

    // Backward-compatible overload kept so any direct string-category callers still compile.
    public static void Write(string category, string message) => Write(Level.Info, category, message);

    public static void Nav(string message) => Write(Level.Info, "NAV", message);
    public static void Page(string message) => Write(Level.Info, "PAGE", message);
    public static void Action(string message) => Write(Level.Info, "ACTION", message);
    public static void Warn(string category, string message) => Write(Level.Warn, category, message);

    /// <summary>Marks the start of a process in the log (once per launch).</summary>
    public static void Boot(string message) => Write(Level.Info, "BOOT", message);

    /// <summary>Flushes the file sink so the most recent line is durable before the
    /// process exits or immediately after a FATAL (managed handlers run, but a
    /// native crash still would not flush — hence the session-start marker below).</summary>
    public static void Flush()
    {
        try { lock (s_fileLock) { s_writer?.Flush(); } } catch { /* swallow */ }
    }

    /// <summary>Logs a final line and releases the file handle. Called on process
    /// exit / window close. Its ABSENCE (paired with a last NAV line) is the signal
    /// that the process died abnormally (native crash) rather than shutting down.</summary>
    public static void Shutdown(string? reason = null)
    {
        try { Write(Level.Info, "EXIT", reason ?? "application shutting down"); } catch { /* swallow */ }
        try { lock (s_fileLock) { s_writer?.Flush(); s_writer?.Dispose(); s_writer = null; } } catch { /* swallow */ }
    }

    public static void Error(string message) => Write(Level.Error, "ERROR", message);

    /// <summary>Logs only the message; for full stack traces use <see cref="Exception(Exception, string)"/>.</summary>
    public static void Error(string message, Exception ex) => Exception(ex, message);

    /// <summary>Logs the full exception at ERROR level: type, message, XAML line info, stack and inner chain.</summary>
    public static void Exception(Exception ex, string? context = null) => LogException(Level.Error, ex, context);

    /// <summary>Logs the full exception at FATAL level (process- or session-ending failures).</summary>
    public static void Fatal(Exception ex, string? context = null) => LogException(Level.Fatal, ex, context);

    /// <summary>Returns the most recent <paramref name="n"/> log lines (newest last).</summary>
    public static IReadOnlyList<string> Recent(int n = 100)
        => s_ring.TakeLast(Math.Max(1, Math.Min(n, _ringCapacity))).ToArray();

    /// <summary>Returns the most recent WARN/ERROR/FATAL lines (newest last) from the ring buffer.</summary>
    public static IReadOnlyList<string> RecentErrors(int n = 100)
        => s_ring
            .Where(l => l.Contains("[WARN]") || l.Contains("[ERROR]") || l.Contains("[FATAL]"))
            .TakeLast(Math.Max(1, Math.Min(n, _ringCapacity)))
            .ToArray();

    /// <summary>
    /// Returns structured events persisted to the SQLite store, newest first.
    /// Useful for crash triage across sessions (e.g. every FATAL/ERROR entry).
    /// Returns an empty list if the DB sink is disabled or unavailable.
    /// </summary>
    public static IReadOnlyList<AppEvent> QueryEvents(Level? minLevel = null, DateTime? sinceUtc = null, int limit = 200)
    {
        var result = new List<AppEvent>();
        if (!s_dbEnabled) return result;
        try
        {
            lock (s_dbLock)
            {
                var conn = EnsureDb();
                if (conn == null) return result;
                using var cmd = conn.CreateCommand();
                var clauses = new List<string>();
                if (minLevel is { } ml) clauses.Add($"level_ord >= {(int)ml}");
                if (sinceUtc is { } s) clauses.Add("timestamp >= @since");
                cmd.CommandText = "SELECT id, timestamp, level, category, message, exception_text FROM app_events"
                    + (clauses.Count > 0 ? " WHERE " + string.Join(" AND ", clauses) : string.Empty)
                    + " ORDER BY id DESC LIMIT @limit";
                if (sinceUtc is { } s2) cmd.Parameters.AddWithValue("@since", s2.ToString("o", CultureInfo.InvariantCulture));
                cmd.Parameters.AddWithValue("@limit", Math.Max(1, Math.Min(limit, 5000)));
                using var rdr = cmd.ExecuteReader();
                while (rdr.Read())
                {
                    var ts = DateTime.TryParse(rdr.GetString(1), CultureInfo.InvariantCulture,
                        DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var dt)
                        ? dt : DateTime.MinValue;
                    result.Add(new AppEvent(
                        rdr.GetInt64(0), ts,
                        Enum.TryParse<Level>(rdr.GetString(2), out var lv) ? lv : Level.Info,
                        rdr.GetString(3), rdr.GetString(4),
                        rdr.IsDBNull(5) ? null : rdr.GetString(5)));
                }
            }
        }
        catch { s_dbEnabled = false; }
        return result;
    }
    #endregion

    #region Core formatting / emission
    private static string NowStamp() => DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);

    private static string LevelToken(Level level) => level switch
    {
        Level.Trace => "TRACE",
        Level.Debug => "DEBUG",
        Level.Info => "INFO",
        Level.Warn => "WARN",
        Level.Error => "ERROR",
        Level.Fatal => "FATAL",
        _ => "INFO",
    };

    private static void EmitLocked(string line)
    {
        if (s_writer == null) return;
        if (_currentBytes > _maxBytes)
            RotateLocked();
        s_writer.WriteLine(line);
        _currentBytes += Encoding.UTF8.GetByteCount(line) + 2; // + newline
    }

    private static void RotateLocked()
    {
        try
        {
            s_writer?.Flush();
            s_writer?.Dispose();
            var backup = LogPath + ".1";
            if (File.Exists(backup)) File.Delete(backup);
            File.Move(LogPath, backup);
            s_writer = new StreamWriter(LogPath, append: true) { AutoFlush = true };
            _currentBytes = 0;
            var marker = $"{NowStamp()} [{Interlocked.Increment(ref _sequence)}] [NAV] Log rotated (previous session archived to ui-actions.log.1)";
            s_writer.WriteLine(marker);
            _currentBytes += Encoding.UTF8.GetByteCount(marker) + 2;
        }
        catch
        {
            // Keep whatever writer we have; never throw.
        }
    }

    private static void LogException(Level level, Exception ex, string? context)
    {
        var detail = FormatException(ex, context);
        var category = level == Level.Fatal ? "FATAL" : "ERROR";
        Write(level, category, detail, exceptionText: detail);
    }

    private static string FormatException(Exception ex, string? context)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrEmpty(context))
            sb.AppendLine(context);
        AppendException(sb, ex, 0);
        return sb.ToString().TrimEnd();
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
    #endregion

    #region SQLite sink (app-events.db)
    private static readonly object s_dbLock = new();
    private static SqliteConnection? s_dbConn;
    private static bool s_dbEnabled = true;

    private static SqliteConnection? EnsureDb()
    {
        if (s_dbConn is { State: ConnectionState.Open })
            return s_dbConn;
        try
        {
            var conn = new SqliteConnection($"Data Source={DbPath}");
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"CREATE TABLE IF NOT EXISTS app_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                level_ord INTEGER NOT NULL,
                category TEXT NOT NULL,
                message TEXT NOT NULL,
                exception_text TEXT
            );";
            cmd.ExecuteNonQuery();
            s_dbConn = conn;
            return conn;
        }
        catch
        {
            s_dbEnabled = false;
            return null;
        }
    }

    // Re-entrancy guard: the DB sink is invoked from the FirstChanceException handler
    // (via AppLog.Write). If a write itself throws, that first-chance would re-enter
    // this method and flood the log with the logging path's own failure. Skip re-entry
    // on the same thread so a DB failure is recorded at most once per call site.
    [ThreadStatic]
    private static bool _inDbSink;

    private static void AppendToDb(Level level, string category, string message, string? exceptionText)
    {
        if (!s_dbEnabled || _inDbSink) return;
        _inDbSink = true;
        try
        {
            lock (s_dbLock)
            {
                var conn = EnsureDb();
                if (conn == null) return;
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "INSERT INTO app_events(timestamp, level, level_ord, category, message, exception_text) "
                    + "VALUES(@ts, @lvl, @ord, @cat, @msg, @ex)";
                cmd.Parameters.AddWithValue("@ts", DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture));
                cmd.Parameters.AddWithValue("@lvl", LevelToken(level));
                cmd.Parameters.AddWithValue("@ord", (int)level);
                cmd.Parameters.AddWithValue("@cat", category);
                cmd.Parameters.AddWithValue("@msg", message);
                cmd.Parameters.AddWithValue("@ex", (object?)exceptionText ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }
        }
        catch { s_dbEnabled = false; }
        finally { _inDbSink = false; }
    }
    #endregion
}
