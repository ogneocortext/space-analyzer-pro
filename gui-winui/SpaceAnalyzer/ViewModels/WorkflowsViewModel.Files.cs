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
    private async Task RunFindLargeFilesAsync()
    {
        if (_scanner.IsAvailable)
        {
            try
            {
                var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                if (result is not null)
                {
                    var minBytes = MinSizeMb * 1024 * 1024;
                    var collected = new List<SmartSearchResult>();

                    // Match individual files by size (not directories). The scanner emits a
                    // full scanned_files map, so this finds the actual large files rather
                    // than large folders.
                    await EnsureScannedFilesAsync(result, TargetPath, _cts.Token);
                    foreach (var kvp in result.ScannedFiles)
                    {
                        if (kvp.Value.Size >= minBytes)
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

                    foreach (var r in collected) Results.Add(r);
                    ResultCount = collected.Count;
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
            }
        }

        // Fallback: managed walk
        await RunManagedLargeFilesAsync();
    }

    private async Task RunManagedLargeFilesAsync()
    {
        var minBytes = (long)MinSizeMb * 1024 * 1024;
        var collected = new List<SmartSearchResult>();

        await Task.Run(() =>
        {
            WalkLargeFiles(new DirectoryInfo(TargetPath), minBytes, collected);
        }, _cts.Token);

        OnUi(() =>
        {
            foreach (var r in collected) Results.Add(r);
            ResultCount = collected.Count;
        });
    }

    private void WalkLargeFiles(DirectoryInfo dir, long minBytes, List<SmartSearchResult> collected)
    {
        if (_cts.IsCancellationRequested)
            return;

        try
        {
            foreach (var file in dir.GetFiles())
            {
                if (_cts.IsCancellationRequested) return;
                if ((file.Attributes & FileAttributes.Hidden) == 0 && file.Length >= minBytes)
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
                if ((subdir.Attributes & FileAttributes.Hidden) == 0)
                {
                    WalkLargeFiles(subdir, minBytes, collected);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkLargeFiles error: {ex}");
        }
    }

    private async Task RunFindEmptyDirsAsync()
    {
        if (_scanner.IsAvailable)
        {
            try
            {
                var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token, progress: _scanProgress);
                if (result is not null)
                {
                    var collected = new List<SmartSearchResult>();
                    foreach (var empty in result.EmptyDirs)
                    {
                        collected.Add(new SmartSearchResult
                        {
                            Path = empty,
                            Name = Path.GetFileName(empty) ?? empty,
                            SizeBytes = 0,
                            SizeDisplay = "Empty"
                        });
                    }

                    foreach (var r in collected) Results.Add(r);
                    ResultCount = collected.Count;
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                StatusMessage = $"Scanner error: {ex.Message}. Falling back to managed search.";
            }
        }

        // Fallback: managed walk
        var collected2 = new List<SmartSearchResult>();
        await Task.Run(() =>
        {
            WalkEmptyDirs(new DirectoryInfo(TargetPath), collected2);
        }, _cts.Token);

        OnUi(() =>
        {
            foreach (var r in collected2) Results.Add(r);
            ResultCount = collected2.Count;
        });
    }

    private void WalkEmptyDirs(DirectoryInfo dir, List<SmartSearchResult> collected)
    {
        if (_cts.IsCancellationRequested)
            return;

        try
        {
            var files = dir.GetFiles();
            var subdirs = dir.GetDirectories();

            foreach (var subdir in subdirs)
            {
                WalkEmptyDirs(subdir, collected);
            }

            if (files.Length == 0 && subdirs.Length == 0)
            {
                collected.Add(new SmartSearchResult
                {
                    Path = dir.FullName,
                    Name = dir.Name,
                    SizeBytes = 0,
                    SizeDisplay = "Empty"
                });
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkEmptyDirs error: {ex}");
        }
    }

    private async Task RunFindDuplicatesAsync()
    {
        if (_scanner.IsAvailable)
        {
            try
            {
                var dedup = await _scanner.RunDedupAnalysisAsync(TargetPath, _cts.Token);
                if (dedup is not null)
                {
                    var collected = new List<SmartSearchResult>();
                    foreach (var group in dedup.DuplicateGroups)
                    {
                        var firstFile = group.Files.FirstOrDefault();
                        collected.Add(new SmartSearchResult
                        {
                            Path = firstFile ?? group.Hash,
                            Name = $"{group.FileCount} copies ({group.SizeDisplay} each)",
                            SizeBytes = group.WastedBytes,
                            SizeDisplay = ByteFormatter.FormatBytes(group.WastedBytes)
                        });
                    }

                    foreach (var r in collected) Results.Add(r);
                    ResultCount = collected.Count;
                }
                else
                {
                    StatusMessage = "Dedup analysis returned no results (scanner may not be available).";
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                StatusMessage = $"Dedup error: {ex.Message}";
            }
        }
        else
        {
            StatusMessage = "Scanner not available. Install the Rust binary to use this workflow.";
        }
    }

    // Extension and project-file sets are defined in WorkflowConstants (shared with ToolExecutor).

}
