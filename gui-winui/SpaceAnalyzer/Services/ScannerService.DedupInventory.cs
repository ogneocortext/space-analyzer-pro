// Licensed under the MIT License.
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;

namespace SpaceAnalyzer.Services;

public partial class ScannerService
{
    public async Task<DedupResult?> RunDedupAnalysisAsync(
        string path,
        CancellationToken ct = default,
        bool apply = false,
        bool? useGpu = null,
        long? linkScanId = null)
    {
        if (!IsAvailable)
            return null;

        var argList = new List<string> { "dedup", "--path", path, "--format", "json" };
        if (linkScanId.HasValue)
            argList.AddRange(new[] { "--scan-id", linkScanId.Value.ToString(System.Globalization.CultureInfo.InvariantCulture) });
        if (apply)
        {
            argList.Add("--apply");
            // The backend refuses to modify any files without --yes in non-interactive
            // mode, so it must be supplied for an apply to actually create hard links.
            argList.Add("--yes");
        }
        if (!(useGpu ?? GpuAcceleration))
            argList.Add("--no-gpu");

        int scanId = ScanActivityMonitor.Instance.BeginScan(path);
        try
        {
            var output = await RunScannerAsync(argList, ct);
            try
            {
                return JsonSerializer.Deserialize<DedupResult>(output, s_jsonOptions);
            }
            catch (JsonException jex)
            {
                throw new Exception($"Failed to parse dedup result: {jex.Message}. Output: {Truncate(output)}", jex);
            }
        }
        finally
        {
            ScanActivityMonitor.Instance.EndScan(scanId);
        }
    }

    /// <summary>
    /// Enumerate installed applications and dev tools, then detect installs that are
    /// duplicated across drives/paths or present in multiple versions. Reads the
    /// Windows registry uninstall keys plus package-manager / toolchain roots.
    /// </summary>
    public async Task<AppInventoryReport?> RunAppInventoryAsync(CancellationToken ct = default)
    {
        if (!IsAvailable)
            return null;

        var output = await RunScannerAsync(new[] { "app-inventory", "--format", "json" }, ct);
        try
        {
            return JsonSerializer.Deserialize<AppInventoryReport>(output, s_jsonOptions);
        }
        catch (JsonException jex)
        {
            throw new Exception($"Failed to parse app-inventory result: {jex.Message}. Output: {Truncate(output)}", jex);
        }
    }

    /// <summary>
    /// Remove scan records that captured nothing (zero files) via
    /// <c>history --prune-empty</c>. Returns the number removed.
    /// </summary>
}
