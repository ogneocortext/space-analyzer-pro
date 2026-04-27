import React from "react";
import { Sparkles, Lightbulb, Target, CheckCircle } from "lucide-react";

interface RecommendationsProps {
  analysisData?: any;
}

export const Recommendations: React.FC<RecommendationsProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-400" />
          Actionable Recommendations
        </h1>
        <p className="text-slate-400 text-lg">
          AI-powered suggestions to optimize your storage and improve efficiency
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Cleanup Actions</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Remove temp files</span>
              <span className="text-green-400 font-medium">2.1 GB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Delete duplicates</span>
              <span className="text-green-400 font-medium">890 MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Archive old files</span>
              <span className="text-green-400 font-medium">5.2 GB</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Organization</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Create folder structure</span>
              <span className="text-blue-400 font-medium">High Priority</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Rename inconsistent files</span>
              <span className="text-blue-400 font-medium">Medium</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Group by project</span>
              <span className="text-blue-400 font-medium">Low</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Optimization</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Compress large files</span>
              <span className="text-green-400 font-medium">3.8 GB savings</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Convert formats</span>
              <span className="text-green-400 font-medium">1.2 GB savings</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Optimize images</span>
              <span className="text-green-400 font-medium">450 MB savings</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Priority Recommendations</h2>
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <h4 className="text-red-400 font-medium mb-1">Critical: Large Duplicate Files</h4>
                <p className="text-slate-300 text-sm mb-2">
                  Found 15 duplicate video files totaling 8.7 GB. Removing duplicates could save
                  significant storage space.
                </p>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
                    Review Duplicates
                  </button>
                  <button className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded">
                    Auto Cleanup
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <h4 className="text-yellow-400 font-medium mb-1">
                  Warning: Unorganized Project Files
                </h4>
                <p className="text-slate-300 text-sm mb-2">
                  Development files are scattered across multiple directories. Consider
                  consolidating into a proper project structure.
                </p>
                <button className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded">
                  Organize Projects
                </button>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <h4 className="text-blue-400 font-medium mb-1">Suggestion: Backup Strategy</h4>
                <p className="text-slate-300 text-sm mb-2">
                  Based on your file modification patterns, a weekly incremental backup would be
                  most efficient for your workflow.
                </p>
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
                  Configure Backup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recommendations;
