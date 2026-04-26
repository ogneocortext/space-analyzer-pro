import React from 'react';
import { motion } from 'framer-motion';
import { HardDrive } from 'lucide-react';
import './StorageGauge.css';

interface StorageGaugeProps {
  used: number;
  total: number;
  categories?: { name: string; size: number; color: string }[];
}

export const StorageGauge: React.FC<StorageGaugeProps> = ({ used, total, categories = [] }) => {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const remaining = total - used;
  
  // Color based on usage
  const getGaugeColor = () => {
    if (percentage < 50) return '#10b981'; // emerald
    if (percentage < 75) return '#f59e0b'; // amber
    if (percentage < 90) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const gaugeColor = getGaugeColor();
  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (percentage / 100) * circumference;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="storage-gauge-container">
      <div className="gauge-wrapper">
        <svg className="gauge-svg" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="gauge-content">
          <HardDrive className="gauge-icon" size={24} />
          <div className="gauge-percentage">{Math.round(percentage)}%</div>
          <div className="gauge-label">Used</div>
        </div>
      </div>
      
      <div className="gauge-details">
        <div className="gauge-metric">
          <span className="metric-label">Used</span>
          <span className="metric-value">{formatBytes(used)}</span>
        </div>
        <div className="gauge-metric">
          <span className="metric-label">Free</span>
          <span className="metric-value">{formatBytes(remaining)}</span>
        </div>
        <div className="gauge-metric">
          <span className="metric-label">Total</span>
          <span className="metric-value">{formatBytes(total)}</span>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="category-breakdown">
          {categories.map((category, index) => (
            <div key={index} className="category-item">
              <div
                className="category-color"
                style={{ backgroundColor: category.color }}
              />
              <span className="category-name">{category.name}</span>
              <span className="category-size">{formatBytes(category.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
