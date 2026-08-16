// Licensed under the MIT License.

namespace SpaceAnalyzer.Controls.ScanBreakdown;

/// <summary>
/// Carries the requested sort column from <see cref="LargestFilesControl"/> to its host.
/// Column 1 = size, 2 = name (mirrors <c>HistoryViewModel.ToggleFileSort</c>).
/// </summary>
public sealed class SortRequestedEventArgs : System.EventArgs
{
    public int Column { get; }

    public SortRequestedEventArgs(int column)
    {
        Column = column;
    }
}
