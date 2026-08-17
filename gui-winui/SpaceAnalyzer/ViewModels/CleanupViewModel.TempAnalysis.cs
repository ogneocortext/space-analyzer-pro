// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class CleanupViewModel
{
    public async Task AnalyzeTempAsync()
    {
        if (_disposed || IsAnalyzing || string.IsNullOrWhiteSpace(TargetPath))
            return;

        _cts.Dispose();
        _cts = new CancellationTokenSource();

        try
        {
            IsAnalyzing = true;
            StatusMessage = $"Scanning {TargetPath} for temp/cache entries...";
            TempEntries = new ObservableCollection<TempCleanupEntry>();

            var dir = new DirectoryInfo(TargetPath);
            if (!dir.Exists)
            {
                StatusMessage = "Target directory does not exist.";
                AppNotifications.Show("Cleanup", "Target directory does not exist");
                return;
            }

            var entries = new List<TempCleanupEntry>();
            await Task.Run(() =>
            {
                foreach (var fs in dir.EnumerateFileSystemInfos("*", SearchOption.TopDirectoryOnly))
                {
                    bool isDir = (fs.Attributes & FileAttributes.Directory) == FileAttributes.Directory;
                    entries.Add(new TempCleanupEntry
                    {
                        Path = fs.FullName,
                        IsDirectory = isDir,
                        SizeBytes = FileOperations.GetSize(fs.FullName),
                        LastWrite = fs.LastWriteTimeUtc,
                    });
                }
            }, _cts.Token);

            entries.Sort((a, b) => b.SizeBytes.CompareTo(a.SizeBytes));
            foreach (var e in entries)
                e.PropertyChanged += (_, _) =>
                {
                    OnPropertyChanged(nameof(TempSelectedCount));
                    OnPropertyChanged(nameof(TempHasSelection));
                    OnPropertyChanged(nameof(TempSelectedSizeDisplay));
                };
            TempEntries = new ObservableCollection<TempCleanupEntry>(entries);

            StatusMessage = $"Found {entries.Count} entries ({TempSelectedSizeDisplay} total). Select items to clean.";
            AppNotifications.Success("Temp scan complete", $"{entries.Count} entries found in {TargetPath}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CleanupViewModel] Temp analysis failed: {ex}");
            StatusMessage = $"Analysis failed: {ex.Message}";
            AppNotifications.Error("Temp analysis failed", ex.Message);
        }
        finally
        {
            IsAnalyzing = false;
        }
    }

    public async Task<string> DeleteSelectedTempAsync()
    {
        var selected = _tempEntries.Where(e => e.IsSelected).ToList();
        if (selected.Count == 0) return "Nothing selected.";

        int removed = 0;
        ulong freed = 0;
        await Task.Run(() =>
        {
            foreach (var e in selected)
            {
                if (FileOperations.SendToRecycleBin(e.Path))
                {
                    removed++;
                    freed += e.SizeBytes;
                }
            }
        });

        foreach (var e in selected.Where(x => !File.Exists(x.Path) && !Directory.Exists(x.Path)))
            _tempEntries.Remove(e);

        string summary = $"Moved {removed} item(s) ({ByteFormatter.FormatBytes(freed)}) to Recycle Bin.";
        StatusMessage = summary;
        OnPropertyChanged(nameof(TempSelectedCount));
        OnPropertyChanged(nameof(TempSelectedSizeDisplay));
        AppNotifications.Success("Temp cleanup complete", summary);
        return summary;
    }
}
