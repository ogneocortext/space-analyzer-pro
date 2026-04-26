import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Info } from 'lucide-react';

interface ChartData {
  name: string;
  value: number;
  color?: string;
  change?: number;
}

interface EnhancedChartProps {
  title: string;
  subtitle?: string;
  data: ChartData[];
  type: 'bar' | 'pie' | 'line';
  showLegend?: boolean;
  showTooltip?: boolean;
  className?: string;
  onDataPointClick?: (data: ChartData) => void;
}

const EnhancedChart: React.FC<EnhancedChartProps> = ({
  title,
  subtitle,
  data,
  type,
  showLegend = true,
  showTooltip = true,
  className = '',
  onDataPointClick
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; visible: boolean }>({
    x: 0,
    y: 0,
    content: '',
    visible: false
  });
  
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent, item: ChartData) => {
    if (!showTooltip) return;
    
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const content = `
      <div class="font-semibold">${item.name}</div>
      <div class="text-sm">Value: ${item.value.toLocaleString()}</div>
      ${item.change !== undefined ? `<div class="text-xs ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}">Change: ${item.change >= 0 ? '+' : ''}${item.change}%</div>` : ''}
    `;
    
    setTooltip({ x, y, content, visible: true });
    setHoveredItem(item.name);
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
    setHoveredItem(null);
  };

  const handleItemClick = (item: ChartData) => {
    if (onDataPointClick) {
      onDataPointClick(item);
    }
  };

  const getChartIcon = () => {
    switch (type) {
      case 'bar':
        return <BarChart3 className="w-5 h-5" />;
      case 'pie':
        return <PieChart className="w-5 h-5" />;
      case 'line':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <BarChart3 className="w-5 h-5" />;
    }
  };

  const renderChart = () => {
    const maxValue = Math.max(...data.map(d => d.value));
    
    switch (type) {
      case 'bar':
        return (
          <div className="space-y-3">
            {data.map((item, index) => (
              <div
                key={item.name}
                className="relative group cursor-pointer"
                onMouseMove={(e) => handleMouseMove(e, item)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-300">{item.name}</span>
                  <span className="text-sm text-slate-400">{item.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${hoveredItem === item.name ? 'brightness-110' : ''}`}
                    style={{
                      width: `${(item.value / maxValue) * 100}%`,
                      backgroundColor: item.color || '#3b82f6'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'pie':
        return (
          <div className="relative">
            <div className="w-48 h-48 mx-auto">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {data.map((item, index) => {
                  const percentage = (item.value / data.reduce((sum, d) => sum + d.value, 0)) * 100;
                  const angle = (percentage / 100) * 360;
                  const previousAngles = data.slice(0, index).reduce((sum, d) => {
                    const prevPercentage = (d.value / data.reduce((sum, d) => sum + d.value, 0)) * 100;
                    return sum + prevPercentage;
                  }, 0);
                  
                  return (
                    <g key={item.name}>
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={item.color || '#3b82f6'}
                        strokeWidth="20"
                        strokeDasharray={`${angle} ${360 - angle}`}
                        strokeDashoffset={`-${previousAngles}`}
                        transform="rotate(-90 50 50)"
                        className={`cursor-pointer transition-all duration-300 ${hoveredItem === item.name ? 'opacity-80' : ''}`}
                        onMouseMove={(e) => handleMouseMove(e as any, item)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleItemClick(item)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      
      default:
        return <div className="text-slate-400">Chart type not implemented</div>;
    }
  };

  return (
    <div className={`chart-container polished-card ${className}`} ref={chartRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            {getChartIcon()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <button 
          className="text-slate-400 hover:text-slate-300 transition-colors focus-enhanced"
          title="Chart information"
          aria-label={`Information about ${title} chart`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Chart Content */}
      <div className="relative">
        {renderChart()}
        
        {/* Tooltip */}
        {showTooltip && tooltip.visible && (
          <div
            className="chart-tooltip visible"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y - 40}px`,
              transform: 'translateX(-50%)'
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="chart-legend">
          {data.map((item) => (
            <div key={item.name} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: item.color || '#3b82f6' }}
              />
              <span>{item.name}</span>
              {item.change !== undefined && (
                <span className={`data-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                  {item.change >= 0 ? '+' : ''}{item.change}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedChart;
