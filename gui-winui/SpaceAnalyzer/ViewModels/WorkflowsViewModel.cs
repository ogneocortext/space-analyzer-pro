// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class WorkflowsViewModel : ViewModelBase, IDisposable
{
    private readonly ScannerService _scanner = new();
    private CancellationTokenSource _cts = new();
    private bool _disposed;

    private readonly Microsoft.UI.Dispatching.DispatcherQueue? _ui =
        Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();

    private void OnUi(Action action)
    {
        if (_ui is null || _ui.HasThreadAccess)
        {
            action();
            return;
        }
        _ui.TryEnqueue(() => action());
    }

    private readonly System.Diagnostics.Stopwatch _progressSw = new();
    private readonly IProgress<StreamProgress> _scanProgress;

    public string CurrentLocation { get; private set; } = string.Empty;
    public string CurrentFile { get; private set; } = string.Empty;
    public string CurrentFileDisplay => string.IsNullOrEmpty(CurrentFile)
        ? string.Empty
        : System.IO.Path.GetFileName(CurrentFile);
    public ulong FilesScanned { get; private set; }
    public ulong DirectoriesScanned { get; private set; }
    public ulong BytesScanned { get; private set; }
    public double ProgressPercent { get; private set; } = -1;
    public bool IsProgressIndeterminate => ProgressPercent < 0;
    public string ScannedBytesDisplay => ByteFormatter.FormatBytes(BytesScanned);

    private void OnScanProgress(StreamProgress p)
    {
        if (_progressSw.IsRunning && _progressSw.ElapsedMilliseconds < 80 && p.Percentage < 100)
            return;
        _progressSw.Restart();

        if (!string.IsNullOrEmpty(p.CurrentFile))
        {
            CurrentFile = p.CurrentFile;
            var dir = System.IO.Path.GetDirectoryName(p.CurrentFile);
            if (!string.IsNullOrEmpty(dir)) CurrentLocation = dir;
        }
        FilesScanned = p.FilesScanned;
        DirectoriesScanned = p.DirectoriesScanned;
        BytesScanned = p.TotalSize;
        ProgressPercent = p.Percentage;

        OnPropertyChanged(nameof(CurrentLocation));
        OnPropertyChanged(nameof(CurrentFile));
        OnPropertyChanged(nameof(CurrentFileDisplay));
        OnPropertyChanged(nameof(FilesScanned));
        OnPropertyChanged(nameof(DirectoriesScanned));
        OnPropertyChanged(nameof(BytesScanned));
        OnPropertyChanged(nameof(ProgressPercent));
        OnPropertyChanged(nameof(IsProgressIndeterminate));
        OnPropertyChanged(nameof(ScannedBytesDisplay));
    }

    // ── Workflow templates ──

    private static readonly HashSet<string> MinSizeTemplates =
        new(StringComparer.OrdinalIgnoreCase) { "large-files", "size-range", "downloads-bloat" };

    private static readonly HashSet<string> MaxSizeTemplates =
        new(StringComparer.OrdinalIgnoreCase) { "size-range" };

    private static readonly HashSet<string> DaysTemplates =
        new(StringComparer.OrdinalIgnoreCase)
        { "old-files", "recent-files", "date-range", "older-than", "downloads-bloat" };

    private static readonly HashSet<string> ExtensionTemplates =
        new(StringComparer.OrdinalIgnoreCase) { "by-extension" };

    private static readonly Dictionary<string, WorkflowCategory> TemplateCategory =
        new(StringComparer.OrdinalIgnoreCase)
    {
        ["empty-dirs"] = WorkflowCategory.Maintenance,
        ["duplicate-files"] = WorkflowCategory.Maintenance,
        ["zero-byte"] = WorkflowCategory.Maintenance,
        ["temp-cache"] = WorkflowCategory.Maintenance,
        ["downloads-bloat"] = WorkflowCategory.Maintenance,
        ["orphaned-projects"] = WorkflowCategory.Maintenance,
        ["large-files"] = WorkflowCategory.Optimization,
        ["largest-dirs"] = WorkflowCategory.Optimization,
        ["largest-single"] = WorkflowCategory.Optimization,
        ["size-range"] = WorkflowCategory.Optimization,
        ["cleanup-recommendations"] = WorkflowCategory.Optimization,
        ["notify-results"] = WorkflowCategory.Optimization,
        ["by-extension"] = WorkflowCategory.Organization,
        ["old-files"] = WorkflowCategory.Organization,
        ["recent-files"] = WorkflowCategory.Organization,
        ["date-range"] = WorkflowCategory.Organization,
        ["older-than"] = WorkflowCategory.Organization,
        ["hidden-files"] = WorkflowCategory.Organization,
        ["read-only"] = WorkflowCategory.Organization,
        ["predict-storage"] = WorkflowCategory.Monitoring,
        ["ai-analyze"] = WorkflowCategory.Monitoring,
        ["export-results"] = WorkflowCategory.Custom,
    };

    private static readonly Dictionary<WorkflowCategory, (string Title, string Description, string Icon)> CategoryMeta = new()
    {
        [WorkflowCategory.Maintenance] = ("Maintenance", "Routine cleanup — find duplicates, temp files, and other removable clutter.", "\uE74D"),
        [WorkflowCategory.Optimization] = ("Optimization", "Reclaim disk space by finding your biggest consumers.", "\uE8B7"),
        [WorkflowCategory.Organization] = ("Organization", "Locate files by attribute to sort and triage.", "\uE70B"),
        [WorkflowCategory.Monitoring] = ("Monitoring", "Forecast usage and analyze results over time.", "\uE773"),
        [WorkflowCategory.Custom] = ("Custom", "Export and other user-driven output actions.", "\uE78E"),
    };

    private void BuildCategories()
    {
        foreach (var t in _templates)
            if (TemplateCategory.TryGetValue(t.Id, out var cat))
                t.Category = cat;

        foreach (WorkflowCategory cat in Enum.GetValues<WorkflowCategory>())
        {
            if (!CategoryMeta.TryGetValue(cat, out var meta))
                continue;
            var group = new WorkflowCategoryGroup(cat, meta.Title, meta.Description, meta.Icon);
            foreach (var t in _templates.Where(t => t.Category == cat))
                group.Templates.Add(t);
            if (group.Templates.Count > 0)
                _categories.Add(group);
        }
    }

    private ObservableCollection<WorkflowTemplate> _templates = new();
    public ObservableCollection<WorkflowTemplate> Templates => _templates;

    private readonly ObservableCollection<WorkflowCategoryGroup> _categories = new();
    public ObservableCollection<WorkflowCategoryGroup> Categories => _categories;

    private WorkflowTemplate? _selectedTemplate;
    public WorkflowTemplate? SelectedTemplate
    {
        get => _selectedTemplate;
        set
        {
            if (ReferenceEquals(_selectedTemplate, value)) return;
            _selectedTemplate = value;
            foreach (var t in _templates)
                t.IsSelected = ReferenceEquals(t, value);
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasSelectedTemplate));
            OnPropertyChanged(nameof(SelectedTemplateName));
            OnPropertyChanged(nameof(CanRun));
            RaiseParameterVisibility();
        }
    }
    public bool HasSelectedTemplate => _selectedTemplate is not null;
    public string SelectedTemplateName => _selectedTemplate?.Name ?? "No workflow selected";

    // ── Parameters ──

    private string _targetPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    public string TargetPath
    {
        get => _targetPath;
        set
        {
            _targetPath = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsTargetPathValid));
            OnPropertyChanged(nameof(CanRun));
        }
    }

    public bool IsTargetPathValid => !string.IsNullOrWhiteSpace(TargetPath) && Directory.Exists(TargetPath);

    private ulong _minSizeMb = 100;
    public ulong MinSizeMb
    {
        get => _minSizeMb;
        set { _minSizeMb = value; OnPropertyChanged(); OnPropertyChanged(nameof(MinSizeMbValue)); }
    }

    private ulong _maxSizeMb = 1000;
    public ulong MaxSizeMb
    {
        get => _maxSizeMb;
        set { _maxSizeMb = value; OnPropertyChanged(); OnPropertyChanged(nameof(MaxSizeMbValue)); }
    }

    private int _daysOld = 30;
    public int DaysOld
    {
        get => _daysOld;
        set { _daysOld = value; OnPropertyChanged(); OnPropertyChanged(nameof(DaysOldValue)); }
    }

    private string _extensionFilter = ".log";
    public string ExtensionFilter
    {
        get => _extensionFilter;
        set { _extensionFilter = value; OnPropertyChanged(); }
    }

    public double MinSizeMbValue
    {
        get => _minSizeMb;
        set => MinSizeMb = double.IsNaN(value) || value < 0 ? 0 : (ulong)value;
    }

    public double MaxSizeMbValue
    {
        get => _maxSizeMb;
        set => MaxSizeMb = double.IsNaN(value) || value < 0 ? 0 : (ulong)value;
    }

    public double DaysOldValue
    {
        get => _daysOld;
        set => DaysOld = double.IsNaN(value) || value < 1 ? 1 : (int)value;
    }

    public bool ShowMinSize => _selectedTemplate is not null && MinSizeTemplates.Contains(_selectedTemplate.Id);
    public bool ShowMaxSize => _selectedTemplate is not null && MaxSizeTemplates.Contains(_selectedTemplate.Id);
    public bool ShowDays => _selectedTemplate is not null && DaysTemplates.Contains(_selectedTemplate.Id);
    public bool ShowExtension => _selectedTemplate is not null && ExtensionTemplates.Contains(_selectedTemplate.Id);
    public bool HasParameters => ShowMinSize || ShowMaxSize || ShowDays || ShowExtension;
    public bool HasNoParameters => !HasParameters;

    public string DaysLabel => _selectedTemplate?.Id switch
    {
        "recent-files" or "date-range" => "Modified within (days)",
        _ => "Older than (days)",
    };

    private void RaiseParameterVisibility()
    {
        OnPropertyChanged(nameof(ShowMinSize));
        OnPropertyChanged(nameof(ShowMaxSize));
        OnPropertyChanged(nameof(ShowDays));
        OnPropertyChanged(nameof(ShowExtension));
        OnPropertyChanged(nameof(HasParameters));
        OnPropertyChanged(nameof(HasNoParameters));
        OnPropertyChanged(nameof(DaysLabel));
        OnPropertyChanged(nameof(ShowTargetPath));
        OnPropertyChanged(nameof(ShowEmptyState));
    }

    // ── Execution state ──

    private bool _isRunning;
    public bool IsRunning
    {
        get => _isRunning;
        set
        {
            _isRunning = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsNotRunning));
            OnPropertyChanged(nameof(CanRun));
        }
    }
    public bool IsNotRunning => !_isRunning;

    public bool CanRun => !_isRunning && HasSelectedTemplate && (!RequiresPath || IsTargetPathValid);

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
        set
        {
            _resultCount = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasResults));
            OnPropertyChanged(nameof(ResultsSummary));
        }
    }
    public bool HasResults => _resultCount > 0;

    private ulong ComputeTotalBytes()
    {
        ulong total = 0;
        foreach (var r in _results) total += r.SizeBytes;
        return total;
    }

    private bool _hasRun;
    public bool HasRun
    {
        get => _hasRun;
        private set
        {
            _hasRun = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(EmptyStateTitle));
            OnPropertyChanged(nameof(EmptyStateHint));
        }
    }

    public string EmptyStateTitle => _hasRun ? "No matches found" : "No workflow results yet";

    public string EmptyStateHint => _hasRun
        ? $"'{SelectedTemplateName}' finished without matching anything in this folder. Try a different folder or loosen the parameters above."
        : "Pick a workflow above, choose a target directory, then click Run Workflow.";

    public string ResultsSummary
    {
        get
        {
            if (_resultCount == 0) return "0 results";
            ulong total = 0;
            foreach (var r in _results) total += r.SizeBytes;
            var label = _resultCount == 1 ? "1 result" : $"{_resultCount} results";
            return total > 0 ? $"{label} · {ByteFormatter.FormatBytes(total)} total" : label;
        }
    }

    public bool RequiresPath =>
        _selectedTemplate is null ||
        _selectedTemplate.ActionType is WorkflowActionType.Scan or WorkflowActionType.FindDuplicates;

    public bool ShowTargetPath => RequiresPath;

    private string _reportTitle = string.Empty;
    public string ReportTitle
    {
        get => _reportTitle;
        set { _reportTitle = value; OnPropertyChanged(); }
    }

    private string _report = string.Empty;
    public string Report
    {
        get => _report;
        set { _report = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasReport)); OnPropertyChanged(nameof(ShowEmptyState)); }
    }

    public bool HasReport => !string.IsNullOrWhiteSpace(_report);
    public bool ShowEmptyState => !HasResults && !HasReport && !IsRunning;

    private string _sortKey = "size";
    public string SortKey
    {
        get => _sortKey;
        set
        {
            if (_sortKey == value) return;
            _sortKey = value;
            OnPropertyChanged();
            ApplySort();
        }
    }

    private bool _sortAscending;
    public bool SortAscending
    {
        get => _sortAscending;
        set
        {
            if (_sortAscending == value) return;
            _sortAscending = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(SortDirectionGlyph));
            ApplySort();
        }
    }

    public string SortDirectionGlyph => _sortAscending ? "\uE74A" : "\uE74B";

    public void ApplySort() => SortResults();

    public WorkflowsViewModel()
    {
        _scanProgress = new Progress<StreamProgress>(OnScanProgress);

        Templates.Add(new WorkflowTemplate("Find Large Files",
            "Locate files larger than a specified size threshold.",
            "\uE7C3", "large-files", "Above a size threshold"));
        Templates.Add(new WorkflowTemplate("Find Empty Directories",
            "Find directories that contain no files (recursively).",
            "\uE7F6", "empty-dirs", "Folders with no files"));
        Templates.Add(new WorkflowTemplate("Find Duplicate Files",
            "Scan for duplicate files by content hash.",
            "\uE8ED", "duplicate-files", "Identical files by hash", WorkflowActionType.FindDuplicates));
        Templates.Add(new WorkflowTemplate("Find Zero-Byte Files",
            "Find files that occupy no space on disk.",
            "\uE74C", "zero-byte", "Files of 0 bytes"));
        Templates.Add(new WorkflowTemplate("Find Temp & Cache Files",
            "Locate temporary and cache files that can be safely removed.",
            "\uE740", "temp-cache", "Safe-to-remove clutter"));
        Templates.Add(new WorkflowTemplate("Find Old Files",
            "Find files not modified in a specified number of days.",
            "\uE786", "old-files", "Untouched for N days"));
        Templates.Add(new WorkflowTemplate("Find Recently Modified",
            "Find files modified within a specified number of days.",
            "\uE71E", "recent-files", "Changed in last N days"));
        Templates.Add(new WorkflowTemplate("Find Largest Directories",
            "Show directories ranked by total size.",
            "\uE8B7", "largest-dirs", "Folders ranked by size"));
        Templates.Add(new WorkflowTemplate("Find Largest Single Files",
            "Show the single largest files by byte size.",
            "\uE7FC", "largest-single", "Top files by size"));
        Templates.Add(new WorkflowTemplate("Find by Extension",
            "Find all files matching a specific file extension.",
            "\uE70B", "by-extension", "Match one file type"));
        Templates.Add(new WorkflowTemplate("Find in Size Range",
            "Find files within a specified size range.",
            "\uE747", "size-range", "Between min and max"));
        Templates.Add(new WorkflowTemplate("Find by Date Range",
            "Find files modified within the last N days (recency filter).",
            "\uE787", "date-range", "Within a recency window"));
        Templates.Add(new WorkflowTemplate("Find Files Older Than",
            "Find files older than a specified number of days.",
            "\uE71C", "older-than", "Older than N days"));
        Templates.Add(new WorkflowTemplate("Find Hidden Files",
            "Find files and folders with the hidden attribute.",
            "\uE70C", "hidden-files", "Hidden attribute set"));
        Templates.Add(new WorkflowTemplate("Find Read-Only Files",
            "Find files marked as read-only.",
            "\uE776", "read-only", "Read-only attribute set"));
        Templates.Add(new WorkflowTemplate("Find Orphaned Projects",
            "Find project directories missing key build/config files.",
            "\uE7BA", "orphaned-projects", "Missing build/config"));
        Templates.Add(new WorkflowTemplate("Downloads Folder Bloat",
            "Analyze the Downloads folder for large or old files.",
            "\uE74E", "downloads-bloat", "Large or stale downloads"));

        Templates.Add(new WorkflowTemplate("Predict Storage",
            "Forecast disk usage from the historical scan trend (linear regression).",
            "\uE773", "predict-storage", "Forecast from history", WorkflowActionType.PredictStorage));
        Templates.Add(new WorkflowTemplate("Cleanup Recommendations",
            "Generate prioritized cleanup recommendations from the latest scan.",
            "\uE8B7", "cleanup-recommendations", "Prioritized cleanup", WorkflowActionType.GenerateRecommendations));
        Templates.Add(new WorkflowTemplate("Export Results",
            "Write the current results to a JSON file in your Downloads folder.",
            "\uE78E", "export-results", "Save results to file", WorkflowActionType.Export));
        Templates.Add(new WorkflowTemplate("Notify Results",
            "Send a notification summarizing the last workflow run.",
            "\uE789", "notify-results", "Toast the summary", WorkflowActionType.Notify));
        Templates.Add(new WorkflowTemplate("AI Analyze Results",
            "Ask the local Ollama model to analyze the current results.",
            "\uE8D4", "ai-analyze", "Local AI analysis", WorkflowActionType.AIAnalyze));

        SelectedTemplate = Templates[0];

        BuildCategories();
        LoadHistory();
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

        if (RequiresPath && (string.IsNullOrWhiteSpace(TargetPath) || !Directory.Exists(TargetPath)))
        {
            StatusMessage = "Please select a valid target directory.";
            return;
        }

        var sizeBasedTemplates = new HashSet<string> { "large-files", "size-range", "downloads-bloat" };
        if (sizeBasedTemplates.Contains(SelectedTemplate.Id) && MinSizeMb == 0)
        {
            StatusMessage = "Min Size must be at least 1 MB.";
            return;
        }

        IsRunning = true;
        _cts = new CancellationTokenSource();
        Results.Clear();
        ResultCount = 0;
        ProgressPercent = -1;
        Report = string.Empty;
        CurrentLocation = RequiresPath ? TargetPath : "Analyzing…";
        CurrentFile = string.Empty;
        FilesScanned = 0;
        DirectoriesScanned = 0;
        BytesScanned = 0;
        StatusMessage = RequiresPath
            ? $"Running {SelectedTemplate.Name} on {TargetPath}..."
            : $"Running {SelectedTemplate.Name}…";
        OnPropertyChanged(nameof(IsProgressIndeterminate));
        OnPropertyChanged(nameof(CurrentLocation));
        OnPropertyChanged(nameof(CurrentFile));
        OnPropertyChanged(nameof(CurrentFileDisplay));
        OnPropertyChanged(nameof(FilesScanned));
        OnPropertyChanged(nameof(DirectoriesScanned));
        OnPropertyChanged(nameof(BytesScanned));
        OnPropertyChanged(nameof(ProgressPercent));
        OnPropertyChanged(nameof(ScannedBytesDisplay));

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
            else if (SelectedTemplate.Id == "predict-storage")
            {
                await RunPredictStorageAsync();
            }
            else if (SelectedTemplate.Id == "cleanup-recommendations")
            {
                await RunGenerateRecommendationsAsync();
            }
            else if (SelectedTemplate.Id == "export-results")
            {
                await RunExportAsync();
            }
            else if (SelectedTemplate.Id == "notify-results")
            {
                await RunNotifyAsync();
            }
            else if (SelectedTemplate.Id == "ai-analyze")
            {
                await RunAiAnalyzeAsync();
            }
            SortResults();
            if (HasReport)
            {
                StatusMessage = $"Completed. {SelectedTemplate.Name} produced a report.";
            }
            else
            {
                StatusMessage = ResultCount == 0
                    ? $"Completed. {SelectedTemplate.Name} found no matches."
                    : $"Completed. Found {ResultCount} result(s).";
            }
            if (SelectedTemplate.Id != "notify-results")
            {
                var total = ComputeTotalBytes();
                var sizePart = total > 0 ? $" · {ByteFormatter.FormatBytes(total)} total" : "";
                AppNotifications.Success("Workflow completed",
                    $"{SelectedTemplate.Name}: {ResultCount} result(s){sizePart}",
                    "View results", () => MainWindow.Current?.NavigateToPage("Workflows"));
            }
            AddHistoryEntry(SelectedTemplate.Name, ResultCount, "Completed", SelectedTemplate.ActionType.ToString());
        }
        catch (OperationCanceledException)
        {
            StatusMessage = "Cancelled.";
            AppNotifications.Warning("Workflow cancelled",
                $"{SelectedTemplate?.Name ?? "Workflow"} was cancelled before finishing.");
            AddHistoryEntry(SelectedTemplate?.Name ?? "Unknown", 0, "Cancelled", SelectedTemplate?.ActionType.ToString() ?? "Unknown");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
            AppNotifications.Error("Workflow failed", ex.Message);
            AddHistoryEntry(SelectedTemplate?.Name ?? "Unknown", 0, $"Error: {ex.Message}", SelectedTemplate?.ActionType.ToString() ?? "Unknown");
        }
        finally
        {
            IsRunning = false;
            HasRun = true;
            CurrentFile = string.Empty;
            OnPropertyChanged(nameof(CurrentFile));
            OnPropertyChanged(nameof(CurrentFileDisplay));
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
        Report = string.Empty;
        HasRun = false;
        StatusMessage = "Results cleared.";
    }

    private void SortResults()
    {
        if (_results.Count == 0) return;
        IEnumerable<SmartSearchResult> ordered = _sortKey switch
        {
            "name" => _sortAscending
                ? _results.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                : _results.OrderByDescending(r => r.Name, StringComparer.OrdinalIgnoreCase),
            "path" => _sortAscending
                ? _results.OrderBy(r => r.Path, StringComparer.OrdinalIgnoreCase)
                : _results.OrderByDescending(r => r.Path, StringComparer.OrdinalIgnoreCase),
            _ => _sortAscending
                ? _results.OrderBy(r => r.SizeBytes)
                : _results.OrderByDescending(r => r.SizeBytes),
        };
        var sorted = ordered.ToList();
        _results.Clear();
        foreach (var r in sorted) _results.Add(r);
        OnPropertyChanged(nameof(ResultsSummary));
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
        _scanner.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Fills <paramref name="result"/>.ScannedFiles from a managed directory walk when
    /// the scanner summary omitted the per-file map. The GUI never requests
    /// <c>--files</c>, so <c>ScanDirectoryAsync</c> returns an empty map and every
    /// file-based workflow would otherwise report zero results. Populating the map
    /// here lets the drills keep their normal scanner-branch logic (and keeps the
    /// existing managed-walk fallback for when the scanner is unavailable/throws).
    /// </summary>
    private async Task EnsureScannedFilesAsync(ScanResult result, string path, CancellationToken ct)
    {
        if (result.ScannedFiles.Count > 0 || string.IsNullOrWhiteSpace(path))
            return;
        var map = await Task.Run(() => WalkFilesToMap(new DirectoryInfo(path), ct), ct);
        foreach (var kvp in map)
            result.ScannedFiles[kvp.Key] = kvp.Value;
    }

    private static Dictionary<string, ScannedFileEntry> WalkFilesToMap(DirectoryInfo dir, CancellationToken ct)
    {
        var map = new Dictionary<string, ScannedFileEntry>();
        var stack = new Stack<DirectoryInfo>();
        stack.Push(dir);
        while (stack.Count > 0 && !ct.IsCancellationRequested)
        {
            var current = stack.Pop();
            try
            {
                foreach (var file in current.GetFiles())
                {
                    if (ct.IsCancellationRequested) break;
                    if ((file.Attributes & FileAttributes.Hidden) == 0)
                    {
                        map[file.FullName] = new ScannedFileEntry
                        {
                            Size = (ulong)file.Length,
                            Mtime = new DateTimeOffset(file.LastWriteTimeUtc).ToUnixTimeSeconds()
                        };
                    }
                }
                foreach (var sub in current.GetDirectories())
                {
                    if ((sub.Attributes & FileAttributes.Hidden) == 0)
                        stack.Push(sub);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] WalkFilesToMap error: {ex}");
            }
        }
        return map;
    }

    private void AddResults(List<SmartSearchResult> newResults)
    {
        OnUi(() =>
        {
            foreach (var r in newResults) Results.Add(r);
            ResultCount = newResults.Count;
            SortResults();
        });
    }

    private void LoadHistory()
    {
        try
        {
            var path = HistoryFilePath;
            if (!File.Exists(path))
                return;
            var json = File.ReadAllText(path);
            if (string.IsNullOrWhiteSpace(json))
                return;
            var loaded = System.Text.Json.JsonSerializer.Deserialize<List<WorkflowHistoryEntry>>(json);
            if (loaded is null)
                return;
            foreach (var entry in loaded)
                _history.Add(entry);
            OnPropertyChanged(nameof(HasHistory));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] LoadHistory failed: {ex.Message}");
        }
    }

    private void SaveHistory()
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(_history.ToList());
            File.WriteAllText(HistoryFilePath, json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WorkflowsViewModel] SaveHistory failed: {ex.Message}");
        }
    }

    /// <summary>True once at least one workflow run has been recorded.</summary>
    public bool HasHistory => _history.Count > 0;
}

/// <summary>
/// A predefined workflow template shown in the Workflows page.
/// Observable so the data-driven picker can highlight the active card without the view
/// having to compare ids against the selected template.
/// </summary>
public class WorkflowTemplate : ViewModelBase
{
    public string Name { get; }
    public string Description { get; }
    public string IconGlyph { get; }
    public string Id { get; }

    /// <summary>The action this template performs. Drives backend routing and whether a target
    /// directory is required. Defaults to <see cref="WorkflowActionType.Scan"/> so the existing
    /// file-finding templates need no change.</summary>
    public WorkflowActionType ActionType { get; }

    /// <summary>Short label shown under the card title.</summary>
    public string ShortDescription { get; }

    /// <summary>Which of the five README workflow categories this template belongs to.</summary>
    public WorkflowCategory Category { get; internal set; } = WorkflowCategory.Maintenance;

    private bool _isSelected;
    public bool IsSelected
    {
        get => _isSelected;
        set
        {
            if (_isSelected == value) return;
            _isSelected = value;
            OnPropertyChanged(nameof(IsSelected));
        }
    }

    public WorkflowTemplate(string name, string description, string iconGlyph, string id,
                            string? shortDescription = null,
                            WorkflowActionType actionType = WorkflowActionType.Scan)
    {
        Name = name;
        Description = description;
        IconGlyph = iconGlyph;
        Id = id;
        ShortDescription = shortDescription ?? description;
        ActionType = actionType;
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
    public string ActionType { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string TimestampDisplay => Timestamp.ToString("HH:mm:ss");

    /// <summary>"Name (ActionType)" when an action type is recorded, else just the name.</summary>
    public string HistoryLabel =>
        string.IsNullOrEmpty(ActionType) ? WorkflowName : $"{WorkflowName} ({ActionType})";
}
