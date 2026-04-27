import React from "react";
import {
  Code,
  FileText,
  GitBranch,
  Terminal,
  Bug,
  CheckCircle,
  AlertTriangle,
  Cpu,
} from "lucide-react";

interface DevelopmentProps {
  analysisData?: any;
}

export const Development: React.FC<DevelopmentProps> = ({ analysisData }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Code className="w-8 h-8 text-indigo-400" />
          Development Analysis
        </h1>
        <p className="text-slate-400 text-lg">
          Code-specific analysis and tools for development projects
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Code className="w-6 h-6 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Code Files</h3>
          </div>
          <div className="text-3xl font-bold text-indigo-400 mb-2">1,247</div>
          <p className="text-slate-400 text-sm">Source code files detected</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <GitBranch className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Languages</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">8</div>
          <p className="text-slate-400 text-sm">Programming languages</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bug className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold text-white">Issues</h3>
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">23</div>
          <p className="text-slate-400 text-sm">Code quality issues</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Complexity</h3>
          </div>
          <div className="text-2xl font-bold text-blue-400 mb-2">Medium</div>
          <p className="text-slate-400 text-sm">Average code complexity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Language Breakdown
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-white">TypeScript</span>
              </div>
              <span className="text-blue-400 font-medium">45.2%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-white">Python</span>
              </div>
              <span className="text-green-400 font-medium">28.7%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                <span className="text-white">JavaScript</span>
              </div>
              <span className="text-purple-400 font-medium">15.6%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                <span className="text-white">Other</span>
              </div>
              <span className="text-orange-400 font-medium">10.5%</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            Code Quality Metrics
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Test Coverage</span>
                <span className="text-green-400">78%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-green-400 h-2 rounded-full" style={{ width: "78%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Documentation</span>
                <span className="text-blue-400">65%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full" style={{ width: "65%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Code Health</span>
                <span className="text-purple-400">82%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-purple-400 h-2 rounded-full" style={{ width: "82%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Security Score</span>
                <span className="text-orange-400">91%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-orange-400 h-2 rounded-full" style={{ width: "91%" }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Development Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-red-400 font-medium mb-1">High Complexity Functions</h4>
                <p className="text-slate-300 text-sm">
                  5 functions exceed recommended complexity limits. Consider refactoring.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-yellow-400 font-medium mb-1">Missing Tests</h4>
                <p className="text-slate-300 text-sm">
                  23 functions lack unit tests. Coverage could be improved to 85%.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Code className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-blue-400 font-medium mb-1">Code Duplication</h4>
                <p className="text-slate-300 text-sm">
                  Found 8 duplicate code blocks. Consider extracting common functions.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <GitBranch className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-green-400 font-medium mb-1">Good Architecture</h4>
                <p className="text-slate-300 text-sm">
                  Clean separation of concerns and modular design patterns detected.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-purple-400 font-medium mb-1">Documentation Gaps</h4>
                <p className="text-slate-300 text-sm">
                  12 public APIs lack proper documentation. Consider adding JSDoc comments.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Terminal className="w-5 h-5 text-indigo-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-indigo-400 font-medium mb-1">Performance Opportunities</h4>
                <p className="text-slate-300 text-sm">
                  3 functions could benefit from optimization. Potential 40% speed improvement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Development;
