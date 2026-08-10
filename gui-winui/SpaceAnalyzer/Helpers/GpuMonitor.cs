// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Reads real GPU utilization and dedicated video memory from the Windows
/// "GPU Engine" / "GPU Adapter Memory" performance counter categories.
///
/// Windows reports GPU work per engine instance (3D, Copy, VideoDecode, ...) and
/// per process, so overall utilization is the sum of every <c>engtype_3D</c>
/// instance clamped to 100%. When those counters are unavailable (no WDDM driver,
/// remote session, disabled perf counters) <see cref="IsAvailable"/> stays false
/// and the UI shows "n/a" instead of a fake 0%.
/// </summary>
public static class GpuMonitor
{
    private const string EngineCategory = "GPU Engine";
    private const string EngineCounter = "Utilization Percentage";
    private const string AdapterMemoryCategory = "GPU Adapter Memory";
    private const string DedicatedUsageCounter = "Dedicated Usage";

    /// <summary>How often the counter instance list is rebuilt. Instances come and
    /// go as processes start/stop, so a stale list slowly under-reports usage.</summary>
    private static readonly TimeSpan s_instanceRefreshInterval = TimeSpan.FromSeconds(20);

    private static readonly object s_lock = new();
    private static List<PerformanceCounter> s_engineCounters = new();
    private static List<PerformanceCounter> s_memoryCounters = new();
    private static DateTime s_lastInstanceRefresh = DateTime.MinValue;
    private static bool s_probed;
    private static bool s_available;

    /// <summary>
    /// True when the GPU Engine performance counters could be opened at least once.
    /// </summary>
    public static bool IsAvailable
    {
        get
        {
            EnsureProbed();
            return s_available;
        }
    }

    /// <summary>
    /// Current overall GPU utilization as a percentage (0-100), or <c>null</c> when
    /// GPU counters are not available on this machine.
    /// </summary>
    public static double? TryGetUsagePercent()
    {
        EnsureProbed();
        if (!s_available)
            return null;

        lock (s_lock)
        {
            RefreshInstancesIfStale();
            if (s_engineCounters.Count == 0)
                return null;

            double total = 0;
            var dead = new List<PerformanceCounter>();
            foreach (var counter in s_engineCounters)
            {
                try
                {
                    total += counter.NextValue();
                }
                catch (Exception ex)
                {
                    // The owning process exited: its instance disappears mid-read.
                    Debug.WriteLine($"[GpuMonitor] engine counter read failed: {ex.Message}");
                    dead.Add(counter);
                }
            }

            foreach (var counter in dead)
            {
                s_engineCounters.Remove(counter);
                try { counter.Dispose(); } catch { }
            }

            return Math.Clamp(total, 0, 100);
        }
    }

    /// <summary>
    /// Dedicated video memory currently in use, in bytes, or <c>null</c> when the
    /// "GPU Adapter Memory" counters are unavailable.
    /// </summary>
    public static ulong? TryGetDedicatedMemoryBytes()
    {
        EnsureProbed();

        lock (s_lock)
        {
            RefreshInstancesIfStale();
            if (s_memoryCounters.Count == 0)
                return null;

            double total = 0;
            var dead = new List<PerformanceCounter>();
            foreach (var counter in s_memoryCounters)
            {
                try
                {
                    total += counter.NextValue();
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[GpuMonitor] memory counter read failed: {ex.Message}");
                    dead.Add(counter);
                }
            }

            foreach (var counter in dead)
            {
                s_memoryCounters.Remove(counter);
                try { counter.Dispose(); } catch { }
            }

            return total <= 0 ? null : (ulong)total;
        }
    }

    /// <summary>
    /// Best-effort adapter name read from the display-adapter class registry key.
    /// Returns <c>null</c> when it cannot be determined.
    /// </summary>
    public static string? TryGetAdapterName()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000");
            return key?.GetValue("DriverDesc") as string;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[GpuMonitor] adapter name lookup failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Releases every cached performance counter. Call on app shutdown.
    /// </summary>
    public static void Reset()
    {
        lock (s_lock)
        {
            foreach (var c in s_engineCounters) { try { c.Dispose(); } catch { } }
            foreach (var c in s_memoryCounters) { try { c.Dispose(); } catch { } }
            s_engineCounters = new List<PerformanceCounter>();
            s_memoryCounters = new List<PerformanceCounter>();
            s_lastInstanceRefresh = DateTime.MinValue;
            s_probed = false;
            s_available = false;
        }
    }

    private static void EnsureProbed()
    {
        lock (s_lock)
        {
            if (s_probed)
                return;
            s_probed = true;
            try
            {
                s_available = PerformanceCounterCategory.Exists(EngineCategory);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[GpuMonitor] category probe failed: {ex.Message}");
                s_available = false;
            }
            if (s_available)
                RefreshInstances();
        }
    }

    private static void RefreshInstancesIfStale()
    {
        if (DateTime.UtcNow - s_lastInstanceRefresh < s_instanceRefreshInterval)
            return;
        RefreshInstances();
    }

    /// <summary>
    /// Rebuilds the counter list from the current instance names. Must be called
    /// under <see cref="s_lock"/>.
    /// </summary>
    private static void RefreshInstances()
    {
        s_lastInstanceRefresh = DateTime.UtcNow;

        foreach (var c in s_engineCounters) { try { c.Dispose(); } catch { } }
        foreach (var c in s_memoryCounters) { try { c.Dispose(); } catch { } }
        s_engineCounters = new List<PerformanceCounter>();
        s_memoryCounters = new List<PerformanceCounter>();

        try
        {
            var engineCategory = new PerformanceCounterCategory(EngineCategory);
            var instances = engineCategory.GetInstanceNames();

            // Prefer the 3D engine: summing every engine type double-counts work that
            // the copy/decode engines perform alongside the render engine.
            var selected = instances
                .Where(n => n.Contains("engtype_3D", StringComparison.OrdinalIgnoreCase))
                .ToArray();
            if (selected.Length == 0)
                selected = instances;

            foreach (var instance in selected)
            {
                try
                {
                    var counter = new PerformanceCounter(EngineCategory, EngineCounter, instance, readOnly: true);
                    counter.NextValue(); // prime; the first sample of a rate counter is always 0
                    s_engineCounters.Add(counter);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[GpuMonitor] skipped instance '{instance}': {ex.Message}");
                }
            }

            s_available = s_engineCounters.Count > 0;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[GpuMonitor] instance refresh failed: {ex.Message}");
            s_available = false;
        }

        try
        {
            if (PerformanceCounterCategory.Exists(AdapterMemoryCategory))
            {
                var memCategory = new PerformanceCounterCategory(AdapterMemoryCategory);
                foreach (var instance in memCategory.GetInstanceNames())
                {
                    try
                    {
                        var counter = new PerformanceCounter(
                            AdapterMemoryCategory, DedicatedUsageCounter, instance, readOnly: true);
                        counter.NextValue();
                        s_memoryCounters.Add(counter);
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[GpuMonitor] skipped memory instance '{instance}': {ex.Message}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[GpuMonitor] adapter memory refresh failed: {ex.Message}");
        }
    }
}
