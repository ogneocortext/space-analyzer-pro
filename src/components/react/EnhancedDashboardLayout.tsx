import React from "react";
import EnhancedChart from "./EnhancedChart";
import EnhancedDataGrid from "./EnhancedDataGrid";
import AccessibilitySettings from "./AccessibilitySettings";
import { BrainCircuit, BarChart3, FolderOpen, TrendingUp } from "lucide-react";

interface EnhancedDashboardLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  className?: string;
}

const EnhancedDashboardLayout: React.FC<EnhancedDashboardLayoutProps> = ({
  currentPage,
  onNavigate,
  className = "",
}) => {
  // Sample data for demonstration
  const storageData = [
    { name: "Documents", value: 152342345, change: 12.5, color: "#3b82f6" },
    { name: "Media", value: 892345678, change: -3.2, color: "#10b981" },
    { name: "Applications", value: 456789012, change: 8.7, color: "#f59e0b" },
    { name: "System", value: 123456789, change: 2.1, color: "#ef4444" },
  ];

  const fileAnalysisData = [
    {
      id: "1",
      name: "Large Files",
      value: 456789012,
      change: 15.3,
      description: "Files larger than 100MB that may impact storage performance",
    },
    {
      id: "2",
      name: "Duplicates",
      value: 234567890,
      change: -8.2,
      description: "Duplicate files that can be safely removed to free space",
    },
    {
      id: "3",
      name: "Temporary Files",
      value: 123456789,
      change: 5.1,
      description: "Temporary and cache files that can be cleaned up",
    },
    {
      id: "4",
      name: "Archives",
      value: 98765432,
      change: 2.8,
      description: "Compressed archives and backup files",
    },
  ];

  const performanceMetrics = [
    { name: "CPU Usage", value: 67, change: -5.2, color: "#8b5cf6" },
    { name: "Memory", value: 82, change: 12.1, color: "#06b6d4" },
    { name: "Disk I/O", value: 45, change: 8.7, color: "#84cc16" },
    { name: "Network", value: 23, change: -2.3, color: "#f97316" },
  ];

  const handleDataPointClick = (data: any) => {
    console.log("Data point clicked:", data);
    // Navigate to detailed view or show modal
  };

  const handleItemClick = (item: any) => {
    console.log("Item clicked:", item);
    // Navigate to detailed analysis
  };

  return (
    <div className={`enhanced-dashboard ${className}`}>
      <div className="dashboard-layout">
        {/* Right Content Area */}
        <div className="dashboard-right">
          {/* Accessibility Settings Page */}
          {currentPage === "accessibility" ? (
            <AccessibilitySettings onBack={() => onNavigate("dashboard")} />
          ) : (
            <>
              {/* Top Section - Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="data-card">
                  <div className="flex items-center justify-center mb-2">
                    <FolderOpen className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="data-value text-lg">1.5TB</div>
                  <div className="data-label text-xs">Total Storage</div>
                  <div className="data-change positive flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    12.5%
                  </div>
                </div>

                <div className="data-card">
                  <div className="flex items-center justify-center mb-2">
                    <BarChart3 className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="data-value text-lg">2,847</div>
                  <div className="data-label text-xs">Files Analyzed</div>
                  <div className="data-change positive flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    8.7%
                  </div>
                </div>

                <div className="data-card">
                  <div className="flex items-center justify-center mb-2">
                    <BrainCircuit className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="data-value text-lg">156</div>
                  <div className="data-label text-xs">AI Insights</div>
                  <div className="data-change positive flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    23.1%
                  </div>
                </div>

                <div className="data-card">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="w-6 h-6 text-orange-400" />
                  </div>
                  <div className="data-value text-lg">94%</div>
                  <div className="data-label text-xs">Optimization</div>
                  <div className="data-change positive flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    5.3%
                  </div>
                </div>
              </div>

              {/* Middle Section - Charts and Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <EnhancedChart
                  title="Storage Distribution"
                  subtitle="By file type and category"
                  data={storageData}
                  type="pie"
                  showLegend={true}
                  showTooltip={true}
                  onDataPointClick={handleDataPointClick}
                />

                <EnhancedChart
                  title="Performance Metrics"
                  subtitle="System resource utilization"
                  data={performanceMetrics}
                  type="bar"
                  showLegend={false}
                  showTooltip={true}
                  onDataPointClick={handleDataPointClick}
                />
              </div>

              {/* Bottom Section - Detailed Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EnhancedDataGrid
                  title="File Analysis"
                  subtitle="Detailed breakdown of storage usage"
                  data={fileAnalysisData}
                  expandable={true}
                  onItemClick={handleItemClick}
                />

                <div className="content-section polished-card">
                  <div className="content-section-header">
                    <div>
                      <h3 className="content-section-title">AI Recommendations</h3>
                      <p className="content-section-subtitle">Smart suggestions for optimization</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <BrainCircuit className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-white mb-1">Clean up duplicates</h4>
                          <p className="text-sm text-slate-300">
                            Found 234 duplicate files totaling 234MB that can be safely removed.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-white mb-1">Archive old files</h4>
                          <p className="text-sm text-slate-300">
                            45 files older than 1 year can be archived to save 456MB.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="w-5 h-5 text-orange-400 mt-1 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-white mb-1">Optimize media files</h4>
                          <p className="text-sm text-slate-300">
                            Compress 89 media files to save up to 123MB of space.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700">
                    <button
                      className="btn-ai-insights w-full"
                      onClick={() => onNavigate("ai-insights")}
                    >
                      <BrainCircuit className="w-5 h-5" />
                      <span className="font-semibold">View All AI Insights</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboardLayout;
