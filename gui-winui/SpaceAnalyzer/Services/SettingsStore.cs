// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Windows.Storage;

namespace SpaceAnalyzer.Services;

/// <summary>
/// Central settings store that persists to the embedded SQLite database
/// via the Rust CLI and mirrors to <see cref="ApplicationData"/> local
/// settings as a fast synchronous cache. On startup the DB is the
/// authoritative source; LocalSettings is the fallback and the write-back
/// cache.
/// </summary>
public static class SettingsStore
{
    private static readonly Dictionary<string, string> s_values = new();
    private static bool s_loaded;
    private static readonly object s_lock = new();
    private static DispatcherQueueTimer? s_saveTimer;
    private static CancellationTokenSource? s_saveCts;

    /// <summary>
    /// Ensures the in-memory cache is populated. Loads from the DB
    /// (<c>settings get --format json</c>), falling back to
    /// <see cref="ApplicationData"/> local settings, then defaults.
    /// Safe to call multiple times; only the first call does I/O.
    /// </summary>
    public static async Task EnsureLoadedAsync()
    {
        if (s_loaded)
            return;
        await Task.Run(async () =>
        {
            lock (s_lock)
            {
                if (s_loaded)
                    return;
            }
            var scanner = new ScannerService();
            var dbValues = await scanner.GetSettingsAsync();
            lock (s_lock)
            {
                if (dbValues.Count > 0)
                {
                    foreach (var kvp in dbValues)
                        s_values[kvp.Key] = kvp.Value;
                }
                else
                {
                    MigrateFromLocalSettings();
                }
                s_loaded = true;
            }
        });
    }

    /// <summary>
    /// Reads a setting value from the in-memory cache.
    /// </summary>
    public static string? Get(string key)
    {
        lock (s_lock)
        {
            return s_values.TryGetValue(key, out var v) ? v : null;
        }
    }

    /// <summary>
    /// Writes a setting into the in-memory cache, mirrors it to
    /// <see cref="ApplicationData"/> local settings synchronously, and
    /// schedules a debounced DB persist.
    /// </summary>
    public static void Set(string key, string value)
    {
        lock (s_lock)
        {
            s_values[key] = value;
        }
        MirrorToLocalSettings(key, value);
        ScheduleDbSave();
    }

    /// <summary>
    /// Forces an immediate flush of all cached settings to the DB.
    /// Call on app shutdown to avoid losing the last few seconds of edits.
    /// </summary>
    public static async Task FlushAsync()
    {
        s_saveCts?.Cancel();
        s_saveTimer?.Stop();
        var scanner = new ScannerService();
        Dictionary<string, string> snapshot;
        lock (s_lock)
        {
            snapshot = new Dictionary<string, string>(s_values);
        }
        await scanner.SetSettingsAsync(snapshot);
    }

    private static void MigrateFromLocalSettings()
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer("SpaceAnalyzer.Settings", ApplicationDataCreateDisposition.Always);
            foreach (var kvp in container.Values)
            {
                if (kvp.Value is string v && !string.IsNullOrEmpty(v))
                    s_values[kvp.Key] = v;
            }
        }
        catch { /* non-fatal */ }
    }

    private static void MirrorToLocalSettings(string key, string value)
    {
        try
        {
            var container = ApplicationData.Current.LocalSettings
                .CreateContainer("SpaceAnalyzer.Settings", ApplicationDataCreateDisposition.Always);
            container.Values[key] = value;
        }
        catch { /* non-fatal */ }
    }

    private static void ScheduleDbSave()
    {
        // The Tick handler is attached exactly once when the timer is first created;
        // re-arming only restarts the debounce interval. Attaching inside this method
        // (the previous behavior) stacked a new handler on every Set() call on the
        // reused timer, so N edits spawned N handlers that each flushed on one tick.
        if (s_saveTimer is null)
        {
            var dq = DispatcherQueue.GetForCurrentThread();
            s_saveTimer = dq?.CreateTimer();
            if (s_saveTimer is null)
                return; // No dispatcher on this thread — skip debounced persist.
            s_saveTimer.Tick += OnSaveTimerTick;
        }

        // (Re)arm the debounce with a fresh cancellation token for this edit.
        s_saveCts?.Cancel();
        s_saveCts = new CancellationTokenSource();

        s_saveTimer.Stop();
        s_saveTimer.Interval = TimeSpan.FromMilliseconds(500);
        s_saveTimer.Start();
    }

    private static async void OnSaveTimerTick(object? sender, object e)
    {
        s_saveTimer?.Stop();
        var ct = s_saveCts?.Token ?? CancellationToken.None;
        await FlushCore(ct);
    }

    private static async Task FlushCore(CancellationToken ct)
    {
        try
        {
            var scanner = new ScannerService();
            Dictionary<string, string> snapshot;
            lock (s_lock)
            {
                snapshot = new Dictionary<string, string>(s_values);
            }
            await scanner.SetSettingsAsync(snapshot, ct);
        }
        catch (OperationCanceledException)
        {
            // Debounce cancelled — ignore.
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SettingsStore] Flush failed: {ex.Message}");
        }
    }
}