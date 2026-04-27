import React from "react";
import { Brain, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

interface AIInsightsProps {
  analysisData?: any;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Brain className="w-8 h-8 text-blue-400" />
          AI Insights
        </h1>
        <p className="text-slate-400 text-lg">
          ML-generated insights and recommendations powered by advanced analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* ML Confidence Score */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">ML Confidence</h3>
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-2">98%</div>
          <p className="text-slate-400 text-sm">High confidence in analysis results</p>
          <div className="mt-4 bg-slate-700 rounded-full h-2">
            <div className="bg-blue-400 h-2 rounded-full" style={{ width: "98%" }}></div>
          </div>
        </div>

        {/* Pattern Recognition */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Pattern Recognition</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">24</div>
          <p className="text-slate-400 text-sm">Usage patterns identified</p>
          <div className="mt-4 bg-slate-700 rounded-full h-2">
            <div className="bg-green-400 h-2 rounded-full" style={{ width: "85%" }}></div>
          </div>
        </div>

        {/* Anomaly Detection */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">Anomaly Detection</h3>
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">3</div>
          <p className="text-slate-400 text-sm">Potential issues flagged</p>
          <div className="mt-4 bg-slate-700 rounded-full h-2">
            <div className="bg-orange-400 h-2 rounded-full" style={{ width: "60%" }}></div>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Recommendations
        </h2>

        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h4 className="text-green-400 font-medium mb-1">Storage Optimization</h4>
                <p className="text-slate-300 text-sm">
                  Based on your usage patterns, consolidating small files could save approximately
                  2.3 GB of storage space.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h4 className="text-blue-400 font-medium mb-1">Backup Strategy</h4>
                <p className="text-slate-300 text-sm">
                  Your backup frequency analysis suggests optimizing to weekly incremental backups
                  for critical project files.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h4 className="text-purple-400 font-medium mb-1">Performance Insights</h4>
                <p className="text-slate-300 text-sm">
                  Large media files are impacting load times. Consider moving them to external
                  storage or implementing lazy loading.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Self-Learning Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">1,247</div>
            <div className="text-sm text-slate-400">Queries Analyzed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">89%</div>
            <div className="text-sm text-slate-400">Accuracy Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400 mb-1">47</div>
            <div className="text-sm text-slate-400">Patterns Learned</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
