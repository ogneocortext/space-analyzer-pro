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
        private async Task RunFindZeroByteFilesAsync()
        {
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    foreach (var kvp in result.ScannedFiles)
                        {
                            if (kvp.Value.Size == 0)
                            {
                                collected.Add(new SmartSearchResult
                                {
                                    Path = kvp.Key,
                                    Name = Path.GetFileName(kvp.Key) ?? kvp.Key,
                                    SizeBytes = 0,
                                    SizeDisplay = "0 B"
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
            await RunManagedZeroByteAsync();
        }

        private async Task RunManagedZeroByteAsync()
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkZeroByteFiles(new DirectoryInfo(TargetPath), collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkZeroByteFiles(DirectoryInfo dir, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if (file.Length == 0)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = file.FullName,
                            Name = file.Name,
                            SizeBytes = 0,
                            SizeDisplay = "0 B"
                        });
                    }
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkZeroByteFiles(subdir, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkZeroByteFiles error: {ex}");
            }
        }

        private async Task RunFindTempCacheAsync()
        {
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    foreach (var kvp in result.ScannedFiles)
                        {
                            var ext = Path.GetExtension(kvp.Key).ToLowerInvariant();
                            if (WorkflowConstants.TempExtensions.Contains(ext) || WorkflowConstants.CacheExtensions.Contains(ext))
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
            await RunManagedTempCacheAsync();
        }

        private async Task RunManagedTempCacheAsync()
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkTempCache(new DirectoryInfo(TargetPath), collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkTempCache(DirectoryInfo dir, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    var ext = Path.GetExtension(file.Name).ToLowerInvariant();
                    if (WorkflowConstants.TempExtensions.Contains(ext) || WorkflowConstants.CacheExtensions.Contains(ext))
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
                    WalkTempCache(subdir, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkTempCache error: {ex}");
            }
        }

        private async Task RunFindOldFilesAsync()
        {
            var cutoff = DateTime.Now.AddDays(-DaysOld);
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    foreach (var kvp in result.ScannedFiles)
                        {
                            var lastModified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime;
                            if (lastModified < cutoff)
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
            await RunManagedOldFilesAsync(cutoff);
        }

        private async Task RunManagedOldFilesAsync(DateTime cutoff)
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkOldFiles(new DirectoryInfo(TargetPath), cutoff, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkOldFiles(DirectoryInfo dir, DateTime cutoff, List<SmartSearchResult> collected)
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
                    WalkOldFiles(subdir, cutoff, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkOldFiles error: {ex}");
            }
        }

        private async Task RunFindRecentFilesAsync()
        {
            var cutoff = DateTime.Now.AddDays(-DaysOld);
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    foreach (var kvp in result.ScannedFiles)
                        {
                            var lastModified = DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime;
                            if (lastModified >= cutoff)
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
            await RunManagedRecentFilesAsync(cutoff);
        }

        private async Task RunManagedRecentFilesAsync(DateTime cutoff)
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkRecentFiles(new DirectoryInfo(TargetPath), cutoff, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkRecentFiles(DirectoryInfo dir, DateTime cutoff, List<SmartSearchResult> collected)
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
                    WalkRecentFiles(subdir, cutoff, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkRecentFiles error: {ex}");
            }
        }

        private async Task RunFindLargestDirsAsync()
        {
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        var collected = result.TopDirectories
                            .Select(d => new SmartSearchResult
                            {
                                Path = d.Path,
                                Name = d.Name,
                                SizeBytes = d.TotalSize,
                                SizeDisplay = ByteFormatter.FormatBytes(d.TotalSize)
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
            await RunManagedLargestDirsAsync();
        }

        private async Task RunManagedLargestDirsAsync()
        {
            var dirSizes = new Dictionary<string, ulong>();
            await Task.Run(() => WalkDirSizes(new DirectoryInfo(TargetPath), dirSizes), _cts.Token);
            var collected = dirSizes.OrderByDescending(kv => kv.Value).Take(50).Select(kv => new SmartSearchResult
            {
                Path = kv.Key,
                Name = Path.GetFileName(kv.Key) ?? kv.Key,
                SizeBytes = kv.Value,
                SizeDisplay = ByteFormatter.FormatBytes(kv.Value)
            }).ToList();
            OnUi(() => AddResults(collected));
        }

        private void WalkDirSizes(DirectoryInfo dir, Dictionary<string, ulong> sizes)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                ulong total = 0;
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    total += (ulong)file.Length;
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkDirSizes(subdir, sizes);
                    if (sizes.TryGetValue(subdir.FullName, out var subSize))
                        total += subSize;
                }
                sizes[dir.FullName] = total;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkDirSizes error: {ex}");
            }
        }

        private async Task RunFindLargestSingleAsync()
        {
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    var collected = result.ScannedFiles
                            .OrderByDescending(kvp => kvp.Value.Size)
                            .Take(50)
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
            await RunManagedLargestSingleAsync();
        }

        private async Task RunManagedLargestSingleAsync()
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkLargestSingle(new DirectoryInfo(TargetPath), collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkLargestSingle(DirectoryInfo dir, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    collected.Add(new SmartSearchResult
                    {
                        Path = file.FullName,
                        Name = file.Name,
                        SizeBytes = (ulong)file.Length,
                        SizeDisplay = ByteFormatter.FormatBytes((ulong)file.Length)
                    });
                }
                foreach (var subdir in dir.GetDirectories())
                {
                    if (_cts.IsCancellationRequested) return;
                    WalkLargestSingle(subdir, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkLargestSingle error: {ex}");
            }
        }

        private async Task RunFindByExtensionAsync()
        {
            var ext = ExtensionFilter.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(ext))
            {
                StatusMessage = "Please enter a file extension (e.g. .log).";
                return;
            }
            if (!ext.StartsWith(".")) ext = "." + ext;
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                    if (result is not null)
                    {
                        await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    var collected = result.ScannedFiles
                            .Where(kvp => Path.GetExtension(kvp.Key).ToLowerInvariant() == ext)
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
            await RunManagedByExtensionAsync(ext);
        }

        private async Task RunManagedByExtensionAsync(string ext)
        {
            var collected = new List<SmartSearchResult>();
            await Task.Run(() => WalkByExtension(new DirectoryInfo(TargetPath), ext, collected), _cts.Token);
            OnUi(() => AddResults(collected));
        }

        private void WalkByExtension(DirectoryInfo dir, string ext, List<SmartSearchResult> collected)
        {
            if (_cts.IsCancellationRequested) return;
            try
            {
                foreach (var file in dir.GetFiles())
                {
                    if (_cts.IsCancellationRequested) return;
                    if (Path.GetExtension(file.Name).ToLowerInvariant() == ext)
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
                    WalkByExtension(subdir, ext, collected);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkByExtension error: {ex}");
            }
        }

}
