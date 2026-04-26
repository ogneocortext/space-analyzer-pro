import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { designTokens } from '../../styles/tokens';

interface ProgressiveLoadingProps {
  children: React.ReactNode;
  loading: boolean;
  skeleton?: React.ReactNode;
  delay?: number;
  onLoadingComplete?: () => void;
}

// Skeleton Loading Component with Framer Motion
export const SkeletonLoader: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  lines?: number;
}> = ({
  width = '100%',
  height = '1rem',
  borderRadius = designTokens.borderRadius.sm,
  className = '',
  lines = 1
}) => {
  const skeletonVariants = {
    loading: {
      backgroundPosition: ['200% 0', '-200% 0'],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  const skeletonStyle = {
    background: `linear-gradient(90deg,
      ${designTokens.colors.neutral[200]} 25%,
      ${designTokens.colors.neutral[100]} 50%,
      ${designTokens.colors.neutral[200]} 75%)`,
    backgroundSize: '200% 100%',
    borderRadius,
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (lines === 1) {
    return (
      <motion.div
        style={skeletonStyle}
        className={className}
        variants={skeletonVariants as any}
        animate="loading"
      />
    );
  }

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing.sm }}
      variants={skeletonVariants as any}
      animate="loading"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <motion.div
          key={index}
          style={skeletonStyle}
          className={className}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 1.5,
            delay: index * 0.1,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </motion.div>
  );
};

// File Explorer Skeleton
export const FileExplorerSkeleton: React.FC = () => (
  <div style={{ padding: designTokens.spacing.md }}>
    {/* Search skeleton */}
    <div style={{ marginBottom: designTokens.spacing.lg }}>
      <SkeletonLoader height="48px" borderRadius={designTokens.borderRadius.md} />
    </div>

    {/* Filter skeleton */}
    <div style={{
      display: 'flex',
      gap: designTokens.spacing.sm,
      marginBottom: designTokens.spacing.lg
    }}>
      {[...Array(4)].map((_, i) => (
        <SkeletonLoader key={i} width="80px" height="32px" borderRadius={designTokens.borderRadius.md} />
      ))}
    </div>

    {/* File list skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing.xs }}>
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          padding: designTokens.spacing.sm,
          borderRadius: designTokens.borderRadius.sm,
          gap: designTokens.spacing.sm
        }}>
          <SkeletonLoader width="32px" height="32px" borderRadius={designTokens.borderRadius.full} />
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '4px' }}>
              <SkeletonLoader width="60%" height="16px" />
            </div>
            <SkeletonLoader width="40%" height="12px" />
          </div>
          <SkeletonLoader width="60px" height="12px" />
        </div>
      ))}
    </div>
  </div>
);

// Chart Skeleton
export const ChartSkeleton: React.FC<{ type?: 'bar' | 'line' | 'pie' }> = ({ type = 'bar' }) => {
  const chartHeight = 300;

  return (
    <div style={{
      padding: designTokens.spacing.lg,
      border: `1px solid ${designTokens.colors.neutral[200]}`,
      borderRadius: designTokens.borderRadius.lg,
      backgroundColor: 'white'
    }}>
      {/* Title skeleton */}
      <div style={{ marginBottom: designTokens.spacing.md }}>
        <SkeletonLoader width="200px" height="24px" />
      </div>

      {/* Chart area skeleton */}
      <div style={{
        height: chartHeight,
        position: 'relative',
        backgroundColor: designTokens.colors.neutral[50],
        borderRadius: designTokens.borderRadius.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: designTokens.colors.neutral[400] }}>
          <div style={{ fontSize: '2rem', marginBottom: designTokens.spacing.sm }}>📊</div>
          <SkeletonLoader width="150px" height="16px" />
        </div>

        {/* Chart-specific skeleton elements */}
        {type === 'bar' && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            right: '20px',
            top: '20px',
            display: 'flex',
            alignItems: 'end',
            justifyContent: 'space-around'
          }}>
            {[...Array(8)].map((_, i) => (
              <SkeletonLoader
                key={i}
                width="30px"
                height={`${Math.random() * 60 + 20}%`}
                borderRadius={`${designTokens.borderRadius.sm} ${designTokens.borderRadius.sm} 0 0`}
              />
            ))}
          </div>
        )}

        {type === 'line' && (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={designTokens.colors.neutral[200]} />
                <stop offset="50%" stopColor={designTokens.colors.neutral[100]} />
                <stop offset="100%" stopColor={designTokens.colors.neutral[200]} />
              </linearGradient>
            </defs>
            <path
              d="M20,150 Q100,100 180,120 T340,80"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              fill="none"
              style={{ animation: 'skeleton-loading 1.5s infinite' }}
            />
          </svg>
        )}

        {type === 'pie' && (
          <div style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: `conic-gradient(
              ${designTokens.colors.primary[200]} 0deg 90deg,
              ${designTokens.colors.primary[300]} 90deg 180deg,
              ${designTokens.colors.primary[400]} 180deg 270deg,
              ${designTokens.colors.primary[200]} 270deg 360deg
            )`,
            animation: 'skeleton-loading 1.5s infinite'
          }} />
        )}
      </div>
    </div>
  );
};

// Progressive Loading Component
export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  children,
  loading,
  skeleton,
  delay = 0,
  onLoadingComplete
}) => {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setShowSkeleton(true);
      }, delay);

      return () => clearTimeout(timer);
    } else {
      setShowSkeleton(false);
      if (!hasLoaded) {
        setHasLoaded(true);
        onLoadingComplete?.();
      }
    }
  }, [loading, delay, hasLoaded, onLoadingComplete]);

  if (loading && showSkeleton) {
    return skeleton || <DefaultSkeleton />;
  }

  return (
    <div style={{
      animation: hasLoaded ? 'fadeIn 0.3s ease-in-out' : 'none'
    }}>
      {children}
    </div>
  );
};

// Page Transition Component with Framer Motion
export const PageTransition: React.FC<{
  children: React.ReactNode;
  isLoading: boolean;
  loadingSkeleton?: React.ReactNode;
}> = ({ children, isLoading, loadingSkeleton }) => {
  const pageVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94], // Custom easing
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.3
      }
    }
  };

  if (isLoading) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {loadingSkeleton || <FullPageSkeleton />}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="content"
        variants={pageVariants as any}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ minHeight: '200px' }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 }
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Full Page Skeleton
const FullPageSkeleton: React.FC = () => (
  <div style={{
    padding: designTokens.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: designTokens.spacing.xl
  }}>
    {/* Header skeleton */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <SkeletonLoader width="200px" height="32px" />
      <div style={{ display: 'flex', gap: designTokens.spacing.sm }}>
        <SkeletonLoader width="100px" height="32px" borderRadius={designTokens.borderRadius.md} />
        <SkeletonLoader width="100px" height="32px" borderRadius={designTokens.borderRadius.md} />
      </div>
    </div>

    {/* Content skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: designTokens.spacing.lg }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing.lg }}>
        <SkeletonLoader height="200px" borderRadius={designTokens.borderRadius.lg} />
        <SkeletonLoader height="300px" borderRadius={designTokens.borderRadius.lg} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing.lg }}>
        <SkeletonLoader height="150px" borderRadius={designTokens.borderRadius.lg} />
        <SkeletonLoader height="200px" borderRadius={designTokens.borderRadius.lg} />
      </div>
    </div>
  </div>
);

// Default Skeleton
const DefaultSkeleton: React.FC = () => (
  <div style={{
    padding: designTokens.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    gap: designTokens.spacing.md
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: `3px solid ${designTokens.colors.neutral[200]}`,
      borderTop: `3px solid ${designTokens.colors.primary[500]}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <SkeletonLoader width="150px" height="16px" />
  </div>
);

// Staggered Loading for Lists with Framer Motion
export const StaggeredList: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  loading: boolean;
  staggerDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}> = ({ items, renderItem, loading, staggerDelay = 0.1, direction = 'up' }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      x: direction === 'left' ? -20 : direction === 'right' ? 20 : 0,
      y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 12,
        mass: 0.8
      }
    },
    hover: {
      scale: 1.02,
      transition: { duration: 0.2 }
    }
  };

  if (loading) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {Array.from({ length: items.length || 5 }).map((_, index) => (
          <motion.div
            key={`skeleton-${index}`}
            variants={itemVariants as any}
            style={{ marginBottom: designTokens.spacing.sm }}
          >
            <SkeletonLoader height="60px" borderRadius={designTokens.borderRadius.md} />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item, index) => (
        <motion.div
          key={index}
          variants={itemVariants as any}
          whileHover="hover"
          layout
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Loading States Hook
export const useProgressiveLoading = (initialLoading = false) => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    initial: initialLoading
  });

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  };

  const isLoading = (key?: string) => {
    if (key) return loadingStates[key] || false;
    return Object.values(loadingStates).some(Boolean);
  };

  const getLoadingProgress = () => {
    const total = Object.keys(loadingStates).length;
    const loading = Object.values(loadingStates).filter(Boolean).length;
    return total > 0 ? ((total - loading) / total) * 100 : 100;
  };

  return {
    loadingStates,
    setLoading,
    isLoading,
    getLoadingProgress
  };
};

export default ProgressiveLoading;