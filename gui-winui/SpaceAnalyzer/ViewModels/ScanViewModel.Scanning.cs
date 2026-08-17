// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class ScanViewModel
{
    private void HandleStreamingProgress(StreamProgress progress)
    {
        var now = DateTime.UtcNow;
        if (_lastProgressUpdate != default
            && now - _lastProgressUpdate < TimeSpan.FromMilliseconds(150)
            && Math.Abs(progress.Percentage - _scanProgress) < 1.0)
            return;
        _lastProgressUpdate = now;

        StatusMessage = $"Scanning: {progress.CurrentFile}";
        UpdatePartialResult(progress);
    }

    private void UpdatePartialResult(StreamProgress progress)
    {
        if (!_isStreaming)
            return;

        ScanProgress = progress.Percentage;
        _currentFile = progress.CurrentFile;
        var elapsed = (DateTime.UtcNow - _scanStartTime).TotalSeconds;

        var partial = new ScanResult
        {
            TotalFiles = (long)progress.FilesScanned,
            TotalSizeBytes = progress.TotalSize,
            TotalSizeMb = progress.TotalSize / (1024.0 * 1024.0),
            DurationSecs = elapsed,
            Path = ScanPath,
            TotalDirs = progress.DirectoriesScanned,
            Errors = new List<string>(),
            FileTypes = progress.FileTypes.ToDictionary(kvp => kvp.Key, kvp => (long)kvp.Value),
            ExtensionSizes = new Dictionary<string, ulong>(progress.ExtensionSizes),
            CategorySizes = new Dictionary<string, ulong>(progress.CategorySizes),
        };

        partial.LargestFiles = progress.LiveFiles
            .OrderByDescending(f => f.Size)
            .Select(f => new FileSizeEntry { Path = f.Path, Size = f.Size })
            .ToList();

        _partialResult = partial;

        OnPropertyChanged(nameof(ActiveResult));
        OnPropertyChanged(nameof(HasActiveResult));
        OnPropertyChanged(nameof(HasActiveResultVisibility));
        OnPropertyChanged(nameof(LiveFilesDisplay));
        OnPropertyChanged(nameof(LiveSizeDisplay));
        OnPropertyChanged(nameof(ResultFilesDisplay));
        OnPropertyChanged(nameof(ResultSizeDisplay));
        OnPropertyChanged(nameof(ResultDurationDisplay));
        OnPropertyChanged(nameof(ResultDirsDisplay));
        OnPropertyChanged(nameof(ResultAvgFileSizeDisplay));
        OnPropertyChanged(nameof(ResultSpeedDisplay));
        OnPropertyChanged(nameof(ResultSpeedMbDisplay));
        OnPropertyChanged(nameof(ResultErrorsDisplay));
        OnPropertyChanged(nameof(TopDirectories));
        OnPropertyChanged(nameof(FileTypes));
        OnPropertyChanged(nameof(CategoryDistributions));
        OnPropertyChanged(nameof(LargestFiles));
        OnPropertyChanged(nameof(PotentialCleanupDisplay));
        OnPropertyChanged(nameof(ResultTimestampDisplay));
        OnPropertyChanged(nameof(HasScanErrors));
        OnPropertyChanged(nameof(EmptyDirs));
        OnPropertyChanged(nameof(EmptyDirsCount));
        OnPropertyChanged(nameof(HasEmptyDirs));
        OnPropertyChanged(nameof(FilteredLargestFiles));
        OnPropertyChanged(nameof(LastSavedHistoryId));
        OnPropertyChanged(nameof(HasSavedHistory));
        OnPropertyChanged(nameof(HasSavedHistoryVisibility));
    }

    public async Task ScanAsync(CancellationToken ct = default)
    {
        if (IsScanning)
        {
            StatusMessage = "Scan already in progress";
            return;
        }

        if (string.IsNullOrWhiteSpace(ScanPath))
        {
            StatusMessage = "No path specified";
            return;
        }

        if (!Directory.Exists(ScanPath))
        {
            StatusMessage = $"Scan path does not exist: {ScanPath}";
            return;
        }

        try
        {
            IsScanning = true;
            IsStreaming = true;
            _scanStartTime = DateTime.UtcNow;
            StatusMessage = "Scanning...";
            ScanProgress = 0;
            LastResult = null;
            LastSavedHistoryId = null;
            _partialResult = null;

            var progress = new Progress<StreamProgress>(HandleStreamingProgress);

            var result = await _scanner.ScanDirectoryStreamingAsync(
                ScanPath,
                depthMode: SelectedDepthMode,
                maxDepth: DepthInt,
                includeHidden: IncludeHidden,
                onProgress: progress,
                ct: ct,
                saveToHistory: true);

            LastResult = result;
            LastSavedHistoryId = _scanner.LastSavedHistoryId;
            if (result != null)
            {
                StatusMessage = $"Scan complete: {result.TotalFiles:N0} files, {result.TotalSizeMb:F1} MB, {result.DurationSecs:F1}s";
            }
            else
            {
                StatusMessage = "Scan completed with no result.";
            }
        }
        catch (OperationCanceledException)
        {
            StatusMessage = "Scan cancelled.";
            LastResult = null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScanViewModel] Scan failed: {ex}");
            StatusMessage = $"Scan failed: {ex.Message}";
        }
        finally
        {
            IsScanning = false;
            IsStreaming = false;
            ScanProgress = 0;
            _partialResult = null;
            _currentFile = string.Empty;
            _scanStartTime = default;
            OnPropertyChanged(nameof(ActiveResult));
            OnPropertyChanged(nameof(HasActiveResult));
            OnPropertyChanged(nameof(HasActiveResultVisibility));
            OnPropertyChanged(nameof(LiveFilesDisplay));
            OnPropertyChanged(nameof(LiveSizeDisplay));
            OnPropertyChanged(nameof(ResultFilesDisplay));
            OnPropertyChanged(nameof(ResultSizeDisplay));
            OnPropertyChanged(nameof(ResultDurationDisplay));
            OnPropertyChanged(nameof(ResultDirsDisplay));
            OnPropertyChanged(nameof(ResultAvgFileSizeDisplay));
            OnPropertyChanged(nameof(ResultSpeedDisplay));
            OnPropertyChanged(nameof(ResultSpeedMbDisplay));
            OnPropertyChanged(nameof(ResultErrorsDisplay));
            OnPropertyChanged(nameof(TopDirectories));
            OnPropertyChanged(nameof(FileTypes));
            OnPropertyChanged(nameof(CategoryDistributions));
            OnPropertyChanged(nameof(LargestFiles));
            OnPropertyChanged(nameof(PotentialCleanupDisplay));
            OnPropertyChanged(nameof(ResultTimestampDisplay));
            OnPropertyChanged(nameof(HasScanErrors));
            OnPropertyChanged(nameof(EmptyDirs));
            OnPropertyChanged(nameof(EmptyDirsCount));
            OnPropertyChanged(nameof(HasEmptyDirs));
            OnPropertyChanged(nameof(FilteredLargestFiles));
        }
    }

    public void StopScan()
    {
        if (!IsScanning) return;
        _scanner.StopScan();
        StatusMessage = "Stopping scan...";
    }

    public async Task<string> ExportResultsAsync(string outputPath, CancellationToken ct = default)
    {
        if (LastResult == null)
            throw new InvalidOperationException("No scan result to export.");

        return await _scanner.ExportScanResultAsync(LastResult, outputPath, ExportFormat, ct);
    }

    private string _exportFormat = "json";
    public string ExportFormat
    {
        get => _exportFormat;
        set { _exportFormat = value; OnPropertyChanged(); }
    }

    public ObservableCollection<string> ExportFormats { get; } = new() { "json", "csv", "md", "html" };

    public string ExportFormatDisplay => ExportFormat.ToUpperInvariant();
}
