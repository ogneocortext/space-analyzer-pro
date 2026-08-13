// Licensed under the MIT License.
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class WorkflowsViewModel
{
        private async Task RunFindInSizeRangeAsync()
        {
            var minBytes = (long)MinSizeMb * 1024 * 1024;
            var maxBytes = (long)MaxSizeMb * 1024 * 1024;
            if (minBytes > maxBytes)
            {
                StatusMessage = "Min Size must be less than or equal to Max Size.";
                return;
            }
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    var collected = result.ScannedFiles
                            .Where(kvp => (long)kvp.Value.Size >= minBytes && (long)kvp.Value.Size <= maxBytes)
                            .Select(kvp => new SmartSearchResult
                            {
                                Path = kvp.Key,
                                Name = Path.GetFileName(kvp.Key) ?? kvp.Key,
                                SizeBytes = kvp.Value.Size,
                                SizeDisplay = ByteFormatter.FormatBytes(kvp.Value.Size)
                            }).ToList();
                        AddResults(collected);
                        return;
                    }
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
                }
            }
            await RunManagedSizeRangeAsync(minBytes, maxBytes);
        }

        private async Task RunManagedSizeRangeAsync(long minBytes, long maxBytes)
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkSizeRange(new DirectoryInfo(TargetPath), minBytes, maxBytes, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkSizeRange(DirectoryInfo dir, long minBytes, long maxBytes, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    var size = (long)file.Length;
                    if (size >= minBytes && size <= maxBytes)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = (ulong)size,
                            SizeDisplay = ByteFormatter.FormatBytes((ulong)size)
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkSizeRange(subdir, minBytes, maxBytes, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkSizeRange error: {ex}");
            }
        }

        private async Task RunFindByDateRangeAsync()
        {
            var cutoff = DateTime.Now.AddDays(-DaysOld);
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    var collected = result.ScannedFiles
                            .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime >= cutoff)
                            .Select(kvp => new SmartSearchResult
                            {
                                Path = kvp.Key,
                                Name = Path.GetFileName(kvp.Key) ?? kvp.Key,
                                SizeBytes = kvp.Value.Size,
                                SizeDisplay = ByteFormatter.FormatBytes(kvp.Value.Size)
                            }).ToList();
                        AddResults(collected);
                        return;
                    }
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
                }
            }
            await RunManagedDateRangeAsync(cutoff);
        }

        private async Task RunManagedDateRangeAsync(DateTime cutoff)
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkDateRange(new DirectoryInfo(TargetPath), cutoff, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkDateRange(DirectoryInfo dir, DateTime cutoff, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if (file.LastWriteTime >= cutoff)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = (ulong)file.Length,
                            SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkDateRange(subdir, cutoff, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkDateRange error: {ex}");
            }
        }

        private async Task RunFindOlderThanAsync()
        {
            var cutoff = DateTime.Now.AddDays(-DaysOld);
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    var collected = result.ScannedFiles
                            .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime < cutoff)
                            .Select(kvp => new SmartSearchResult
                            {
                                Path = kvp.Key,
                                Name = Path.GetFileName(kvp.Key) ?? kvp.Key,
                                SizeBytes = kvp.Value.Size,
                                SizeDisplay = ByteFormatter.FormatBytes(kvp.Value.Size)
                            }).ToList();
                        AddResults(collected);
                        return;
                    }
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
                }
            }
            await RunManagedOlderThanAsync(cutoff);
        }

        private async Task RunManagedOlderThanAsync(DateTime cutoff)
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkOlderThan(new DirectoryInfo(TargetPath), cutoff, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkOlderThan(DirectoryInfo dir, DateTime cutoff, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if (file.LastWriteTime < cutoff)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = (ulong)file.Length,
                            SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkOlderThan(subdir, cutoff, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkOlderThan error: {ex}");
            }
        }

        private async Task RunFindHiddenFilesAsync()
        {
            await RunManagedHiddenAsync();
        }

        private async Task RunManagedHiddenAsync()
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkHidden(new DirectoryInfo(TargetPath), collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkHidden(DirectoryInfo dir, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if ((file.Attributes & FileAttributes.Hidden) == FileAttributes.Hidden)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = (ulong)file.Length,
                            SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkHidden(subdir, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkHidden error: {ex}");
            }
        }

        private async Task RunFindReadOnlyAsync()
        {
            await RunManagedReadOnlyAsync();
        }

        private async Task RunManagedReadOnlyAsync()
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkReadOnly(new DirectoryInfo(TargetPath), collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkReadOnly(DirectoryInfo dir, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if ((file.Attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = (ulong)file.Length,
                            SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkReadOnly(subdir, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkReadOnly error: {ex}");
            }
        }

        private async Task RunFindOrphanedProjectsAsync()
        {
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        foreach (var dir in result.TopDirectories)
                        {
                            var dirInfo = new DirectoryInfo(dir.Path);
                            if (!WorkflowConstants.OrphanedProjectFiles.Any(f => File.Exists(Path.Combine(dir.Path, f))))
                            {
                                var hasCode = dirInfo.GetFiles("*.*", SearchOption.TopDirectoryOnly)
                                    .Any(f => WorkflowConstants.ProjectExtensions.Contains(Path.GetExtension(f.Name).ToLowerInvariant()));
                                if (hasCode)
                                {
                                    collected.Add(new SmartSearchResult
                                    {
                                        Path = dir.Path,
                                        Name = dir.Name,
                                        SizeBytes = dir.TotalSize,
                                        SizeDisplay = ByteFormatter.FormatBytes(dir.TotalSize)
                                    });
                                }
                            }
                        }
                        AddResults(collected);
                        return;
                    }
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
                }
            }
            await RunManagedOrphanedAsync();
        }

        private async Task RunManagedOrphanedAsync()
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkOrphanedProjects(new DirectoryInfo(TargetPath), collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkOrphanedProjects(DirectoryInfo dir, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                var hasConfig = WorkflowConstants.OrphanedProjectFiles.Any(f => File.Exists(Path.Combine(dir.FullName, f)));
                if (!hasConfig)
                {
                    var hasCode = dir.GetFiles("*.*", SearchOption.TopDirectoryOnly)
                        .Any(f => WorkflowConstants.ProjectExtensions.Contains(Path.GetExtension(f.Name).ToLowerInvariant()));
                    if (hasCode)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = dir.FullName,
                            Name = dir.Name,
                            SizeBytes = 0,
                            SizeDisplay = "Orphaned"
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkOrphanedProjects(subdir, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkOrphanedProjects error: {ex}");
            }
        }

        private async Task RunDownloadsBloatAsync()
        {
            var downloadsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            if (!Directory.Exists(downloadsPath))
            {
                StatusMessage = "Downloads folder not found.";
                return;
            }
            TargetPath = downloadsPath;
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(downloadsPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        var cutoff = DateTime.Now.AddDays(-DaysOld);
                        var minBytes = (long)MinSizeMb * 1024 * 1024;
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    foreach (var kvp in result.ScannedFiles)
                        {
                            if ((long)kvp.Value.Size >= minBytes || DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).LocalDateTime < cutoff)
                            {
                                collected.Add(new SmartSearchResult
                                {
                                    Path = kvp.Key,
                                    Name = Path.GetFileName(kvp.Key) ?? kvp.Key,
                                    SizeBytes = kvp.Value.Size,
                                    SizeDisplay = ByteFormatter.FormatBytes(kvp.Value.Size)
                                });
                            }
                        }
                        AddResults(collected);
                        return;
                    }
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
                }
            }
            await RunManagedDownloadsBloatAsync(downloadsPath);
        }

        private async Task RunManagedDownloadsBloatAsync(string downloadsPath)
        {
            var collected = new List<SmartSearchResult>();
            var cutoff = DateTime.Now.AddDays(-DaysOld);
            var minBytes = (long)MinSizeMb * 1024 * 1024;
            await Task.Run(() => WalkDownloadsBloat(new DirectoryInfo(downloadsPath), minBytes, cutoff, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkDownloadsBloat(DirectoryInfo dir, long minBytes, DateTime cutoff, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if (file.Length >= minBytes || file.LastWriteTime < cutoff)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = (ulong)file.Length,
                            SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkDownloadsBloat(subdir, minBytes, cutoff, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkDownloadsBloat error: {ex}");
            }
        }

}
