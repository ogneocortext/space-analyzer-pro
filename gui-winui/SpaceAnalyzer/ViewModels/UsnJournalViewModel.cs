// Licensed under the MIT License.

using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;

namespace SpaceAnalyzer.ViewModels;

/// <summary>
/// ViewModel for the USN Journal page. Surfaces NTFS change-journal status and
/// recent change records so the user can verify incremental-scan support.
/// </summary>
public class UsnJournalViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly ScannerService _scanner = new();
    private CancellationTokenSource _cts = new();
    private bool _disposed;

    private string _drive = "C:";
    public string Drive
    {
        get => _drive;
        set { _drive = value; OnPropertyChanged(); }
    }

    private int _maxChanges = 1000;
    public int MaxChanges
    {
        get => _maxChanges;
        set { _maxChanges = value; OnPropertyChanged(); }
    }

    private bool _isBusy;
    public bool IsBusy
    {
        get => _isBusy;
        set { _isBusy = value; OnPropertyChanged(); OnPropertyChanged(nameof(IsNotBusy)); }
    }
    public bool IsNotBusy => !_isBusy;

    private List<string> _volumes = new();
    public List<string> Volumes
    {
        get => _volumes;
        set { _volumes = value; OnPropertyChanged(); OnPropertyChanged(nameof(HasVolumes)); }
    }
    public bool HasVolumes => _volumes.Count > 0;

    private UsnJournalInfo? _journalInfo;
    public UsnJournalInfo? JournalInfo
    {
        get => _journalInfo;
        set
        {
            _journalInfo = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasJournalInfo));
        }
    }
    public bool HasJournalInfo => _journalInfo != null;

    // Null-safe scalar wrappers so x:Bind never dereferences a null journal object.
    public ulong JournalId => _journalInfo?.UsnJournalId ?? 0;
    public long JournalNextUsn => _journalInfo?.NextUsn ?? 0;
    public long JournalLowestUsn => _journalInfo?.LowestUsn ?? 0;
    public long JournalMaxUsn => _journalInfo?.MaxUsn ?? 0;
    public ulong JournalSize => _journalInfo?.JournalSize ?? 0;

    private ChangeSet? _changes;
    public ChangeSet? Changes
    {
        get => _changes;
        set
        {
            _changes = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasChanges));
            OnPropertyChanged(nameof(ChangeCount));
        }
    }
    public bool HasChanges => _changes != null && _changes.Changes.Count > 0;
    public int ChangeCount => _changes?.Changes.Count ?? 0;
    /// <summary>Null-safe list for the changes repeater.</summary>
    public List<UsnRecord> ChangeRecords => _changes?.Changes ?? new List<UsnRecord>();

    private string _statusMessage = "Ready.";
    public string StatusMessage
    {
        get => _statusMessage;
        set { _statusMessage = value; OnPropertyChanged(); }
    }

    public async Task RefreshVolumesAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        StatusMessage = "Enumerating USN journal volumes...";
        try
        {
            var vols = await _scanner.GetUsnVolumesAsync(CancellationToken.None);
            Volumes = vols ?? new List<string>();
            StatusMessage = Volumes.Count > 0
                ? $"Found {Volumes.Count} volume(s) with a USN journal."
                : "No USN journal volumes reported (NTFS/admin privileges required).";
        }
        catch (System.Exception ex)
        {
            StatusMessage = $"Volume enumeration failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task LoadStatusAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(Drive)) return;
        IsBusy = true;
        StatusMessage = $"Reading USN journal status for {Drive}...";
        try
        {
            var info = await _scanner.GetUsnStatusAsync(Drive, CancellationToken.None);
            JournalInfo = info;
            StatusMessage = info != null
                ? $"USN journal active on {Drive} (next USN {info.NextUsn})."
                : $"No USN journal info for {Drive}.";
        }
        catch (System.Exception ex)
        {
            StatusMessage = $"Status read failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task LoadChangesAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(Drive)) return;
        IsBusy = true;
        StatusMessage = $"Reading up to {MaxChanges} USN changes for {Drive}...";
        try
        {
            var set = await _scanner.GetUsnChangesAsync(Drive, MaxChanges, CancellationToken.None);
            Changes = set;
            StatusMessage = set != null
                ? $"Read {set.TotalChanges} change record(s) for {Drive}."
                : $"No change records returned for {Drive}.";
        }
        catch (System.Exception ex)
        {
            StatusMessage = $"Change read failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
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
