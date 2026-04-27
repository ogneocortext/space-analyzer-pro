import React from "react";
import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: "rectangular" | "circular" | "text";
  animation?: "pulse" | "wave" | "none";
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  width,
  height,
  variant = "rectangular",
  animation = "pulse",
}) => {
  const baseClasses = "bg-gray-200";

  const variantClasses = {
    rectangular: "rounded-md",
    circular: "rounded-full",
    text: "rounded-sm h-4",
  };

  const animationVariants = {
    pulse: {
      animate: {
        opacity: [0.6, 1, 0.6],
      },
      // @ts-ignore - ease type
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    wave: {
      animate: {
        x: ["-100%", "100%"],
      },
      // @ts-ignore - ease type
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    none: {},
  };

  const style = {
    width: width || "100%",
    height: height || (variant === "text" ? "1rem" : "2rem"),
  };

  if (animation === "wave") {
    return (
      <div
        className={`${baseClasses} ${variantClasses[variant]} ${className} relative overflow-hidden`}
        style={style}
      >
        {/* @ts-ignore - transition ease type */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
          {...animationVariants.wave}
        />
      </div>
    );
  }

  return (
    // @ts-ignore - transition ease type
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      {...animationVariants.pulse}
    />
  );
};

// Predefined skeleton components
export const DashboardSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <Skeleton width={200} height={32} />
      <div className="flex gap-2">
        <Skeleton width={100} height={36} variant="rectangular" />
        <Skeleton width={100} height={36} variant="rectangular" />
      </div>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
          <Skeleton width={40} height={40} variant="circular" className="mb-4" />
          <Skeleton height={20} className="mb-2" />
          <Skeleton height={16} width="60%" />
        </div>
      ))}
    </div>

    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <Skeleton height={24} width={150} className="mb-4" />
        <Skeleton height={300} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <Skeleton height={24} width={150} className="mb-4" />
        <Skeleton height={300} />
      </div>
    </div>
  </div>
);

export const FileBrowserSkeleton: React.FC = () => (
  <div className="p-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <Skeleton width={300} height={32} />
      <div className="flex gap-2">
        <Skeleton width={120} height={36} />
        <Skeleton width={80} height={36} />
      </div>
    </div>

    {/* Breadcrumb */}
    <div className="flex items-center gap-2 mb-6">
      <Skeleton width={60} height={20} />
      <Skeleton width={4} height={4} variant="circular" />
      <Skeleton width={80} height={20} />
      <Skeleton width={4} height={4} variant="circular" />
      <Skeleton width={100} height={20} />
    </div>

    {/* File List */}
    <div className="bg-white rounded-lg shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-6">
            <Skeleton height={16} />
          </div>
          <div className="col-span-2">
            <Skeleton height={16} />
          </div>
          <div className="col-span-2">
            <Skeleton height={16} />
          </div>
          <div className="col-span-2">
            <Skeleton height={16} />
          </div>
        </div>
      </div>

      {[...Array(10)].map((_, i) => (
        <div key={i} className="border-b border-gray-100 p-4 last:border-b-0">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-6 flex items-center gap-3">
              <Skeleton width={20} height={20} variant="circular" />
              <Skeleton height={16} width="60%" />
            </div>
            <div className="col-span-2">
              <Skeleton height={14} width="80%" />
            </div>
            <div className="col-span-2">
              <Skeleton height={14} width="70%" />
            </div>
            <div className="col-span-2">
              <Skeleton height={14} width="60%" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const AnalysisSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Progress Section */}
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <Skeleton height={24} width={200} className="mb-4" />
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton height={16} width={150} />
          <Skeleton height={16} width={40} />
        </div>
        <Skeleton height={8} className="w-full" />
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
      </div>
    </div>

    {/* Neural Network Visualization */}
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <Skeleton height={24} width={250} className="mb-4" />
      <Skeleton height={400} />
    </div>

    {/* Insights */}
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <Skeleton height={24} width={180} className="mb-4" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton width={20} height={20} variant="circular" />
            <div className="flex-1">
              <Skeleton height={16} className="mb-2" />
              <Skeleton height={14} width="90%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ChatSkeleton: React.FC = () => (
  <div className="flex flex-col h-full">
    {/* Chat Header */}
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <Skeleton width={40} height={40} variant="circular" />
        <div className="flex-1">
          <Skeleton height={20} width={150} className="mb-1" />
          <Skeleton height={14} width={80} />
        </div>
      </div>
    </div>

    {/* Messages */}
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      {/* AI Message */}
      <div className="flex gap-3">
        <Skeleton width={32} height={32} variant="circular" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="70%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="60%" />
        </div>
      </div>

      {/* User Message */}
      <div className="flex gap-3 justify-end">
        <div className="max-w-xs">
          <Skeleton height={16} width="100%" />
          <Skeleton height={16} width="80%" />
        </div>
        <Skeleton width={32} height={32} variant="circular" />
      </div>

      {/* Typing Indicator */}
      <div className="flex gap-3">
        <Skeleton width={32} height={32} variant="circular" />
        <div className="flex gap-1 items-center">
          <Skeleton width={8} height={8} variant="circular" />
          <Skeleton width={8} height={8} variant="circular" />
          <Skeleton width={8} height={8} variant="circular" />
        </div>
      </div>
    </div>

    {/* Input */}
    <div className="p-4 border-t border-gray-200">
      <div className="flex gap-2">
        <Skeleton height={40} className="flex-1" />
        <Skeleton width={40} height={40} variant="rectangular" />
      </div>
    </div>
  </div>
);

export default Skeleton;
