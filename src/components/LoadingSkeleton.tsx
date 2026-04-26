import React from 'react';

interface LoadingSkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = '20px',
  className = '',
  variant = 'rectangular'
}) => {
  const baseClasses = 'bg-slate-700 animate-pulse';

  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full'
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{
        width,
        height,
        minWidth: variant === 'circular' ? height : width
      }}
    />
  );
};

interface SkeletonCardProps {
  lines?: number;
  showAvatar?: boolean;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  showAvatar = false,
  className = ''
}) => {
  return (
    <div className={`bg-slate-800 rounded-xl p-6 space-y-4 ${className}`}>
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <LoadingSkeleton variant="circular" width="40px" height="40px" />
          <div className="space-y-2 flex-1">
            <LoadingSkeleton width="60%" height="16px" />
            <LoadingSkeleton width="40%" height="14px" />
          </div>
        </div>
      )}

      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="space-y-2">
          <LoadingSkeleton width={`${100 - index * 10}%`} height="14px" />
          {index === lines - 1 && <LoadingSkeleton width="70%" height="14px" />}
        </div>
      ))}
    </div>
  );
};

interface DashboardSkeletonProps {
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <LoadingSkeleton width="200px" height="32px" />
          <LoadingSkeleton width="150px" height="16px" />
        </div>
        <div className="flex space-x-2">
          <LoadingSkeleton width="100px" height="36px" variant="rectangular" />
          <LoadingSkeleton width="100px" height="36px" variant="rectangular" />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} className="bg-slate-800/50" />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard lines={4} className="bg-slate-800/50" />
        <SkeletonCard lines={4} className="bg-slate-800/50" />
      </div>

      {/* Insights Section */}
      <SkeletonCard lines={3} className="bg-slate-800/50" />
    </div>
  );
};