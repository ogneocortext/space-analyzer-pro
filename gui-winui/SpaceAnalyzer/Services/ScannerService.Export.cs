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
    public async Task<string> ExportScanResultAsync(ScanResult result, string outputPath, string format = "json", CancellationToken ct = default)
    {
        format = format.ToLowerInvariant() switch
        {
            "csv" => "csv",
            "md" or "markdown" => "md",
            "html" or "htm" => "html",
            _ => "json",
        };

        var content = format switch
        {
            "csv" => SerializeToCsv(result),
            "md" => SerializeToMarkdown(result),
            "html" => SerializeToHtml(result),
            _ => JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }),
        };

        await File.WriteAllTextAsync(outputPath, content, ct);
        return outputPath;
    }

    private static string SerializeToCsv(ScanResult result)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Path,SizeBytes,SizeDisplay,Modified");
        foreach (var kvp in (result.ScannedFiles ?? new()).OrderByDescending(kv => kv.Value.Size))
        {
            var modified = FormatUnixSeconds(kvp.Value.Mtime);
            var path = kvp.Key.Replace("\"", "\"\"");
            sb.AppendLine($"\"{path}\",{kvp.Value.Size},\"{ByteFormatter.FormatBytes(kvp.Value.Size)}\",\"{modified}\"");
        }
        return sb.ToString();
    }

    /// <summary>
    /// Formats a Unix epoch-seconds timestamp, tolerating values outside the
    /// <see cref="DateTimeOffset"/> range (the Rust backend stores mtime as an
    /// <c>i64</c>, which can be negative or larger than year 9999). Returns an
    /// empty string for unrepresentable values instead of throwing.
    /// </summary>
    private static string FormatUnixSeconds(long seconds)
    {
        try { return DateTimeOffset.FromUnixTimeSeconds(seconds).ToString("o"); }
        catch (ArgumentOutOfRangeException) { return string.Empty; }
    }

    private static string SerializeToMarkdown(ScanResult result)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"# Space Analyzer Scan: {result.Path}\n");
        sb.AppendLine($"- **Files:** {result.TotalFiles:N0}");
        sb.AppendLine($"- **Total Size:** {ByteFormatter.FormatBytes(result.TotalSizeBytes)}");
        sb.AppendLine($"- **Duration:** {result.DurationSecs:F1}s\n");
        sb.AppendLine("## Largest Files\n");
        sb.AppendLine("| Size | Path |");
        sb.AppendLine("|------|------|");
        foreach (var f in (result.LargestFiles ?? new()).Take(50))
        {
            var path = f.Path.Replace("|", "\\|");
            sb.AppendLine($"| {f.SizeDisplay} | `{path}` |");
        }
        return sb.ToString();
    }

    private static string SerializeToHtml(ScanResult result)
    {
        var esc = (string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html lang=\"en\"><head><meta charset=\"utf-8\">");
        sb.AppendLine($"<title>Space Analyzer Scan: {esc(result.Path)}</title>");
        sb.AppendLine("<style>body{font-family:Segoe UI,system-ui,sans-serif;margin:2rem;color:#1b1b1b}");
        sb.AppendLine("table{border-collapse:collapse;width:100%;margin-top:1rem}");
        sb.AppendLine("th,td{border:1px solid #d0d0d0;padding:.4rem .6rem;text-align:left}");
        sb.AppendLine("th{background:#f3f3f3}td.size{text-align:right;font-variant-numeric:tabular-nums}</style>");
        sb.AppendLine("</head><body>");
        sb.AppendLine($"<h1>Space Analyzer Scan: {esc(result.Path)}</h1>");
        sb.AppendLine("<ul>");
        sb.AppendLine($"<li><strong>Files:</strong> {result.TotalFiles:N0}</li>");
        sb.AppendLine($"<li><strong>Total Size:</strong> {ByteFormatter.FormatBytes(result.TotalSizeBytes)}</li>");
        sb.AppendLine($"<li><strong>Duration:</strong> {result.DurationSecs:F1}s</li>");
        sb.AppendLine("</ul>");
        sb.AppendLine("<h2>Largest Files</h2>");
        sb.AppendLine("<table><thead><tr><th>Size</th><th>Path</th></tr></thead><tbody>");
        foreach (var f in (result.LargestFiles ?? new()).Take(50))
            sb.AppendLine($"<tr><td class=\"size\">{f.SizeDisplay}</td><td>{esc(f.Path)}</td></tr>");
        sb.AppendLine("</tbody></table>");
        sb.AppendLine("</body></html>");
        return sb.ToString();
    }

    /// <summary>
    /// Get disk space info for all volumes.
    /// </summary>
}
