// Licensed under the MIT License.
// Headless stub of the WinUI-coupled DiskVolume model, exposing only the
// properties ScannerService references (in the unused GetFallbackVolumes path).
// Keeps the test project WinUI-free.
namespace SpaceAnalyzer.Models;

public class DiskVolume
{
    public string MountPoint { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public ulong TotalBytes { get; set; }
    public ulong AvailableBytes { get; set; }
    public string FileSystem { get; set; } = string.Empty;
}
