import React from 'react';
import { Clock, TrendingUp, Calendar, Activity } from 'lucide-react';

interface TimelineProps {
  analysisData?: any;
}

export const Timeline: React.FC<TimelineProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Clock className="w-8 h-8 text-cyan-400" />
          Timeline Analysis
        </h1>
        <p className="text-slate-400 text-lg">
          Time-based analysis and historical trends of your storage usage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Daily Changes</h3>
          </div>
          <div className="text-3xl font-bold text-cyan-400 mb-2">+127</div>
          <p className="text-slate-400 text-sm">Files added in last 24h</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Growth Rate</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">+12.5%</div>
          <p className="text-slate-400 text-sm">Monthly storage growth</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Peak Activity</h3>
          </div>
          <div className="text-lg font-bold text-purple-400 mb-2">Wed 2-4 PM</div>
          <p className="text-slate-400 text-sm">Most active time period</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">Oldest Files</h3>
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">3.2y</div>
          <p className="text-slate-400 text-sm">Average file age</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Storage Growth Timeline</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-white">Last 30 Days</span>
              </div>
              <span className="text-green-400 font-medium">+2.3 GB</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-white">Last 90 Days</span>
              </div>
              <span className="text-blue-400 font-medium">+8.7 GB</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                <span className="text-white">Last 6 Months</span>
              </div>
              <span className="text-purple-400 font-medium">+15.2 GB</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                <span className="text-white">Last Year</span>
              </div>
              <span className="text-orange-400 font-medium">+34.8 GB</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Activity Patterns</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Weekday Activity</span>
                <span className="text-green-400">78%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-green-400 h-2 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Weekend Activity</span>
                <span className="text-blue-400">22%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full" style={{ width: '22%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Business Hours</span>
                <span className="text-purple-400">65%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-purple-400 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">After Hours</span>
                <span className="text-orange-400">35%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-orange-400 h-2 rounded-full" style={{ width: '35%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;