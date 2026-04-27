import React, { useState, useCallback, useMemo, memo } from 'react';
import type { FC } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Donut,
  Sun,
  Moon,
  Info
} from 'lucide-react';

// Chart type constants
export const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  DOUGHNUT: 'doughnut'
} as const;

export type ChartTypeType = typeof CHART_TYPES[keyof typeof CHART_TYPES];

// Enhanced color palette for better accessibility
const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#ec4899', // Pink
  '#6b7280', // Gray
];

// Dark theme colors
const DARK_THEME = {
  background: '#0f172a',
  text: '#f8fafc',
  grid: '#334155',
  tooltip: '#1e293b',
};

// Light theme colors
const LIGHT_THEME = {
  background: '#ffffff',
  text: '#0f172a',
  grid: '#e2e8f0',
  tooltip: '#f8fafc',
};

interface AnalysisData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
}

interface AnalysisChartProps {
  data: AnalysisData;
  isLoading?: boolean;
  error?: string | null;
}

const AnalysisChart: FC<AnalysisChartProps> = memo(({ data, isLoading, error }) => {
  const [chartType, setChartType] = useState<ChartTypeType>(CHART_TYPES.BAR);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // Convert Chart.js data format to Recharts format
  const rechartsData = useMemo(() => {
    if (!data || !data.labels || !data.datasets || data.labels.length === 0) {
      return [];
    }

    return data.labels.map((label, index) => {
      const dataPoint: any = { name: label };
      data.datasets.forEach((dataset, datasetIndex) => {
        dataPoint[dataset.label] = dataset.data[index] || 0;
      });
      return dataPoint;
    });
  }, [data]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setIsDarkTheme(prev => !prev);
  }, []);

  // Format file size for tooltips
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-3 rounded-lg shadow-lg border ${
          isDarkTheme ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
        }`}>
          <p className="font-semibold">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${formatFileSize(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Chart type buttons configuration
  const chartTypeButtons = useMemo(() => [
    { type: CHART_TYPES.BAR, icon: BarChart3, label: 'Bar' },
    { type: CHART_TYPES.LINE, icon: LineChartIcon, label: 'Line' },
    { type: CHART_TYPES.PIE, icon: PieChartIcon, label: 'Pie' },
    { type: CHART_TYPES.DOUGHNUT, icon: Donut, label: 'Doughnut' }
  ], []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <div className="text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg border border-red-500">
        <div className="text-red-400 mb-4">
          <Info size={48} />
        </div>
        <div className="text-red-400 text-center">
          <div className="font-semibold mb-2">Error loading chart</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!rechartsData || rechartsData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg">
        <div className="text-gray-400 mb-4">
          <Info size={48} />
        </div>
        <div className="text-gray-400 text-center">
          <div className="font-semibold mb-2">No data available</div>
          <div className="text-sm">Run an analysis to see visualizations</div>
        </div>
      </div>
    );
  }

  // Render the appropriate chart type
  const renderChart = () => {
    const theme = isDarkTheme ? DARK_THEME : LIGHT_THEME;
    const commonProps = {
      data: rechartsData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case CHART_TYPES.BAR:
        return (
          <BarChart {...commonProps} width={600} height={400}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis dataKey="name" stroke={theme.text} />
            <YAxis stroke={theme.text} tickFormatter={formatFileSize} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {data.datasets.map((dataset, index) => (
              <Bar
                key={dataset.label}
                dataKey={dataset.label}
                fill={COLORS[index % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case CHART_TYPES.LINE:
        return (
          <LineChart {...commonProps} width={600} height={400}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis dataKey="name" stroke={theme.text} />
            <YAxis stroke={theme.text} tickFormatter={formatFileSize} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {data.datasets.map((dataset, index) => (
              <Line
                key={dataset.label}
                type="monotone"
                dataKey={dataset.label}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={3}
                dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        );

      case CHART_TYPES.PIE:
      case CHART_TYPES.DOUGHNUT:
        // For pie charts, we need to transform the data differently
        const pieData = data.labels.map((label, index) => ({
          name: label,
          value: data.datasets[0]?.data[index] || 0,
          fill: COLORS[index % COLORS.length]
        }));

        return (
          <PieChart width={600} height={400}>
            <Pie
              data={pieData}
              cx={300}
              cy={200}
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              innerRadius={chartType === CHART_TYPES.DOUGHNUT ? 60 : 0}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatFileSize(value as number), 'Size']} />
            <Legend />
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-white">File Analysis Visualization</h2>
        <div className="flex flex-wrap gap-2">
          {chartTypeButtons.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                chartType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setChartType(type)}
              aria-label={`Switch to ${label} chart`}
              title={`View as ${label} Chart`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          <button
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkTheme
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-blue-600 text-white'
            }`}
            onClick={toggleTheme}
            aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDarkTheme ? 'Light Theme' : 'Dark Theme'}
          >
            {isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
            {isDarkTheme ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
        <ResponsiveContainer width="100%" height={400}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {data && data.datasets && data.datasets.map((dataset, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-sm text-gray-300">{dataset.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default AnalysisChart;