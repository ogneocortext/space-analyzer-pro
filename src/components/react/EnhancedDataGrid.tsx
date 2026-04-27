import React, { useState } from "react";
import {
  FolderOpen,
  File,
  HardDrive,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DataItem {
  id: string;
  name: string;
  value: number;
  change?: number;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  description?: string;
}

interface EnhancedDataGridProps {
  title: string;
  subtitle?: string;
  data: DataItem[];
  expandable?: boolean;
  className?: string;
  onItemClick?: (item: DataItem) => void;
}

const EnhancedDataGrid: React.FC<EnhancedDataGridProps> = ({
  title,
  subtitle,
  data,
  expandable = false,
  className = "",
  onItemClick,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const sortedData = [...data].sort((a, b) => {
    const comparison = a.value - b.value;
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const formatValue = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}GB`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}MB`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}KB`;
    }
    return `${value}B`;
  };

  const getIcon = (item: DataItem) => {
    if (item.icon) return <item.icon className="w-5 h-5" />;

    if (
      item.name.toLowerCase().includes("folder") ||
      item.name.toLowerCase().includes("directory")
    ) {
      return <FolderOpen className="w-5 h-5 text-blue-400" />;
    } else if (item.name.toLowerCase().includes("file")) {
      return <File className="w-5 h-5 text-green-400" />;
    } else if (
      item.name.toLowerCase().includes("storage") ||
      item.name.toLowerCase().includes("disk")
    ) {
      return <HardDrive className="w-5 h-5 text-purple-400" />;
    }

    return <div className="w-5 h-5 bg-slate-600 rounded" />;
  };

  return (
    <div className={`content-section polished-card ${className}`}>
      {/* Header */}
      <div className="content-section-header">
        <div>
          <h3 className="content-section-title flex items-center gap-2">
            {title}
            <button
              className="text-slate-400 hover:text-slate-300 transition-colors focus-enhanced"
              onClick={toggleSort}
              title={`Sort by value (${sortOrder === "asc" ? "ascending" : "descending"})`}
              aria-label={`Sort ${title} by value`}
            >
              {sortOrder === "asc" ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </h3>
          {subtitle && <p className="content-section-subtitle">{subtitle}</p>}
        </div>
        <div className="text-sm text-slate-400">{data.length} items</div>
      </div>

      {/* Data Grid */}
      <div className="data-grid">
        {sortedData.map((item) => (
          <div
            key={item.id}
            className="data-card"
            role="button"
            tabIndex={0}
            onClick={() => onItemClick?.(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onItemClick?.(item);
              }
            }}
            aria-label={`${item.name}: ${formatValue(item.value)}`}
          >
            <div className="flex items-center justify-center mb-3">{getIcon(item)}</div>

            <div className="data-value">{formatValue(item.value)}</div>

            <div className="data-label text-xs">{item.name}</div>

            {item.change !== undefined && (
              <div
                className={`data-change ${item.change >= 0 ? "positive" : "negative"} flex items-center justify-center gap-1 mt-2`}
              >
                {item.change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(item.change)}%
              </div>
            )}

            {/* Expandable Description - Separate from main click handler */}
            {expandable && item.description && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <button
                  className="expand-toggle w-full text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleExpanded(item.id);
                    }
                  }}
                  aria-expanded={expandedItems.has(item.id) ? "true" : "false"}
                  aria-controls={`description-${item.id}`}
                >
                  {expandedItems.has(item.id) ? "Show less" : "Show more"}
                </button>

                <div
                  id={`description-${item.id}`}
                  className={`content-expandable ${expandedItems.has(item.id) ? "expanded" : ""}`}
                >
                  <p className="text-xs text-slate-400 mt-2">{item.description}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-sm">
        <div className="text-slate-400">
          Total: {formatValue(data.reduce((sum, item) => sum + item.value, 0))}
        </div>
        <div className="text-slate-400">
          Sorted: {sortOrder === "asc" ? "Low to High" : "High to Low"}
        </div>
      </div>
    </div>
  );
};

export default EnhancedDataGrid;
