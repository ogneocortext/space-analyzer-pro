import React from 'react';
import { Copy, Trash2, CheckCircle, AlertTriangle, HardDrive } from 'lucide-react';

interface DuplicatesProps {
  analysisData?: any;
}

export const Duplicates: React.FC<DuplicatesProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Copy className="w-8 h-8 text-orange-400" />
          Duplicate File Detection
        </h1>
        <p className="text-slate-400 text-lg">
          Identify and manage duplicate files to reclaim storage space
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Copy className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">Total Duplicates</h3>
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">47</div>
          <p className="text-slate-400 text-sm">Duplicate file groups found</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold text-white">Space Wasted</h3>
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">8.7 GB</div>
          <p className="text-slate-400 text-sm">Storage space recoverable</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Auto-cleanable</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">32</div>
          <p className="text-slate-400 text-sm">Safe to auto-remove</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Needs Review</h3>
          </div>
          <div className="text-3xl font-bold text-yellow-400 mb-2">15</div>
          <p className="text-slate-400 text-sm">Requires manual review</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Largest Duplicate Groups</h2>
        <div className="space-y-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">Video Files (15 duplicates)</h4>
              <span className="text-red-400 font-medium">6.2 GB wasted</span>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>vacation_video_2023.mp4 (3 copies)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>wedding_ceremony.mp4 (2 copies)</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
                Review All
              </button>
              <button className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded">
                Auto Clean
              </button>
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">Document Files (8 duplicates)</h4>
              <span className="text-orange-400 font-medium">1.8 GB wasted</span>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>project_proposal_v1.pdf (4 copies)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>annual_report_2023.docx (3 copies)</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
                Compare Files
              </button>
              <button className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded">
                Keep Latest
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Duplicate Detection Methods</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="text-white font-medium mb-2">Content Hash</h3>
            <p className="text-slate-400 text-sm">MD5/SHA-256 hash comparison for identical files</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📏</span>
            </div>
            <h3 className="text-white font-medium mb-2">Metadata Analysis</h3>
            <p className="text-slate-400 text-sm">Size, name, and modification date matching</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-white font-medium mb-2">AI Similarity</h3>
            <p className="text-slate-400 text-sm">ML-powered detection of similar content</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Duplicates;