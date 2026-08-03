// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using LiveChartsCore;
using LiveChartsCore.Defaults;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using LiveChartsCore.SkiaSharpView.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SkiaSharp;

namespace SpaceAnalyzer.Controls;

/// <summary>
/// Factory methods for creating LiveCharts2 controls programmatically.
/// Used by <see cref="ToolResultPresenter"/> to render charts in tool result messages.
/// </summary>
public static class LiveChartsFactory
{
    private static readonly SKColor[] s_palette =
    [
        new(0, 120, 212),     // blue
        new(16, 124, 16),     // green
        new(255, 152, 0),     // orange
        new(196, 43, 28),     // red
        new(156, 39, 176),    // purple
        new(0, 150, 136),     // teal
        new(233, 30, 99),     // pink
        new(255, 193, 7),     // amber
        new(63, 81, 181),     // indigo
        new(121, 85, 72),     // brown
    ];

    // ── Bar Chart ──

    public static FrameworkElement CreateBarChart(
        IEnumerable<(string Label, double Value, string? DisplayText)> items)
    {
        var list = items.ToList();
        if (list.Count == 0) return new TextBlock { Text = "No data" };

        var series = new ISeries[list.Count];
        for (int i = 0; i < list.Count; i++)
        {
            series[i] = new ColumnSeries<double>
            {
                Values = [list[i].Value],
                Name = $"{list[i].Label} — {FormatBytes(list[i].Value)}",
                Fill = new SolidColorPaint(s_palette[i % s_palette.Length]),
                MaxBarWidth = 20,
                Rx = 4,
                Ry = 4,
            };
        }

        var labels = list.Select(x => TruncateLabel(x.Label, 18)).ToArray();

        var chart = new CartesianChart
        {
            Series = series,
            Height = Math.Max(140, list.Count * 32 + 40),
            Width = 380,
            XAxes =
            [
                new Axis
                {
                    Labels = labels,
                    LabelsRotation = 0,
                    TextSize = 11,
                    SeparatorsPaint = new SolidColorPaint(new SKColor(230, 230, 230)),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 11,
                    SeparatorsPaint = new SolidColorPaint(new SKColor(230, 230, 230)),
                    Labeler = FormatCompact,
                }
            ],
        };

        return chart;
    }

    // ── Donut Chart ──

    public static FrameworkElement CreateDonutChart(IEnumerable<(string Label, double Value)> items)
    {
        var list = items.ToList();
        if (list.Count == 0) return new TextBlock { Text = "No data" };

        var series = new ISeries[list.Count];
        for (int i = 0; i < list.Count; i++)
        {
            series[i] = new PieSeries<double>
            {
                Values = [list[i].Value],
                Name = $"{list[i].Label} — {FormatBytes(list[i].Value)}",
                Fill = new SolidColorPaint(s_palette[i % s_palette.Length]),
                InnerRadius = 50,
            };
        }

        var chart = new PieChart
        {
            Series = series,
            Width = 360,
            Height = 200,
        };

        return chart;
    }

    // ── Sparkline ──

    public static FrameworkElement CreateSparkline(IEnumerable<(string Label, double Value)> items)
    {
        var list = items.ToList();
        if (list.Count < 2) return new TextBlock { Text = "Insufficient data" };

        var values = list.Select(x => new ObservableValue(x.Value)).ToArray();

        var series = new ISeries[]
        {
            new LineSeries<ObservableValue>
            {
                Values = values,
                Fill = new SolidColorPaint(new SKColor(0, 120, 212, 60)),
                Stroke = new SolidColorPaint(new SKColor(0, 120, 212)) { StrokeThickness = 2 },
                GeometrySize = 8,
                GeometryStroke = new SolidColorPaint(new SKColor(0, 120, 212)) { StrokeThickness = 2 },
                GeometryFill = new SolidColorPaint(new SKColor(0, 120, 212)),
                LineSmoothness = 0.5,
                Name = "Size",
            }
        };

        var labels = list.Select(x => x.Label).ToArray();

        var chart = new CartesianChart
        {
            Series = series,
            Height = 120,
            Width = 380,
            XAxes =
            [
                new Axis
                {
                    Labels = labels,
                    LabelsRotation = 0,
                    TextSize = 10,
                    SeparatorsPaint = new SolidColorPaint(new SKColor(230, 230, 230)),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 10,
                    SeparatorsPaint = new SolidColorPaint(new SKColor(230, 230, 230)),
                    Labeler = FormatBytes,
                }
            ],
        };

        return chart;
    }

    // ── Real-time sparkline (for CPU/memory/disk history) ──

    /// <summary>
    /// Creates a CartesianChart with a filled LineSeries for real-time data (CPU, memory, disk).
    /// Data is a rolling window of percentage values (0-100).
    /// </summary>
    public static FrameworkElement CreateLiveSparkline(
        System.Collections.Generic.IReadOnlyList<double> values, SKColor color)
    {
        if (values.Count < 2) return new TextBlock { Text = "Collecting data...", VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center, FontSize = 11, Opacity = 0.5 };

        var series = new ISeries[]
        {
            new LineSeries<double>
            {
                Values = values.ToArray(),
                Fill = new SolidColorPaint(new SKColor(color.Red, color.Green, color.Blue, 40)),
                Stroke = new SolidColorPaint(color) { StrokeThickness = 2 },
                GeometrySize = 0,
                LineSmoothness = 0.3,
                Name = "",
            }
        };

        return new CartesianChart
        {
            Series = series,
            Height = 72,
            XAxes = [new Axis { IsVisible = false }],
            YAxes = [new Axis { IsVisible = false }],
        };
    }

    // ── Gauge ──

    public static FrameworkElement CreateGauge(double percent, string? label = null)
    {
        var usedColor = percent >= 90
            ? new SKColor(196, 43, 28)
            : percent >= 70
                ? new SKColor(255, 152, 0)
                : new SKColor(16, 124, 16);

        var series = new ISeries[]
        {
            new PieSeries<double>
            {
                Values = [percent],
                Fill = new SolidColorPaint(usedColor),
                InnerRadius = 55,
            },
            new PieSeries<double>
            {
                Values = [100 - percent],
                Fill = new SolidColorPaint(new SKColor(230, 230, 230)),
                InnerRadius = 55,
            },
        };

        var chart = new PieChart
        {
            Series = series,
            Width = 140,
            Height = 80,
            MaxAngle = 180,
        };

        var grid = new Grid { Width = 140, Height = 80 };
        grid.Children.Add(chart);

        var centerLabel = new TextBlock
        {
            Text = $"{percent:F0}%",
            FontSize = 16,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, -10, 0, 0),
        };
        grid.Children.Add(centerLabel);

        return grid;
    }

    // ── Helpers ──

    private static string TruncateLabel(string label, int maxLen)
    {
        if (label.Length <= maxLen) return label;
        return label[..(maxLen - 2)] + "..";
    }

    private static string FormatCompact(double value)
    {
        if (value >= 1_000_000_000) return $"{value / 1_000_000_000:F1}B";
        if (value >= 1_000_000) return $"{value / 1_000_000:F1}M";
        if (value >= 1_000) return $"{value / 1_000:F1}K";
        return $"{value:F0}";
    }

    private static string FormatBytes(double value)
    {
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double size = value;
        int unit = 0;
        while (size >= 1024 && unit < units.Length - 1) { size /= 1024; unit++; }
        return $"{size:F1} {units[unit]}";
    }
}
