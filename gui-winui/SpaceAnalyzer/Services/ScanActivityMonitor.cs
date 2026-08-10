// Licensed under the MIT License.

using System;

namespace SpaceAnalyzer.Services;

/// <summary>
/// App-wide tracker for whether the file scanner (scan / dedup / node_modules
/// cleanup) is currently running. A single shared instance lets the Dashboard
/// correlate live system-resource samples with scanner activity even when the
/// scan was launched from another page or by the AI assistant.
///
/// Entry points (ScannerService) call <see cref="BeginScan"/> to obtain a token
/// and <see cref="EndScan"/> with that token when finished, so overlapping or
/// mismatched calls cannot leave the monitor stuck "scanning".
/// </summary>
public sealed class ScanActivityMonitor
{
    private static readonly ScanActivityMonitor s_instance = new();
    public static ScanActivityMonitor Instance => s_instance;

    private readonly object _lock = new();
    private readonly System.Collections.Generic.HashSet<int> _active = new();
    private int _nextId = 1;
    private string? _currentPath;
    private DateTimeOffset _lastStart = DateTimeOffset.MinValue;

    /// <summary>True while at least one scan window is open.</summary>
    public bool IsScanning
    {
        get { lock (_lock) return _active.Count > 0; }
    }

    /// <summary>The path of the most recently started active scan, if any.</summary>
    public string? CurrentPath
    {
        get { lock (_lock) return _currentPath; }
    }

    /// <summary>When the most recently started active scan began, if any.</summary>
    public DateTimeOffset? StartedAt
    {
        get { lock (_lock) return _active.Count > 0 ? _lastStart : null; }
    }

    /// <summary>Raised whenever the scanning state changes (cross-thread safe to subscribe).</summary>
    public event EventHandler? StateChanged;

    /// <summary>
    /// Open a scan window. Returns a token that must be passed to <see cref="EndScan"/>.
    /// </summary>
    public int BeginScan(string? path)
    {
        int id;
        lock (_lock)
        {
            id = _nextId++;
            _active.Add(id);
            _currentPath = path;
            _lastStart = DateTimeOffset.Now;
        }
        StateChanged?.Invoke(this, EventArgs.Empty);
        return id;
    }

    /// <summary>Close the scan window identified by <paramref name="id"/>.</summary>
    public void EndScan(int id)
    {
        bool changed;
        lock (_lock)
        {
            changed = _active.Remove(id);
            if (_active.Count == 0)
                _currentPath = null;
        }
        if (changed)
            StateChanged?.Invoke(this, EventArgs.Empty);
    }
}
