import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
  fullScreen = false
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const containerClasses = fullScreen 
    ? 'min-h-screen flex items-center justify-center bg-slate-900'
    : 'flex items-center justify-center py-8';

  return (
    <div className={containerClasses}>
      <div className="flex items-center gap-3 text-slate-400">
        <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};

export default LoadingState;