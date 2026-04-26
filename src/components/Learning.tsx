import React from 'react';
import { TrendingUp, Brain, BookOpen, Target, Zap, Users } from 'lucide-react';

interface LearningProps {
  analysisData?: any;
}

export const Learning: React.FC<LearningProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Brain className="w-8 h-8 text-pink-400" />
          Self-Learning Analytics
        </h1>
        <p className="text-slate-400 text-lg">
          AI-powered learning system that adapts to your usage patterns and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-6 h-6 text-pink-400" />
            <h3 className="text-lg font-semibold text-white">Patterns Learned</h3>
          </div>
          <div className="text-3xl font-bold text-pink-400 mb-2">47</div>
          <p className="text-slate-400 text-sm">Learned user patterns</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Accuracy</h3>
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-2">89%</div>
          <p className="text-slate-400 text-sm">Prediction accuracy</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Adaptations</h3>
          </div>
          <div className="text-3xl font-bold text-yellow-400 mb-2">23</div>
          <p className="text-slate-400 text-sm">UI adaptations made</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Queries</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">1,247</div>
          <p className="text-slate-400 text-sm">Queries analyzed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Learned Patterns</h2>
          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Storage Analysis Focus</h4>
              <p className="text-slate-300 text-sm">You frequently analyze storage usage and cleanup opportunities. The system now prioritizes these insights.</p>
              <div className="mt-2 text-xs text-blue-400">Learned from 45 queries</div>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Visual Preferences</h4>
              <p className="text-slate-300 text-sm">You prefer detailed charts and visual representations. The system now defaults to expanded visualizations.</p>
              <div className="mt-2 text-xs text-green-400">Adapted from 32 sessions</div>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Time-based Analysis</h4>
              <p className="text-slate-300 text-sm">You often check historical trends. Timeline views are now more prominent in recommendations.</p>
              <div className="mt-2 text-xs text-purple-400">Learned from 28 interactions</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Adaptive Features</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <span className="text-white">Smart Suggestions</span>
              <span className="text-green-400 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <span className="text-white">Personalized UI</span>
              <span className="text-green-400 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <span className="text-white">Query Prediction</span>
              <span className="text-blue-400 font-medium">Learning</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <span className="text-white">Context Awareness</span>
              <span className="text-purple-400 font-medium">Advanced</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Learning Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Brain className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Pattern Recognition</h3>
            <p className="text-slate-400 text-sm">Learning your usage patterns and preferences</p>
            <div className="mt-2 bg-slate-700 rounded-full h-2">
              <div className="bg-blue-400 h-2 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Prediction Accuracy</h3>
            <p className="text-slate-400 text-sm">Improving prediction accuracy over time</p>
            <div className="mt-2 bg-slate-700 rounded-full h-2">
              <div className="bg-green-400 h-2 rounded-full" style={{ width: '89%' }}></div>
            </div>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Adaptation Level</h3>
            <p className="text-slate-400 text-sm">How well the system adapts to your needs</p>
            <div className="mt-2 bg-slate-700 rounded-full h-2">
              <div className="bg-purple-400 h-2 rounded-full" style={{ width: '76%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Learning;