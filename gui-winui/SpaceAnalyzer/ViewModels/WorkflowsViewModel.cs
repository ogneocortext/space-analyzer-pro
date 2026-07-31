// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
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
    private readonly CancellationTokenSource _cts = new();
    private bool _disposed;
    private volatile bool _isRunningFlag;

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
        set { _targetPath = value; OnPropertyChanged(); }
    }

    private ulong _minSizeMb = 100;
    public ulong MinSizeMb
    {
        get => _minSizeMb;
        set { _minSizeMb = value; OnPropertyChanged(); }
    }

    // ── Execution state ──

    private bool _isRunning;
    public bool IsRunning
    {
        get => _isRunning;
        set { _isRunning = value; _isRunningFlag = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotRunning)); }
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

    private int _resultCount;
    public int ResultCount
    {
        get => _resultCount;
        set { _resultCount = value; OnPropertyChanged(); }
    }

    public WorkflowsViewModel()
    {
        Templates.Add(new WorkflowTemplate("Find Large Files",
            "Locate files larger than a specified size threshold.",
            "\uE7C3"));
        Templates.Add(new WorkflowTemplate("Find Empty Directories",
            "Find directories that contain no files (recursively).",
            "\uE7F6"));
        Templates.Add(new WorkflowTemplate("Find Duplicate Files",
            "Scan for duplicate files by content hash.",
            "\uE8ED"));

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
        if (IsRunning || SelectedTemplate is null || string.IsNullOrWhiteSpace(TargetPath))
            return;

        IsRunning = true;
        Results.Clear();
        ResultCount = 0;
        StatusMessage = $"Running: {SelectedTemplate.Name}...";

        if (SelectedTemplate.Name == "Find Large Files")
        {
            await RunFindLargeFilesAsync();
        }
        else if (SelectedTemplate.Name == "Find Empty Directories")
        {
            await RunFindEmptyDirsAsync();
        }
        else if (SelectedTemplate.Name == "Find Duplicate Files")
        {
            await RunFindDuplicatesAsync();
        }

        IsRunning = false;
        StatusMessage = $"Completed. Found {ResultCount} result(s).";
    }

    private async Task RunFindLargeFilesAsync()
    {
        if (_scanner.IsAvailable)
        {
            try
            {
                var result = await _scanner.ScanDirectoryAsync(TargetPath, deep: true, ct: _cts.Token);
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

        foreach (var r in collected) Results.Add(r);
        ResultCount = collected.Count;
    }

    private void WalkLargeFiles(DirectoryInfo dir, long minBytes, List<SmartSearchResult> collected)
    {
        if (!_isRunningFlag) return;

        try
        {
            foreach (var file in dir.GetFiles())
            {
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
                if ((subdir.Attributes & FileAttributes.Hidden) == 0)
                {
                    WalkLargeFiles(subdir, minBytes, collected);
                }
            }
        }
        catch
        {
            // Skip inaccessible directories
        }
    }

    private async Task RunFindEmptyDirsAsync()
    {
        if (_scanner.IsAvailable)
        {
            try
            {
                var result = await _scanner.ScanDirectoryAsync(TargetPath, deep: true, ct: _cts.Token);
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

        foreach (var r in collected2) Results.Add(r);
        ResultCount = collected2.Count;
    }

    private void WalkEmptyDirs(DirectoryInfo dir, List<SmartSearchResult> collected)
    {
        if (!_isRunningFlag) return;

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
        catch
        {
            // Skip inaccessible directories
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
                        collected.Add(new SmartSearchResult
                        {
                            Path = group.Hash,
                            Name = $"{group.FileCount} copies",
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

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        GC.SuppressFinalize(this);
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

    public WorkflowTemplate(string name, string description, string iconGlyph)
    {
        Name = name;
        Description = description;
        IconGlyph = iconGlyph;
    }
}
