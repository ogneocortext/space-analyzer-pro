// Licensed under the MIT License.

namespace SpaceAnalyzer.Models;

/// <summary>
/// A single search result for the Smart Search page.
/// </summary>
public class SmartSearchResult
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ulong SizeBytes { get; set; }
    public string SizeDisplay { get; set; } = string.Empty;
}
