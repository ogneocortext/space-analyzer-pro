import React, { useState, FC } from "react";
import {
  X,
  Settings,
  Code,
  Shield,
  Zap,
  FileText,
  Hammer,
  BookOpen,
  TestTube,
  Package,
  Users,
  GitBranch,
  Scale,
  Play,
  Loader2,
} from "lucide-react";

interface ComprehensiveAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAnalysis: (config: AnalysisConfig) => void;
  isLoading?: boolean;
}

interface AnalysisConfig {
  projectPath: string;
  selectedAnalyzers: string[];
  outputFormat: "json" | "text";
  saveResults?: string;
  progress: boolean;
  verbose: boolean;
}

const ANALYZERS = [
  {
    id: "dependency",
    name: "Dependencies",
    icon: Package,
    description: "Inter-file dependencies and circular dependency detection",
  },
  {
    id: "quality",
    name: "Code Quality",
    icon: Code,
    description: "Technical debt markers and code smells",
  },
  {
    id: "security",
    name: "Security",
    icon: Shield,
    description: "Security vulnerabilities and risk assessment",
  },
  {
    id: "performance",
    name: "Performance",
    icon: Zap,
    description: "Performance bottlenecks and optimization opportunities",
  },
  {
    id: "config",
    name: "Configuration",
    icon: Settings,
    description: "Config patterns and environment analysis",
  },
  {
    id: "build",
    name: "Build & Deploy",
    icon: Hammer,
    description: "Build and deployment configuration analysis",
  },
  {
    id: "docs",
    name: "Documentation",
    icon: FileText,
    description: "Documentation coverage and quality metrics",
  },
  {
    id: "test",
    name: "Testing",
    icon: TestTube,
    description: "Test coverage and organization patterns",
  },
  {
    id: "version",
    name: "Version Analysis",
    icon: Package,
    description: "Dependency versions and outdated package detection",
  },
  {
    id: "org",
    name: "Organization",
    icon: Users,
    description: "Code organization patterns and architecture compliance",
  },
  {
    id: "dev",
    name: "Developer Activity",
    icon: GitBranch,
    description: "Developer activity patterns and ownership information",
  },
  {
    id: "license",
    name: "License Analysis",
    icon: Scale,
    description: "License detection and compliance analysis",
  },
];

export const ComprehensiveAnalysisModal: FC<ComprehensiveAnalysisModalProps> = ({
  isOpen,
  onClose,
  onStartAnalysis,
  isLoading = false,
}) => {
  const [config, setConfig] = useState<AnalysisConfig>({
    projectPath: "",
    selectedAnalyzers: ["dependency", "quality", "security", "performance"],
    outputFormat: "json",
    progress: true,
    verbose: true,
  });

  const handleAnalyzerToggle = (analyzerId: string) => {
    setConfig((prev) => ({
      ...prev,
      selectedAnalyzers: prev.selectedAnalyzers.includes(analyzerId)
        ? prev.selectedAnalyzers.filter((id) => id !== analyzerId)
        : [...prev.selectedAnalyzers, analyzerId],
    }));
  };

  const handleSelectAll = () => {
    setConfig((prev) => ({
      ...prev,
      selectedAnalyzers: ANALYZERS.map((a) => a.id),
    }));
  };

  const handleSelectNone = () => {
    setConfig((prev) => ({
      ...prev,
      selectedAnalyzers: [],
    }));
  };

  const handleStartAnalysis = () => {
    if (!config.projectPath.trim()) {
      alert("Please enter a project path");
      return;
    }
    if (config.selectedAnalyzers.length === 0) {
      alert("Please select at least one analyzer");
      return;
    }
    onStartAnalysis(config);
  };

  const generateCommand = () => {
    const analyzers = config.selectedAnalyzers.join(",");
    let command = `bin\\space-analyzer-cli.exe analyze "${config.projectPath}"`;
    command += ` --format ${config.outputFormat}`;
    if (config.progress) command += " --progress";
    if (config.verbose) command += " --verbose";
    if (config.saveResults) command += ` --output "${config.saveResults}"`;
    return command;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Comprehensive Code Analysis</h2>
              <p className="text-gray-400 text-sm">
                Configure and run deep analysis with specialized analyzers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Project Path */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Project Path</label>
            <input
              type="text"
              value={config.projectPath}
              onChange={(e) => setConfig((prev) => ({ ...prev, projectPath: e.target.value }))}
              placeholder="Enter path to analyze (e.g., C:\MyProject or ./src)"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Analyzer Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-300">
                Available Analyzers ({config.selectedAnalyzers.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ANALYZERS.map((analyzer) => {
                const Icon = analyzer.icon;
                const isSelected = config.selectedAnalyzers.includes(analyzer.id);

                return (
                  <div
                    key={analyzer.id}
                    onClick={() => handleAnalyzerToggle(analyzer.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-gray-600 bg-gray-800 hover:border-gray-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected ? "bg-cyan-500/20" : "bg-gray-700"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${isSelected ? "text-cyan-400" : "text-gray-400"}`}
                        />
                      </div>
                      <div className="flex-1">
                        <h4
                          className={`font-medium text-sm ${
                            isSelected ? "text-cyan-400" : "text-white"
                          }`}
                        >
                          {analyzer.name}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">{analyzer.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Output Format</label>
              <select
                value={config.outputFormat}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    outputFormat: e.target.value as "json" | "text",
                  }))
                }
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                title="Select output format"
              >
                <option value="json">JSON</option>
                <option value="text">Text Summary</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Save Results (optional)
              </label>
              <input
                type="text"
                value={config.saveResults || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, saveResults: e.target.value }))}
                placeholder="Output file path (e.g., analysis-results.json)"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.progress}
                onChange={(e) => setConfig((prev) => ({ ...prev, progress: e.target.checked }))}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              Show Progress
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.verbose}
                onChange={(e) => setConfig((prev) => ({ ...prev, verbose: e.target.checked }))}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              Verbose Output
            </label>
          </div>

          {/* Generated Command */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Generated Command</label>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateCommand());
                  alert("Command copied to clipboard!");
                }}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Copy
              </button>
            </div>
            <code className="text-xs text-cyan-400 break-all">{generateCommand()}</code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleStartAnalysis}
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Analysis...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Analysis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
