// Licensed under the MIT License.

using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

public partial class DuplicatesViewModel
{
    private bool _isRemoving;
    public bool IsRemoving
    {
        get => _isRemoving;
        set { _isRemoving = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotRemoving)); }
    }
    public bool IsNotRemoving => !_isRemoving;

    public async Task RemoveSelectedAsync()
    {
        if (_lastResult == null) return;
        var groups = _lastResult.DuplicateGroups
            .Where(g => g.IsSelected && g.Files.Count > 1)
            .ToList();
        if (groups.Count == 0) return;

        IsRemoving = true;
        int removed = 0;
        ulong freed = 0;
        try
        {
            foreach (var g in groups)
            {
                for (int i = 1; i < g.Files.Count; i++)
                {
                    var file = g.Files[i];
                    try
                    {
                        if (File.Exists(file) && FileOperations.SendToRecycleBin(file))
                        {
                            removed++;
                            freed += g.Size;
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[DuplicatesViewModel] recycle failed {file}: {ex}");
                    }
                }
            }

            StatusMessage = $"Sent {removed} duplicate copies to the Recycle Bin ({ByteFormatter.FormatBytes(freed)} reclaimable)";
            AppNotifications.Success("Duplicates removed", $"{removed} duplicate copies moved to the Recycle Bin");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Removal failed: {ex.Message}";
            AppNotifications.Error("Duplicate removal failed", ex.Message);
        }
        finally
        {
            IsRemoving = false;
        }

        if (removed > 0)
            FilesSentToRecycleBin?.Invoke(this, removed);

        await AnalyzeAsync();
    }
}
