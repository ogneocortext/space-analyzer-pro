import React from 'react';
import { Loader2 } from 'lucide-react';
import './SkeletonLoading.css';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width = '100%',
  height = '1rem',
  lines = 1,
  animate = true
}) => {
  const baseClasses = 'skeleton';
  const variantClasses = `skeleton-${variant}`;
  const animationClasses = animate ? 'skeleton-animate' : '';

  if (variant === 'text') {
    return (
      <div className={`${baseClasses} ${variantClasses} ${animationClasses} ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="skeleton-text-line"
            style={{
              width: typeof width === 'number' ? `${width}%` : width,
              height: '1rem',
              marginBottom: index < lines - 1 ? '0.5rem' : '0'
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circular') {
    return (
      <div className={`${baseClasses} ${variantClasses} ${animationClasses} ${className}`}>
        <Loader2 size={typeof height === 'number' ? height : 24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${animationClasses} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}%` : width,
        height
      }}
    />
  );
};

interface LoadingStateProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;
  variant?: 'default' | 'compact' | 'overlay';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  showProgress = false,
  progress = 0,
  variant = 'default'
}) => {
  const baseClasses = 'loading-state';
  const variantClasses = `loading-state-${variant}`;

  return (
    <div className={`${baseClasses} ${variantClasses}`}>
      <div className="loading-content">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="loading-text">
          <div className="loading-message">{message}</div>
          {showProgress && (
            <div className="loading-progress-bar">
              <div
                className="loading-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Page-specific skeleton loaders
export const DashboardSkeleton: React.FC = () => (
  <div className="dashboard-skeleton">
    {/* Header skeleton */}
    <div className="skeleton-header">
      <Skeleton variant="text" width="40%" height="2.5rem" />
      <Skeleton variant="text" width="60%" height="1.25rem" />
    </div>

    {/* Stats cards skeleton */}
    <div className="skeleton-stats-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-stat-card">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="skeleton-stat-content">
            <Skeleton variant="text" width="60%" height="1.5rem" />
            <Skeleton variant="text" width="40%" height="1rem" />
          </div>
        </div>
      ))}
    </div>

    {/* Charts skeleton */}
    <div className="skeleton-charts-grid">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="skeleton-chart-card">
          <Skeleton variant="text" width="30%" height="1.5rem" />
          <Skeleton variant="rectangular" width="100%" height="200px" />
        </div>
      ))}
    </div>

    {/* Recent files skeleton */}
    <div className="skeleton-recent-files">
      <Skeleton variant="text" width="25%" height="1.5rem" />
      <div className="skeleton-file-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-file-item">
            <Skeleton variant="circular" width={32} height={32} />
            <div className="skeleton-file-info">
              <Skeleton variant="text" width="70%" height="1rem" />
              <Skeleton variant="text" width="40%" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const FileExplorerSkeleton: React.FC = () => (
  <div className="file-explorer-skeleton">
    {/* Toolbar skeleton */}
    <div className="skeleton-toolbar">
      <Skeleton variant="rectangular" width="200px" height="40px" />
      <div className="skeleton-toolbar-actions">
        <Skeleton variant="rectangular" width="120px" height="32px" />
        <Skeleton variant="rectangular" width="100px" height="32px" />
        <Skeleton variant="rectangular" width="80px" height="32px" />
      </div>
    </div>

    {/* Breadcrumb skeleton */}
    <div className="skeleton-breadcrumb">
      <Skeleton variant="text" width="100%" height="1rem" lines={1} />
    </div>

    {/* File list skeleton */}
    <div className="skeleton-file-list">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton-file-row">
          <Skeleton variant="circular" width={24} height={24} />
          <div className="skeleton-file-details">
            <Skeleton variant="text" width="60%" height="1rem" />
            <Skeleton variant="text" width="30%" height="0.75rem" />
          </div>
          <Skeleton variant="text" width="15%" height="1rem" />
          <Skeleton variant="text" width="20%" height="1rem" />
          <Skeleton variant="rectangular" width={24} height={24} />
        </div>
      ))}
    </div>

    {/* Pagination skeleton */}
    <div className="skeleton-pagination">
      <Skeleton variant="rectangular" width="300px" height="32px" />
    </div>
  </div>
);

export const NeuralViewSkeleton: React.FC = () => (
  <div className="neural-view-skeleton">
    {/* Controls skeleton */}
    <div className="skeleton-controls">
      <Skeleton variant="rectangular" width="150px" height="36px" />
      <Skeleton variant="rectangular" width="120px" height="36px" />
      <Skeleton variant="rectangular" width="100px" height="36px" />
    </div>

    {/* Network visualization skeleton */}
    <div className="skeleton-network">
      <Skeleton variant="circular" width={60} height={60} />
      <Skeleton variant="circular" width={50} height={50} />
      <Skeleton variant="circular" width={45} height={45} />
      <Skeleton variant="circular" width={55} height={55} />
      <Skeleton variant="circular" width={40} height={40} />
      <Skeleton variant="circular" width={48} height={48} />
      <Skeleton variant="circular" width={52} height={52} />
      <Skeleton variant="circular" width={44} height={44} />

      {/* Connection lines simulation */}
      <div className="skeleton-connections">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            width={`${Math.random() * 100 + 50}px`}
            height="2px"
            className="skeleton-connection"
          />
        ))}
      </div>
    </div>

    {/* Metrics skeleton */}
    <div className="skeleton-metrics">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-metric-card">
          <Skeleton variant="text" width="60%" height="1rem" />
          <Skeleton variant="text" width="40%" height="1.5rem" />
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="chart-skeleton">
    {/* Chart header */}
    <div className="skeleton-chart-header">
      <Skeleton variant="text" width="30%" height="1.5rem" />
      <div className="skeleton-chart-controls">
        <Skeleton variant="rectangular" width="80px" height="28px" />
        <Skeleton variant="rectangular" width="80px" height="28px" />
      </div>
    </div>

    {/* Chart area */}
    <div className="skeleton-chart-area">
      <Skeleton variant="rectangular" width="100%" height="300px" />
    </div>

    {/* Legend skeleton */}
    <div className="skeleton-chart-legend">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-legend-item">
          <Skeleton variant="circular" width={12} height={12} />
          <Skeleton variant="text" width="40px" height="0.75rem" />
        </div>
      ))}
    </div>
  </div>
);

export const SettingsSkeleton: React.FC = () => (
  <div className="settings-skeleton">
    {/* Header */}
    <div className="skeleton-settings-header">
      <Skeleton variant="text" width="20%" height="2rem" />
      <Skeleton variant="text" width="40%" height="1rem" />
    </div>

    {/* Navigation sidebar */}
    <div className="skeleton-settings-nav">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" width="100%" height="40px" />
      ))}
    </div>

    {/* Content area */}
    <div className="skeleton-settings-content">
      <Skeleton variant="text" width="25%" height="1.5rem" />
      <div className="skeleton-settings-form">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-form-row">
            <Skeleton variant="text" width="30%" height="1rem" />
            <Skeleton variant="rectangular" width="70%" height="36px" />
          </div>
        ))}
      </div>
    </div>
  </div>
);