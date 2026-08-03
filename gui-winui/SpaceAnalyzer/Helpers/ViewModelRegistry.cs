// Licensed under the MIT License.

using System;
using System.Collections.Generic;

namespace SpaceAnalyzer.Helpers;

/// <summary>
/// Central registry that tracks all ViewModels implementing <see cref="IDisposable"/>
/// so they can be disposed when the window closes — even if their page is not the
/// currently visible one.
/// </summary>
public static class ViewModelRegistry
{
    private static readonly HashSet<WeakReference<IDisposable>> s_viewModels = new();
    private static readonly object s_lock = new();

    public static void Register(IDisposable viewModel)
    {
        lock (s_lock)
        {
            // Prune dead references while we're here
            s_viewModels.RemoveWhere(wr => !wr.TryGetTarget(out _));
            s_viewModels.Add(new WeakReference<IDisposable>(viewModel));
        }
    }

    public static void Unregister(IDisposable viewModel)
    {
        lock (s_lock)
        {
            s_viewModels.RemoveWhere(wr => !wr.TryGetTarget(out var target) || ReferenceEquals(target, viewModel));
        }
    }

    /// <summary>
    /// Dispose all tracked ViewModels. Called once when the window closes.
    /// </summary>
    public static void DisposeAll()
    {
        lock (s_lock)
        {
            foreach (var wr in s_viewModels)
            {
                if (wr.TryGetTarget(out var vm))
                {
                    try { vm.Dispose(); } catch { /* best-effort */ }
                }
            }
            s_viewModels.Clear();
        }
    }
}
