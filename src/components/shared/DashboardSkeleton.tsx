import React from "react";

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="enhanced-dashboard animate-pulse">
      <div className="dashboard-layout">
        {/* Right Content Area */}
        <div className="dashboard-right">
          {/* Top Section - Key Metrics Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="data-card">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-6 h-6 bg-slate-700 rounded animate-pulse"></div>
                </div>
                <div className="h-6 bg-slate-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-slate-700 rounded animate-pulse mb-1"></div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <div className="w-3 h-3 bg-slate-700 rounded animate-pulse"></div>
                  <div className="h-3 w-8 bg-slate-700 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Middle Section - Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="polished-card">
              <div className="card-header">
                <div className="h-6 bg-slate-700 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-slate-700 rounded animate-pulse w-3/4"></div>
              </div>
              <div className="card-content">
                <div className="h-64 bg-slate-700 rounded animate-pulse"></div>
              </div>
            </div>

            <div className="polished-card">
              <div className="card-header">
                <div className="h-6 bg-slate-700 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-slate-700 rounded animate-pulse w-2/3"></div>
              </div>
              <div className="card-content">
                <div className="h-64 bg-slate-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Analysis Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="polished-card">
              <div className="card-header">
                <div className="h-6 bg-slate-700 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-slate-700 rounded animate-pulse w-1/2"></div>
              </div>
              <div className="card-content space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded">
                    <div className="w-10 h-10 bg-slate-700 rounded animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
                      <div className="h-3 bg-slate-700 rounded animate-pulse w-3/4"></div>
                    </div>
                    <div className="h-6 w-16 bg-slate-700 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="polished-card">
              <div className="card-header">
                <div className="h-6 bg-slate-700 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-slate-700 rounded animate-pulse w-3/5"></div>
              </div>
              <div className="card-content space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-slate-700 rounded animate-pulse mt-1"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-slate-700 rounded animate-pulse w-2/3"></div>
                        <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
                        <div className="h-4 bg-slate-700 rounded animate-pulse w-4/5"></div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="h-12 bg-slate-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
