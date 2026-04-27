import React from 'react';
import { BarChart3, PieChart, LineChart, TrendingUp } from 'lucide-react';

interface VisualizationProps {
  analysisData?: any;
}

export const Visualization: React.FC<VisualizationProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-green-400" />
          Data Visualization
        </h1>
        <p className="text-slate-400 text-lg">
          Interactive charts and graphs for comprehensive data analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
          <PieChart className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Pie Charts</h3>
          <p className="text-slate-400 text-sm">Category distribution and storage breakdown</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
          <BarChart3 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Bar Charts</h3>
          <p className="text-slate-400 text-sm">File counts and size comparisons</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
          <LineChart className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Line Charts</h3>
          <p className="text-slate-400 text-sm">Growth trends over time</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
          <TrendingUp className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Treemaps</h3>
          <p className="text-slate-400 text-sm">Hierarchical storage visualization</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Interactive Visualization Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-white mb-3">Chart Types</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Pie Charts - Category distribution
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Bar Charts - File counts and sizes
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                Line Charts - Growth trends
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                Treemaps - Hierarchical data
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-medium text-white mb-3">Interactive Features</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                Zoom and pan controls
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                Filter and search
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                Hover details and tooltips
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                Export options (PNG, SVG)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Visualization;