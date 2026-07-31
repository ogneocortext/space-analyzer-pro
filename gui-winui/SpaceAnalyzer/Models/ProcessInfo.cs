// Licensed under the MIT License.

using SpaceAnalyzer.Helpers;

namespace SpaceAnalyzer.Models;

/// <summary>
/// Lightweight process info for display in the System page and Dashboard.
/// </summary>
public class ProcessInfo
{
    public string Name { get; set; } = string.Empty;
    public int Id { get; set; }
    public ulong MemoryBytes { get; set; }
    public string MemoryDisplay => ByteFormatter.FormatBytes(MemoryBytes);
    public string PidDisplay => $"PID: {Id}";
}
