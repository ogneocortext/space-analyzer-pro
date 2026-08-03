// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;

namespace SpaceAnalyzer.Controls;

/// <summary>
/// Renders a tool call result as a readable summary instead of raw JSON.
/// Supports: run_scan, get_disk_volumes, get_storage_trend, predict_storage,
/// get_scan_summary, search_files, get_largest_files, and a generic fallback.
/// Use attached properties <see cref="ToolNameProperty"/> and <see cref="ToolResultProperty"/>
/// to bind data from XAML — the presenter renders automatically when both are set.
/// </summary>
public sealed partial class ToolResultPresenter : UserControl
{
    private static readonly SolidColorBrush s_accentBrush = new(ColorHelper.FromArgb(255, 0, 120, 212));
    private static readonly SolidColorBrush s_successBrush = new(ColorHelper.FromArgb(255, 16, 124, 16));
    private static readonly SolidColorBrush s_mutedBrush = new(ColorHelper.FromArgb(255, 128, 128, 128));
    private static readonly Brush s_dividerBrush = new SolidColorBrush(ColorHelper.FromArgb(255, 200, 200, 200));

    public static readonly DependencyProperty ToolNameProperty =
        DependencyProperty.RegisterAttached("ToolName", typeof(string), typeof(ToolResultPresenter),
            new PropertyMetadata(null, OnToolDataChanged));

    public static readonly DependencyProperty ToolResultProperty =
        DependencyProperty.RegisterAttached("ToolResult", typeof(string), typeof(ToolResultPresenter),
            new PropertyMetadata(null, OnToolDataChanged));

    public static string GetToolName(DependencyObject obj) => (string)obj.GetValue(ToolNameProperty);
    public static void SetToolName(DependencyObject obj, string value) => obj.SetValue(ToolNameProperty, value);
    public static string GetToolResult(DependencyObject obj) => (string)obj.GetValue(ToolResultProperty);
    public static void SetToolResult(DependencyObject obj, string value) => obj.SetValue(ToolResultProperty, value);

    private static void OnToolDataChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is ToolResultPresenter presenter)
            presenter.TryRender();
    }

    private void TryRender()
    {
        var toolName = (string)GetValue(ToolNameProperty);
        var result = (string)GetValue(ToolResultProperty);
        if (toolName != null && result != null)
            SetResult(toolName, result);
    }

    public ToolResultPresenter()
    {
        InitializeComponent();
    }

    /// <summary>
    /// Set the tool result data to display.
    /// </summary>
    public void SetResult(string toolName, string json)
    {
        Container.Children.Clear();
        if (string.IsNullOrWhiteSpace(json)) return;

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            switch (toolName)
            {
                case "run_scan":
                    RenderRunScan(root);
                    break;
                case "get_disk_volumes":
                    RenderDiskVolumes(root);
                    break;
                case "get_storage_trend":
                    RenderStorageTrend(root);
                    break;
                case "predict_storage":
                    RenderPredictStorage(root);
                    break;
                case "get_scan_summary":
                    RenderScanSummary(root);
                    break;
                case "get_largest_files":
                    RenderLargestFiles(root);
                    break;
                case "search_files":
                    RenderSearchFiles(root);
                    break;
                case "get_file_type_breakdown":
                    RenderFileTypeBreakdown(root);
                    break;
                case "preview_impact":
                    RenderPreviewImpact(root);
                    break;
                default:
                    RenderGeneric(root);
                    break;
            }
        }
        catch
        {
            // If JSON parsing fails, show as formatted text
            AddTextBlock(json, wrap: true);
        }
    }

    // ── run_scan ──

    private void RenderRunScan(JsonElement root)
    {
        // Summary stats row
        var stats = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16 };
        if (root.TryGetProperty("total_files", out var tf))
            stats.Children.Add(CreateStatBadge($"{tf.GetInt64():N0}", "files"));
        if (root.TryGetProperty("total_size_gb", out var ts))
            stats.Children.Add(CreateStatBadge($"{ts.GetDouble():F1}", "GB"));
        if (root.TryGetProperty("total_dirs", out var td))
            stats.Children.Add(CreateStatBadge($"{td.GetInt64():N0}", "dirs"));
        if (root.TryGetProperty("duration_secs", out var dur))
            stats.Children.Add(CreateStatBadge($"{dur.GetDouble():F1}", "s"));
        Container.Children.Add(stats);

        // Top directories — bar chart
        if (root.TryGetProperty("top_directories", out var dirs) && dirs.GetArrayLength() > 0)
        {
            Container.Children.Add(CreateSectionHeader("Top Directories"));
            var barData = new List<(string, double, string?)>();
            foreach (var dir in dirs.EnumerateArray().Take(8))
            {
                var path = dir.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
                var size = dir.TryGetProperty("size_gb", out var s) ? s.GetDouble() : 0;
                var name = System.IO.Path.GetFileName(path) ?? path;
                barData.Add((name, size, $"{size:F1} GB"));
            }
            Container.Children.Add(LiveChartsFactory.CreateBarChart(barData));
        }

        // Largest files — bar chart
        if (root.TryGetProperty("largest_files", out var files2) && files2.GetArrayLength() > 0)
        {
            Container.Children.Add(CreateSectionHeader("Largest Files"));
            var barData = new List<(string, double, string?)>();
            foreach (var f in files2.EnumerateArray().Take(8))
            {
                var path = f.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
                var size = f.TryGetProperty("size_mb", out var s) ? s.GetDouble() : 0;
                var name = System.IO.Path.GetFileName(path) ?? path;
                barData.Add((name, size, $"{size:F1} MB"));
            }
            Container.Children.Add(LiveChartsFactory.CreateBarChart(barData));
        }

        // File types — donut chart
        if (root.TryGetProperty("file_types", out var types) && types.GetArrayLength() > 0)
        {
            Container.Children.Add(CreateSectionHeader("File Types"));
            var donutData = new List<(string, double)>();
            foreach (var t in types.EnumerateArray().Take(8))
            {
                var ext = t.TryGetProperty("extension", out var e) ? e.GetString() ?? "" : "";
                var count = t.TryGetProperty("count", out var c) ? c.GetInt64() : 0;
                donutData.Add((ext, count));
            }
            Container.Children.Add(LiveChartsFactory.CreateDonutChart(donutData));
        }

        // Errors
        if (root.TryGetProperty("errors", out var errs) && errs.GetArrayLength() > 0)
        {
            Container.Children.Add(CreateSectionHeader("Errors", isError: true));
            foreach (var err in errs.EnumerateArray().Take(3))
                AddTextBlock(err.GetString() ?? "", foreground: s_mutedBrush);
        }
    }

    // ── get_disk_volumes ──

    private void RenderDiskVolumes(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Array) { RenderGeneric(root); return; }

        foreach (var vol in root.EnumerateArray())
        {
            var mount = vol.TryGetProperty("mount_point", out var mp) ? mp.GetString() ?? "" : "";
            var label = vol.TryGetProperty("label", out var lb) ? lb.GetString() ?? "" : "";
            var total = vol.TryGetProperty("total_bytes", out var tb) ? tb.GetInt64() : 0;
            var avail = vol.TryGetProperty("available_bytes", out var ab) ? ab.GetInt64() : 0;
            var used = total - avail;
            var pct = total > 0 ? (double)used / total * 100 : 0;

            var header = string.IsNullOrEmpty(label) ? mount : $"{label} ({mount})";

            // Volume card with gauge
            var card = new StackPanel { Spacing = 4, Margin = new Thickness(0, 4, 0, 4) };
            card.Children.Add(new TextBlock
            {
                Text = header,
                Style = (Style)Application.Current.Resources["BodyStrongTextBlockStyle"],
                Foreground = s_accentBrush,
            });

            var gaugeRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
            gaugeRow.Children.Add(LiveChartsFactory.CreateGauge(pct, $"{FormatBytes(used)} / {FormatBytes(total)}"));

            // Side info
            var info = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Spacing = 4 };
            info.Children.Add(new TextBlock
            {
                Text = $"{pct:F1}% used",
                Style = (Style)Application.Current.Resources["BodyStrongTextBlockStyle"],
            });
            info.Children.Add(new TextBlock
            {
                Text = $"{FormatBytes(avail)} free",
                Style = (Style)Application.Current.Resources["CaptionTextBlockStyle"],
                Foreground = s_mutedBrush,
            });
            gaugeRow.Children.Add(info);

            card.Children.Add(gaugeRow);
            Container.Children.Add(card);
        }
    }

    // ── get_storage_trend ──

    private void RenderStorageTrend(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Array) { RenderGeneric(root); return; }

        var entries = root.EnumerateArray().ToList();
        if (entries.Count == 0) { AddTextBlock("No scan history available."); return; }

        Container.Children.Add(CreateSectionHeader($"Last {entries.Count} scans"));

        // Sparkline chart
        var sparkData = new List<(string, double)>();
        foreach (var entry in entries)
        {
            var ts = entry.TryGetProperty("timestamp", out var t) ? t.GetString() ?? "" : "";
            var sizeBytes = entry.TryGetProperty("total_size_gb", out var s) ? s.GetDouble() * 1024 * 1024 * 1024 : 0;
            var shortTs = DateTime.TryParse(ts, out var dt) ? dt.ToString("MM/dd") : ts;
            sparkData.Add((shortTs, sizeBytes));
        }
        Container.Children.Add(LiveChartsFactory.CreateSparkline(sparkData));

        // Also show the table below
        foreach (var entry in entries.Take(10))
        {
            var ts = entry.TryGetProperty("timestamp", out var t) ? t.GetString() ?? "" : "";
            var sizeGb = entry.TryGetProperty("total_size_gb", out var s) ? s.GetDouble() : 0;
            var files = entry.TryGetProperty("total_files", out var f) ? f.GetInt64() : 0;
            var shortTs = DateTime.TryParse(ts, out var dt) ? dt.ToString("MM/dd HH:mm") : ts;

            Container.Children.Add(CreateItemRow(
                shortTs,
                $"{sizeGb:F1} GB",
                $"{files:N0} files"));
        }
    }

    // ── predict_storage ──

    private void RenderPredictStorage(JsonElement root)
    {
        var current = root.TryGetProperty("current_size_gb", out var c) ? c.GetDouble() : 0;
        var predicted = root.TryGetProperty("predicted_size_gb", out var p) ? p.GetDouble() : 0;
        var days = root.TryGetProperty("days_ahead", out var d) ? d.GetInt32() : 0;
        var rate = root.TryGetProperty("growth_rate_gb_per_day", out var r) ? r.GetDouble() : 0;

        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16 };
        row.Children.Add(CreateStatBadge($"{current:F1}", "GB now"));
        row.Children.Add(CreateStatBadge($"+{predicted - current:F1}", $"GB in {days} days"));
        row.Children.Add(CreateStatBadge($"{rate:F2}", "GB/day"));
        Container.Children.Add(row);

        if (predicted > current * 1.1)
        {
            AddTextBlock("Storage is growing. Consider running a cleanup scan.",
                foreground: new SolidColorBrush(ColorHelper.FromArgb(255, 255, 152, 0)));
        }
    }

    // ── get_scan_summary ──

    private void RenderScanSummary(JsonElement root)
    {
        var path = root.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
        var files = root.TryGetProperty("total_files", out var f) ? f.GetInt64() : 0;
        var sizeGb = root.TryGetProperty("total_size_gb", out var s) ? s.GetDouble() : 0;
        var ts = root.TryGetProperty("timestamp", out var t) ? t.GetString() ?? "" : "";
        var dur = root.TryGetProperty("duration_secs", out var d) ? d.GetDouble() : 0;

        var stats = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16 };
        stats.Children.Add(CreateStatBadge($"{files:N0}", "files"));
        stats.Children.Add(CreateStatBadge($"{sizeGb:F1}", "GB"));
            stats.Children.Add(CreateStatBadge($"{dur:F1}", "s"));
        Container.Children.Add(stats);

        if (!string.IsNullOrEmpty(path))
            AddTextBlock($"Path: {path}", foreground: s_mutedBrush);
        if (!string.IsNullOrEmpty(ts))
            AddTextBlock($"Scanned: {ts}", foreground: s_mutedBrush);
    }

    // ── get_largest_files / search_files ──

    private void RenderLargestFiles(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (var f in root.EnumerateArray().Take(10))
            {
                var path = f.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
                var size = f.TryGetProperty("size", out var s) ? s.GetInt64() : 0;
                if (size == 0 && f.TryGetProperty("size_mb", out var sm))
                    size = (long)(sm.GetDouble() * 1024 * 1024);
                Container.Children.Add(CreateItemRow(
                    System.IO.Path.GetFileName(path) ?? path,
                    FormatBytes(size),
                    TruncatePath(path)));
            }
        }
        else
        {
            RenderGeneric(root);
        }
    }

    private void RenderSearchFiles(JsonElement root) => RenderLargestFiles(root);

    // ── get_file_type_breakdown ──

    private void RenderFileTypeBreakdown(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array)
        {
            var donutData = new List<(string, double)>();
            foreach (var t in root.EnumerateArray().Take(10))
            {
                var ext = t.TryGetProperty("extension", out var e) ? e.GetString() ?? "" : "";
                var count = t.TryGetProperty("count", out var c) ? c.GetInt64() : 0;
                donutData.Add((ext, count));
            }
            Container.Children.Add(LiveChartsFactory.CreateDonutChart(donutData));
        }
        else
        {
            RenderGeneric(root);
        }
    }

    // ── preview_impact ──

    private void RenderPreviewImpact(JsonElement root)
    {
        var path = root.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
        var sizeMb = root.TryGetProperty("size_mb", out var s) ? s.GetDouble() : 0;
        var hardlinks = root.TryGetProperty("hardlink_count", out var h) ? h.GetInt32() : 1;
        var siblings = root.TryGetProperty("sibling_files_same_size", out var sf) ? sf.GetInt32() : 0;
        var impact = root.TryGetProperty("impact", out var i) ? i.GetString() ?? "" : "";

        var stats = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16 };
        stats.Children.Add(CreateStatBadge($"{sizeMb:F1}", "MB"));
        if (hardlinks > 1)
            stats.Children.Add(CreateStatBadge($"{hardlinks}", "hardlinks"));
        if (siblings > 0)
            stats.Children.Add(CreateStatBadge($"{siblings}", "similar files"));
        Container.Children.Add(stats);

        AddTextBlock(path, foreground: s_mutedBrush);
        if (!string.IsNullOrEmpty(impact))
            AddTextBlock(impact, wrap: true);
    }

    // ── Generic fallback ──

    private void RenderGeneric(JsonElement root)
    {
        var text = root.ValueKind == JsonValueKind.Object || root.ValueKind == JsonValueKind.Array
            ? JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true })
            : root.GetRawText();
        AddTextBlock(text, wrap: true, fontUri: "CascadiaMono");
    }

    // ── Helpers ──

    private static Border CreateStatBadge(string value, string label)
    {
        var sp = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        sp.Children.Add(new TextBlock
        {
            Text = value,
            Style = (Style)Application.Current.Resources["BodyStrongTextBlockStyle"],
            Foreground = s_accentBrush,
        });
        sp.Children.Add(new TextBlock
        {
            Text = label,
            Style = (Style)Application.Current.Resources["CaptionTextBlockStyle"],
            VerticalAlignment = Microsoft.UI.Xaml.VerticalAlignment.Bottom,
        });

        return new Border
        {
            Background = new SolidColorBrush(ColorHelper.FromArgb(25, 0, 120, 212)),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(10, 4, 10, 4),
            Child = sp,
        };
    }

    private static TextBlock CreateSectionHeader(string text, bool isError = false)
    {
        return new TextBlock
        {
            Text = text,
            Style = (Style)Application.Current.Resources["BodyStrongTextBlockStyle"],
            Foreground = isError
                ? new SolidColorBrush(ColorHelper.FromArgb(255, 196, 43, 28))
                : (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"],
            Margin = new Thickness(0, 8, 0, 2),
        };
    }

    private static Grid CreateItemRow(string primary, string secondary, string tertiary)
    {
        var grid = new Grid
        {
            Padding = new Thickness(8, 4, 8, 4),
            Background = new SolidColorBrush(ColorHelper.FromArgb(15, 0, 0, 0)),
            CornerRadius = new CornerRadius(4),
        };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(0, GridUnitType.Auto) });
        if (!string.IsNullOrEmpty(tertiary))
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(2, GridUnitType.Star) });

        var primaryBlock = new TextBlock
        {
            Text = primary,
            Style = (Style)Application.Current.Resources["BodyTextBlockStyle"],
            TextTrimming = TextTrimming.CharacterEllipsis,
            VerticalAlignment = Microsoft.UI.Xaml.VerticalAlignment.Center,
        };
        Grid.SetColumn(primaryBlock, 0);
        grid.Children.Add(primaryBlock);

        var secondaryBlock = new TextBlock
        {
            Text = secondary,
            Style = (Style)Application.Current.Resources["CaptionTextBlockStyle"],
            Foreground = s_accentBrush,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = Microsoft.UI.Xaml.VerticalAlignment.Center,
            Margin = new Thickness(12, 0, 0, 0),
        };
        Grid.SetColumn(secondaryBlock, 1);
        grid.Children.Add(secondaryBlock);

        if (!string.IsNullOrEmpty(tertiary))
        {
            var tertiaryBlock = new TextBlock
            {
                Text = tertiary,
                Style = (Style)Application.Current.Resources["CaptionTextBlockStyle"],
                Foreground = s_mutedBrush,
                TextTrimming = TextTrimming.CharacterEllipsis,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = Microsoft.UI.Xaml.VerticalAlignment.Center,
                Margin = new Thickness(12, 0, 0, 0),
            };
            Grid.SetColumn(tertiaryBlock, 2);
            grid.Children.Add(tertiaryBlock);
        }

        return grid;
    }

    private void AddTextBlock(string text, bool wrap = false, Brush? foreground = null, string? fontUri = null)
    {
        var tb = new TextBlock
        {
            Text = text,
            TextWrapping = wrap ? TextWrapping.Wrap : TextWrapping.NoWrap,
            TextTrimming = wrap ? TextTrimming.None : TextTrimming.CharacterEllipsis,
            Style = (Style)Application.Current.Resources["BodyTextBlockStyle"],
        };
        if (foreground != null) tb.Foreground = foreground;
        if (fontUri == "CascadiaMono")
        {
            tb.FontFamily = new FontFamily("Cascadia Mono, Consolas");
            tb.FontSize = 12;
        }
        Container.Children.Add(tb);
    }

    private static string FormatBytes(long bytes)
    {
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double size = bytes;
        int unit = 0;
        while (size >= 1024 && unit < units.Length - 1) { size /= 1024; unit++; }
        return $"{size:F1} {units[unit]}";
    }

    private static string FormatBytes(double bytes) => FormatBytes((long)bytes);

    private static string TruncatePath(string path)
    {
        if (path.Length <= 50) return path;
        return "..." + path[^47..];
    }
}
