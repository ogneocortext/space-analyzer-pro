// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the Workflows page. Supports predefined workflows
/// such as "Find Large Files" and "Find Empty Directories".
/// </summary>
public class WorkflowsViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private CancellationTokenSource _cts = new();
    private bool _disposed;

    // ── Workflow templates ──

    private ObservableCollection<WorkflowTemplate> _templates = new();
    public ObservableCollection<WorkflowTemplate> Templates => _templates;

    private WorkflowTemplate? _selectedTemplate;
    public WorkflowTemplate? SelectedTemplate
    {
        get => _selectedTemplate;
        set { _selectedTemplate = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasSelectedTemplate)); }
    }
    public bool HasSelectedTemplate => _selectedTemplate is not null;

    // ── Parameters ──

    private string _targetPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string TargetPath
    {
        get => _targetPath;
        set { _targetPath = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsTargetPathValid)); }
    }

    public bool IsTargetPathValid => !string.IsNullOrWhiteSpace(TargetPath) && Directory.Exists(TargetPath);

    private ulong _minSizeMb = 100;
    public ulong MinSizeMb
    {
        get => _minSizeMb;
        set { _minSizeMb = value; OnPropertyChanged(); }
    }

    private ulong _maxSizeMb = 1000;
    public ulong MaxSizeMb
    {
        get => _maxSizeMb;
        set { _maxSizeMb = value; OnPropertyChanged(); }
    }

    private int _daysOld = 30;
    public int DaysOld
    {
        get => _daysOld;
        set { _daysOld = value; OnPropertyChanged(); }
    }

    private string _extensionFilter = ".log";
    public string ExtensionFilter
    {
        get => _extensionFilter;
        set { _extensionFilter = value; OnPropertyChanged(); }
    }

    // ── Execution state ──

    private bool _isRunning;
    public bool IsRunning
    {
        get => _isRunning;
        set { _isRunning = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotRunning)); }
    }
    public bool IsNotRunning => !_isRunning;

    private string _statusMessage = "Select a workflow and click Run.";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    private ObservableCollection<SmartSearchResult> _results = new();
    public ObservableCollection<SmartSearchResult> Results => _results;

    private ObservableCollection<WorkflowHistoryEntry> _history = new();
    public ObservableCollection<WorkflowHistoryEntry> History => _history;

    private int _resultCount;
    public int ResultCount
    {
        get => _resultCount;
        set { _resultCount = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasResults)); }
    }
    public bool HasResults => _resultCount > 0;

    public WorkflowsViewModel()
    {
        Templates.Add(new WorkflowTemplate("Find Large Files",
            "Locate files larger than a specified size threshold.",
            "\uE7C3", "large-files"));
        Templates.Add(new WorkflowTemplate("Find Empty Directories",
            "Find directories that contain no files (recursively).",
            "\uE7F6", "empty-dirs"));
        Templates.Add(new WorkflowTemplate("Find Duplicate Files",
            "Scan for duplicate files by content hash.",
            "\uE8ED", "duplicate-files"));
        Templates.Add(new WorkflowTemplate("Find Zero-Byte Files",
            "Find files that occupy no space on disk.",
            "\uE74C", "zero-byte"));
        Templates.Add(new WorkflowTemplate("Find Temp & Cache Files",
            "Locate temporary and cache files that can be safely removed.",
            "\uE740", "temp-cache"));
        Templates.Add(new WorkflowTemplate("Find Old Files",
            "Find files not modified in a specified number of days.",
            "\uE786", "old-files"));
        Templates.Add(new WorkflowTemplate("Find Recently Modified",
            "Find files modified within a specified number of days.",
            "\uE71E", "recent-files"));
        Templates.Add(new WorkflowTemplate("Find Largest Directories",
            "Show directories ranked by total size.",
            "\uE8B7", "largest-dirs"));
        Templates.Add(new WorkflowTemplate("Find Largest Single Files",
            "Show the single largest files by byte size.",
            "\uE7FC", "largest-single"));
        Templates.Add(new WorkflowTemplate("Find by Extension",
            "Find all files matching a specific file extension.",
            "\uE70B", "by-extension"));
        Templates.Add(new WorkflowTemplate("Find in Size Range",
            "Find files within a specified size range.",
            "\uE747", "size-range"));
        Templates.Add(new WorkflowTemplate("Find by Date Range",
            "Find files created or modified within a date range.",
            "\uE787", "date-range"));
        Templates.Add(new WorkflowTemplate("Find Files Older Than",
            "Find files older than a specified number of days.",
            "\uE786", "older-than"));
        Templates.Add(new WorkflowTemplate("Find Hidden Files",
            "Find files and folders with the hidden attribute.",
            "\uE70C", "hidden-files"));
        Templates.Add(new WorkflowTemplate("Find Read-Only Files",
            "Find files marked as read-only.",
            "\uE776", "read-only"));
        Templates.Add(new WorkflowTemplate("Find Orphaned Projects",
            "Find project directories missing key build/config files.",
            "\uE7BA", "orphaned-projects"));
        Templates.Add(new WorkflowTemplate("Downloads Folder Bloat",
            "Analyze the Downloads folder for large or old files.",
            "\uE74E", "downloads-bloat"));

        SelectedTemplate = Templates[0];
    }

    public async Task BrowseForPathAsync()
    {
        try
        {
            var path = await UiHelper.PickFolderAsync();
            if (path != null)
            {
                TargetPath = path;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] Browse failed: {ex}");
        }
    }

    public async Task RunAsync()
    {
        if (IsRunning || SelectedTemplate is null)
            return;
        if (string.IsNullOrWhiteSpace(TargetPath) || !Directory.Exists(TargetPath))
        {
            StatusMessage = "Please select a valid target directory.";
            return;
        }
        if (MinSizeMb == 0)
        {
            StatusMessage = "Min Size must be at least 1 MB.";
            return;
        }

        IsRunning = true;
        _cts = new CancellationTokenSource();
        Results.Clear();
        ResultCount = 0;
        StatusMessage = $"Running: {SelectedTemplate.Name}...";

        try
        {
            if (SelectedTemplate.Id == "large-files")
            {
                await RunFindLargeFilesAsync();
            }
            else if (SelectedTemplate.Id == "empty-dirs")
            {
                await RunFindEmptyDirsAsync();
            }
            else if (SelectedTemplate.Id == "duplicate-files")
            {
                await RunFindDuplicatesAsync();
            }
            else if (SelectedTemplate.Id == "zero-byte")
            {
                await RunFindZeroByteFilesAsync();
            }
            else if (SelectedTemplate.Id == "temp-cache")
            {
                await RunFindTempCacheAsync();
            }
            else if (SelectedTemplate.Id == "old-files")
            {
                await RunFindOldFilesAsync();
            }
            else if (SelectedTemplate.Id == "recent-files")
            {
                await RunFindRecentFilesAsync();
            }
            else if (SelectedTemplate.Id == "largest-dirs")
            {
                await RunFindLargestDirsAsync();
            }
            else if (SelectedTemplate.Id == "largest-single")
            {
                await RunFindLargestSingleAsync();
            }
            else if (SelectedTemplate.Id == "by-extension")
            {
                await RunFindByExtensionAsync();
            }
            else if (SelectedTemplate.Id == "size-range")
            {
                await RunFindInSizeRangeAsync();
            }
            else if (SelectedTemplate.Id == "date-range")
            {
                await RunFindByDateRangeAsync();
            }
            else if (SelectedTemplate.Id == "older-than")
            {
                await RunFindOlderThanAsync();
            }
            else if (SelectedTemplate.Id == "hidden-files")
            {
                await RunFindHiddenFilesAsync();
            }
            else if (SelectedTemplate.Id == "read-only")
            {
                await RunFindReadOnlyAsync();
            }
            else if (SelectedTemplate.Id == "orphaned-projects")
            {
                await RunFindOrphanedProjectsAsync();
            }
            else if (SelectedTemplate.Id == "downloads-bloat")
            {
                await RunDownloadsBloatAsync();
            }
            SortResults();
            StatusMessage = $"Completed. Found {ResultCount} result(s).";
            AppNotifications.Success("Workflow completed",
                $"{SelectedTemplate.Name} found {ResultCount} result(s)");
            AddHistoryEntry(SelectedTemplate.Name, ResultCount, "Completed");
        }
        catch (OperationCanceledException)
        {
            StatusMessage = "Cancelled.";
            AddHistoryEntry(SelectedTemplate?.Name ?? "Unknown", 0, "Cancelled");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
            AddHistoryEntry(SelectedTemplate?.Name ?? "Unknown", 0, $"Error: {ex.Message}");
        }
        finally
        {
            IsRunning = false;
        }
    }

    public void Cancel()
    {
        if (!IsRunning) return;
        _cts.Cancel();
        StatusMessage = "Cancelling...";
    }

    public void ClearResults()
    {
        Results.Clear();
        ResultCount = 0;
        StatusMessage = "Results cleared.";
    }

    private void SortResults()
    {
        var sorted = Results.OrderByDescending(r => r.SizeBytes).ToList();
        Results.Clear();
        foreach (var r in sorted) Results.Add(r);
    }

    private async Task RunFindLargeFilesAsync()
    {
        if (_scanner.IsAvailable)
        {
            try
            {
                var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                if (result is not null)
                {
                    var minBytes = MinSizeMb * 1024 * 1024;
                    var collected = new List<SmartSearchResult>();

                    foreach (var dir in result.TopDirectories)
                    {
                        if (dir.TotalSize >= minBytes)
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

        var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
        ui.TryEnqueue(() =>
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
                var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
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

        var ui2 = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
        ui2.TryEnqueue(() =>
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

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _cts.Cancel();
            _cts.Dispose();
            GC.SuppressFinalize(this);
        }

        // ── New workflow methods ──

        private async Task RunFindZeroByteFilesAsync()
        {
            if (_scanner.IsAvailable)
            {
                try
                {
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = result.ScannedFiles
                            .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime >= cutoff)
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = result.ScannedFiles
                            .Where(kvp => DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime < cutoff)
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(TargetPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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
                    var result = await _scanner.ScanDirectoryAsync(downloadsPath, depthMode: ScannerService.DepthMode.Deep, ct: _cts.Token);
                    if (result is not null)
                    {
                        var collected = new List<SmartSearchResult>();
                        var cutoff = DateTime.Now.AddDays(-DaysOld);
                        var minBytes = (long)MinSizeMb * 1024 * 1024;
                        foreach (var kvp in result.ScannedFiles)
                        {
                            if ((long)kvp.Value.Size >= minBytes || DateTimeOffset.FromUnixTimeSeconds(kvp.Value.Mtime).DateTime < cutoff)
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
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() => AddResults(collected));
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

        private void AddResults(List<SmartSearchResult> newResults)
        {
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() =>
            {
                foreach (var r in newResults) Results.Add(r);
                ResultCount = newResults.Count;
                SortResults();
            });
        }

        private void AddHistoryEntry(string workflowName, int resultCount, string status)
        {
            var ui = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();
            ui.TryEnqueue(() =>
            {
                History.Insert(0, new WorkflowHistoryEntry
                {
                    WorkflowName = workflowName,
                    ResultCount = resultCount,
                    Status = status,
                    Timestamp = DateTime.Now,
                });
                if (History.Count > 50)
                    History.RemoveAt(History.Count - 1);
            });
        }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

/// <summary>
/// A predefined workflow template shown in the Workflows page.
/// </summary>
public class WorkflowTemplate
{
    public string Name { get; }
    public string Description { get; }
    public string IconGlyph { get; }
    public string Id { get; }

    public WorkflowTemplate(string name, string description, string iconGlyph, string id)
    {
        Name = name;
        Description = description;
        IconGlyph = iconGlyph;
        Id = id;
    }
}

/// <summary>
/// A single entry in the workflow execution history.
/// </summary>
public class WorkflowHistoryEntry
{
    public string WorkflowName { get; set; } = string.Empty;
    public int ResultCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string TimestampDisplay => Timestamp.ToString("HH:mm:ss");
}
