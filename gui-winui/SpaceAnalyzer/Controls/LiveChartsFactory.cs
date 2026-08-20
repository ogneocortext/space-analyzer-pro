// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using LiveChartsCore;
using LiveChartsCore.Defaults;
using LiveChartsCore.Drawing;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using LiveChartsCore.SkiaSharpView.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
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

    // Axis paints are resolved per-chart from theme resources so the labels and
    // grid separators stay legible in both light and dark themes. The shared
    // statics above are replaced by these factories, called at create time.
    private static SKColor ThemeColor(string key, SKColor fallback)
    {
        if (Application.Current.Resources.TryGetValue(key, out var value) && value is SolidColorBrush brush)
            return new SKColor(brush.Color.R, brush.Color.G, brush.Color.B, brush.Color.A);
        return fallback;
    }

    private static SolidColorPaint MakeLabelPaint() =>
        new(ThemeColor("TextFillColorSecondaryBrush", new SKColor(150, 150, 150)));

    private static SolidColorPaint MakeSeparatorPaint() =>
        new(ThemeColor("CardStrokeColorDefaultBrush", new SKColor(128, 128, 128, 60)));

    /// <summary>Vertical gradient for a column/bar so it reads with depth instead
    /// of a flat fill — part of the shared 2026 Fluent chart language.</summary>
    private static LinearGradientPaint MakeBarGradient(SKColor baseColor)
    {
        var top = new SKColor(baseColor.Red, baseColor.Green, baseColor.Blue, 220);
        var bottom = new SKColor(baseColor.Red, baseColor.Green, baseColor.Blue, 70);
        return new LinearGradientPaint([top, bottom], new SKPoint(0, 0), new SKPoint(0, 1));
    }

    /// <summary>Card background colour used to ring data points / separate donut
    /// slices so they stay legible in both light and dark themes.</summary>
    private static SKColor CardBackground() =>
        ThemeColor("CardBackgroundFillColorDefaultBrush", new SKColor(245, 245, 245));

    private static readonly TimeSpan s_anim = TimeSpan.FromMilliseconds(550);
    private static Func<float, float> s_ease => LiveChartsCore.EasingFunctions.CubicOut;

    // ── Bar Chart ─

    /// <summary>
    /// Vertical bar chart with one bar per item. The optional <paramref name="yLabeler"/>
    /// formats the Y axis (and the series tooltip) so non-byte metrics such as file
    /// counts or durations render with their own units instead of being coerced to
    /// bytes by <see cref="FormatBytes"/>.
    /// </summary>
    public static FrameworkElement CreateBarChart(
        IEnumerable<(string Label, double Value, string? DisplayText)> items,
        Func<double, string>? yLabeler = null,
        Action<int>? onIndexClick = null)
    {
        var list = items.ToList();
        if (list.Count == 0) return new TextBlock { Text = "No data" };

        var series = new ISeries[list.Count];
        for (int i = 0; i < list.Count; i++)
        {
            var idx = i;
            var name = list[i].DisplayText
                ?? (yLabeler != null
                    ? $"{list[i].Label} — {yLabeler(list[i].Value)}"
                    : $"{list[i].Label} — {FormatBytes(list[i].Value)}");
            var col = new ColumnSeries<double>
            {
                Values = [list[i].Value],
                Name = name,
                Fill = MakeBarGradient(s_palette[i % s_palette.Length]),
                MaxBarWidth = 20,
                Rx = 4,
                Ry = 4,
                DataLabelsPaint = MakeLabelPaint(),
                DataLabelsPosition = LiveChartsCore.Measure.DataLabelsPosition.Top,
                DataLabelsSize = 10,
            };
            if (onIndexClick != null)
                col.ChartPointPointerDown += (_, _) => onIndexClick(idx);
            series[i] = col;
        }

        var labels = list.Select(x => TruncateLabel(x.Label, 18)).ToArray();

        var chart = new CartesianChart
        {
            Series = series,
            Height = Math.Max(140, list.Count * 32 + 40),
            Width = double.NaN,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            AnimationsSpeed = s_anim,
            EasingFunction = s_ease,
            XAxes =
            [
                new Axis
                {
                    Labels = labels,
                    LabelsRotation = 0,
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                    Labeler = yLabeler ?? FormatCompact,
                }
            ],
        };

        return chart;
    }

    // ── File-type bar chart (Dashboard) ──

    /// <summary>
    /// Vertical bar chart of the most common file extensions (by file count).
    /// A single ColumnSeries with category labels on the X axis, so each
    /// extension gets its own bar with its count on the Y axis. Values are raw
    /// counts (not bytes) — unlike CreateDonutChart, which is for composition.
    /// </summary>
    public static FrameworkElement CreateFileTypeBarChart(
        IEnumerable<(string Label, double Value)> items,
        Action<string>? onLabelClick = null)
    {
        var list = items.ToList();
        if (list.Count == 0)
            return new TextBlock
            {
                Text = "Run a scan to see file types",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 11,
                Opacity = 0.5,
            };

        var top = list.OrderByDescending(x => x.Value).Take(8).ToList();
        var labels = top.Select(x => TruncateLabel(x.Label, 10)).ToArray();

        var series = new ColumnSeries<double>
        {
            Values = top.Select(x => x.Value).ToArray(),
            Name = "Files",
            Fill = MakeBarGradient(new SKColor(0, 120, 212)),
            MaxBarWidth = 34,
            Rx = 3,
            Ry = 3,
            DataLabelsPaint = MakeLabelPaint(),
            DataLabelsPosition = LiveChartsCore.Measure.DataLabelsPosition.Top,
            DataLabelsSize = 10,
        };

        if (onLabelClick != null)
        {
            series.ChartPointPointerDown += (_, point) =>
            {
                if (point.Index >= 0 && point.Index < top.Count)
                    onLabelClick(top[point.Index].Label);
            };
        }

        return new CartesianChart
        {
            Series = [series],
            Height = 200,
            Width = double.NaN,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            AnimationsSpeed = s_anim,
            EasingFunction = s_ease,
            XAxes =
            [
                new Axis
                {
                    Labels = labels,
                    LabelsRotation = 0,
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                    Labeler = value => value >= 1000
                        ? (value / 1000).ToString("N1") + "K"
                        : value.ToString("0"),
                }
            ],
        };
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
                CornerRadius = 6,
                Stroke = new SolidColorPaint(CardBackground()) { StrokeThickness = 1.5f },
            };
        }

        var chart = new PieChart
        {
            Series = series,
            Width = 360,
            Height = 200,
            AnimationsSpeed = s_anim,
            EasingFunction = s_ease,
            LegendPosition = LiveChartsCore.Measure.LegendPosition.Right,
            LegendTextPaint = MakeLabelPaint(),
        };

        return chart;
    }

    /// <summary>
    /// Donut variant that fires <paramref name="onDrillKeyClick"/> when a slice is
    /// tapped, passing back the caller-supplied <c>DrillKey</c> for that slice
    /// (e.g. a volume mount point) so the host page can navigate on the selection.
    /// </summary>
    public static FrameworkElement CreateDonutChart(
        IEnumerable<(string Label, double Value, string DrillKey)> items,
        Action<string>? onDrillKeyClick = null)
    {
        var list = items.ToList();
        if (list.Count == 0) return new TextBlock { Text = "No data" };

        var series = new ISeries[list.Count];
        for (int i = 0; i < list.Count; i++)
        {
            var drillKey = list[i].DrillKey;
            var slice = new PieSeries<double>
            {
                Values = [list[i].Value],
                Name = $"{list[i].Label} — {FormatBytes(list[i].Value)}",
                Fill = new SolidColorPaint(s_palette[i % s_palette.Length]),
                InnerRadius = 50,
                CornerRadius = 6,
                Stroke = new SolidColorPaint(CardBackground()) { StrokeThickness = 1.5f },
            };
            if (onDrillKeyClick != null)
            {
                slice.ChartPointPointerDown += (_, _) => onDrillKeyClick(drillKey);
            }
            series[i] = slice;
        }

        var chart = new PieChart
        {
            Series = series,
            Width = 360,
            Height = 200,
            AnimationsSpeed = s_anim,
            EasingFunction = s_ease,
            LegendPosition = LiveChartsCore.Measure.LegendPosition.Right,
            LegendTextPaint = MakeLabelPaint(),
        };

        return chart;
    }

    // ── Forecast Chart ──

    /// <summary>
    /// Simple bar chart comparing current vs predicted storage for the forecast panel.
    /// </summary>
    public static FrameworkElement CreateForecastChart(double currentGb, double predictedGb, int daysAhead)
    {
        var series = new ISeries[]
        {
            new ColumnSeries<double>
            {
                Values = [currentGb],
                Name = $"Current",
                Fill = MakeBarGradient(new SKColor(0, 120, 212)),
                MaxBarWidth = 48,
                Rx = 4,
                Ry = 4,
                DataLabelsPaint = MakeLabelPaint(),
                DataLabelsPosition = LiveChartsCore.Measure.DataLabelsPosition.Top,
                DataLabelsSize = 10,
            },
            new ColumnSeries<double>
            {
                Values = [predictedGb],
                Name = $"In {daysAhead}d",
                Fill = MakeBarGradient(predictedGb > currentGb
                    ? new SKColor(196, 43, 28)
                    : new SKColor(16, 124, 16)),
                MaxBarWidth = 48,
                Rx = 4,
                Ry = 4,
                DataLabelsPaint = MakeLabelPaint(),
                DataLabelsPosition = LiveChartsCore.Measure.DataLabelsPosition.Top,
                DataLabelsSize = 10,
            }
        };

        return new CartesianChart
        {
            Series = series,
            Height = 160,
            Width = double.NaN,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            AnimationsSpeed = s_anim,
            EasingFunction = s_ease,
            XAxes =
            [
                new Axis
                {
                    Labels = ["Current", $"In {daysAhead}d"],
                    LabelsRotation = 0,
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                    Labeler = v => $"{v:F1} GB",
                }
            ],
        };
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
            Width = double.NaN,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            AnimationsSpeed = TimeSpan.Zero,
            XAxes =
            [
                new Axis
                {
                    Labels = labels,
                    LabelsRotation = 0,
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 11,
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                    Labeler = FormatBytes,
                }
            ],
        };

        return chart;
    }

    // ── Trend Chart (professional, 2026 Fluent look) ──

    /// <summary>
    /// Dashboard-grade area line chart for the disk-space trend. Renders a smooth,
    /// theme-aware accent line with a vertical gradient fill, rounded data points,
    /// a formatted byte Y-axis, a de-cluttered date X-axis (~7 ticks), hover
    /// tooltips, and a soft entrance animation — replacing the bare sparkline.
    /// </summary>
    public static FrameworkElement CreateTrendChart(IEnumerable<(string Label, double Value)> items)
    {
        var list = items.ToList();
        if (list.Count < 2)
        {
            return new TextBlock
            {
                Text = "Need at least 2 scan days to chart the trend",
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontSize = 12,
                Opacity = 0.6,
            };
        }

        var accent = ThemeColor("AccentFillColorDefaultBrush", new SKColor(0, 120, 212));
        var fillTop = new SKColor(accent.Red, accent.Green, accent.Blue, 95);
        var fillBottom = new SKColor(accent.Red, accent.Green, accent.Blue, 8);
        var pointRing = ThemeColor("CardBackgroundFillColorDefaultBrush", new SKColor(255, 255, 255));

        var labels = list.Select(x => x.Label).ToArray();
        var points = list.Select((x, i) => new ObservablePoint(i, x.Value)).ToArray();

        var series = new LineSeries<ObservablePoint>
        {
            Values = points,
            Name = "Disk usage",
            Fill = new LinearGradientPaint([fillTop, fillBottom], new SKPoint(0, 0), new SKPoint(0, 1)),
            Stroke = new SolidColorPaint(accent) { StrokeThickness = 2.5f },
            GeometrySize = 5,
            GeometryFill = new SolidColorPaint(accent),
            GeometryStroke = new SolidColorPaint(pointRing) { StrokeThickness = 1.5f },
            LineSmoothness = 0.65,
            DataPadding = new LvcPoint(0.6, 1),
            IsHoverable = true,
        };

        // Show roughly one date tick per week of points so the X axis stays legible.
        var tickStep = Math.Max(1, (int)Math.Ceiling(list.Count / 7.0));

        var chart = new CartesianChart
        {
            Series = new ISeries[] { series },
            Height = 220,
            Width = double.NaN,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            AnimationsSpeed = TimeSpan.FromMilliseconds(700),
            EasingFunction = LiveChartsCore.EasingFunctions.CubicOut,
            TooltipPosition = LiveChartsCore.Measure.TooltipPosition.Top,
            XAxes =
            [
                new Axis
                {
                    Labeler = v => labels[Math.Clamp((int)Math.Round(v), 0, labels.Length - 1)],
                    MinStep = tickStep,
                    LabelsRotation = 0,
                    TextSize = 11,
                    Padding = new Padding(0, 0, 0, 6),
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
                }
            ],
            YAxes =
            [
                new Axis
                {
                    TextSize = 11,
                    Padding = new Padding(6, 0, 0, 0),
                    LabelsPaint = MakeLabelPaint(),
                    SeparatorsPaint = MakeSeparatorPaint(),
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
            AnimationsSpeed = TimeSpan.Zero,
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
                CornerRadius = 4,
                Stroke = new SolidColorPaint(CardBackground()) { StrokeThickness = 1.5f },
            },
            new PieSeries<double>
            {
                Values = [100 - percent],
                Fill = new SolidColorPaint(new SKColor(230, 230, 230)),
                InnerRadius = 55,
                CornerRadius = 4,
                Stroke = new SolidColorPaint(CardBackground()) { StrokeThickness = 1.5f },
            },
        };

        var chart = new PieChart
        {
            Series = series,
            Width = 140,
            Height = 80,
            MaxAngle = 180,
            AnimationsSpeed = s_anim,
            EasingFunction = s_ease,
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
