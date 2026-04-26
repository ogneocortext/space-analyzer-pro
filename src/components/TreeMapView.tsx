import React, { useMemo, useState, useCallback } from 'react';
import { FolderOpen, File, HardDrive, Zap, Search, Filter, ZoomIn, ZoomOut, RotateCcw, Download, ChevronRight, Home } from 'lucide-react';
import './TreeMapView.css';

interface TreeMapData {
  name: string;
  size: number;
  files: number;
  children?: TreeMapData[];
  color?: string;
  path?: string;
}

interface TreeMapViewProps {
  data: {
    categories: { [key: string]: { count: number; size: number } };
    files: Array<{ name: string; size: number; path: string; category: string }>;
  };
  width?: number;
  height?: number;
  className?: string;
}

interface BreadcrumbItem {
  name: string;
  data: TreeMapData[];
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f43f5e', '#a855f7', '#22c55e', '#f97316'
];

export const TreeMapView: React.FC<TreeMapViewProps> = ({
  data,
  width: defaultWidth = 800,
  height: defaultHeight = 500,
  className = ""
}) => {
  const [dimensions, setDimensions] = React.useState({ width: defaultWidth, height: defaultHeight });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Interactive state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TreeMapData | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [visualizationMode, setVisualizationMode] = useState<'treemap' | 'sunburst' | 'icicle'>('treemap');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ name: 'Root', data: [] }]);
  const [draggedNode, setDraggedNode] = useState<TreeMapData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Interactive handlers
  const handleNodeClick = useCallback((node: TreeMapData) => {
    if (node.name !== 'Back to Parent') {
      // Drill down into category
      const categoryFiles = data.files.filter(file => file.category === node.name);
      const subCategories = [...new Set(categoryFiles.map(file => {
        const pathParts = file.path.split('/');
        return pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : file.path;
      }))];

      const childNodes: TreeMapData[] = subCategories.map(subCat => {
        const subFiles = categoryFiles.filter(file => file.path.startsWith(subCat + '/'));
        const totalSize = subFiles.reduce((sum, file) => sum + file.size, 0);
        return {
          name: subCat.split('/').pop() || subCat,
          size: totalSize,
          files: subFiles.length,
          path: subCat,
          color: COLORS[Math.abs(subCat.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % COLORS.length]
        };
      });

      if (childNodes.length > 0) {
        setBreadcrumb(prev => [...prev, { name: node.name, data: childNodes }]);
        setSelectedCategory(node.name);
      }
    }
  }, [data.files]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === 0) {
      setBreadcrumb([{ name: 'Root', data: [] }]);
      setSelectedCategory(null);
    } else {
      setBreadcrumb(prev => prev.slice(0, index + 1));
      setSelectedCategory(breadcrumb[index].name);
    }
  }, [breadcrumb]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    setZoomLevel(prev => {
      if (direction === 'in') return Math.min(prev * 1.2, 3);
      if (direction === 'out') return Math.max(prev / 1.2, 0.5);
      return 1; // reset
    });
    if (direction === 'reset') {
      setPanOffset({ x: 0, y: 0 });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handleExport = useCallback(() => {
    // Export current visualization as image
    const svg = document.querySelector('.treemap-container svg');
    if (svg) {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = `treemap-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(svgStr);
    }
  }, []);

  // Handle responsive sizing
  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(400, rect.width - 32), // Account for padding
          height: Math.max(400, rect.height - 200) // Account for header, controls, and padding
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateDimensions(); // Initial measurement
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Handle null/undefined data gracefully
  if (!data || !data.categories) {
    return (
      <div className={`treemap-panel ${className}`} ref={containerRef}>
        <div className="treemap-header">
          <Zap className="treemap-icon" size={20} />
          <div className="treemap-title">Storage Distribution - Treemap View</div>
        </div>
        <div className="treemap-empty-message">
          <HardDrive size={48} className="treemap-empty-icon" />
          <p className="treemap-empty-text">No data available for visualization</p>
          <p className="treemap-empty-subtext">Run an analysis first to see the treemap visualization</p>
        </div>
      </div>
    );
  }

  // Build hierarchical data from flat file list with drill-down support
  const treeData = useMemo(() => {
    // If we're in a drilled-down state, show subdirectories
    if (breadcrumb.length > 1) {
      const currentLevel = breadcrumb[breadcrumb.length - 1];
      return currentLevel.data.length > 0 ? currentLevel.data : [];
    }

    // Root level - show categories
    const categories: { [key: string]: TreeMapData } = {};

    // Filter categories based on search query
    const filteredCategories = Object.entries(data.categories || {}).filter(([category]) =>
      searchQuery === '' || category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group files by category
    filteredCategories.forEach(([category, info], index) => {
      categories[category] = {
        name: category,
        size: info.size,
        files: info.count,
        color: COLORS[index % COLORS.length],
        children: []
      };
    });

    return Object.values(categories);
  }, [data, searchQuery, breadcrumb]);

  // Calculate treemap layout using squarified algorithm
  const layout = useMemo(() => {
    if (treeData.length === 0) return [];

    const totalSize = treeData.reduce((sum, node) => sum + node.size, 0);
    const padding = 2;
    const availableWidth = dimensions.width - padding * 2;
    const availableHeight = dimensions.height - padding * 2;

    // Sort by size descending for better layout
    const sorted = [...treeData].sort((a, b) => b.size - a.size);

    // Squarified treemap algorithm
    const result: Array<TreeMapData & { x: number; y: number; w: number; h: number }> = [];

    const squarify = (children: TreeMapData[], x: number, y: number, w: number, h: number) => {
      if (children.length === 0) return;

      const totalValue = children.reduce((sum, child) => sum + child.size, 0);

      // Handle single child
      if (children.length === 1) {
        const child = children[0];
        const childX = x + padding;
        const childY = y + padding;
        const childW = Math.max(0, w - padding * 2);
        const childH = Math.max(0, h - padding * 2);

        result.push({
          ...child,
          x: childX,
          y: childY,
          w: childW,
          h: childH
        });
        return;
      }

      // Determine orientation (wider or taller)
      const isHorizontal = w >= h;

      // Calculate aspect ratios for different splits
      let bestRatio = Infinity;
      let bestIndex = 1;

      for (let i = 1; i < children.length; i++) {
        const group1 = children.slice(0, i);
        const group2 = children.slice(i);

        const sum1 = group1.reduce((sum, child) => sum + child.size, 0);
        const sum2 = group2.reduce((sum, child) => sum + child.size, 0);

        const ratio1 = Math.max(sum1 * h / (sum1 * w / sum1), sum1 * w / (sum1 * h / sum1));
        const ratio2 = Math.max(sum2 * h / (sum2 * w / sum2), sum2 * w / (sum2 * h / sum2));

        const worstRatio = Math.max(ratio1, ratio2);

        if (worstRatio < bestRatio) {
          bestRatio = worstRatio;
          bestIndex = i;
        }
      }

      // Split at best index
      const group1 = children.slice(0, bestIndex);
      const group2 = children.slice(bestIndex);

      const sum1 = group1.reduce((sum, child) => sum + child.size, 0);
      const sum2 = group2.reduce((sum, child) => sum + child.size, 0);

      if (isHorizontal) {
        const w1 = (sum1 / totalValue) * w;
        const w2 = w - w1;

        squarify(group1, x, y, w1, h);
        squarify(group2, x + w1, y, w2, h);
      } else {
        const h1 = (sum1 / totalValue) * h;
        const h2 = h - h1;

        squarify(group1, x, y, w, h1);
        squarify(group2, x, y + h1, w, h2);
      }
    };

    // Start squarification from root
    squarify(sorted, padding, padding, availableWidth, availableHeight);

    return result;
  }, [treeData, dimensions]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedNode(null);
      setHoveredNode(null);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectedNode && breadcrumb.length === 1) {
        const node = treeData.find(n => n.name === selectedNode);
        if (node) {
          handleNodeClick(node);
        }
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIndex = treeData.findIndex(n => n.name === selectedNode);
      let newIndex = currentIndex;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        newIndex = Math.min(currentIndex + 1, treeData.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        newIndex = Math.max(currentIndex - 1, 0);
      }

      if (newIndex !== currentIndex && treeData[newIndex]) {
        setSelectedNode(treeData[newIndex].name);
      }
    } else if (e.key === 'Home' && breadcrumb.length > 1) {
      handleBreadcrumbClick(0);
    } else if (e.key === 'Backspace' && breadcrumb.length > 1) {
      handleBreadcrumbClick(breadcrumb.length - 2);
    }
  }, [selectedNode, treeData, breadcrumb.length, handleNodeClick, handleBreadcrumbClick]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (treeData.length === 0) {
    return (
      <section className="treemap-panel" aria-label="Treemap visualization">
        <header className="treemap-header">
          <Zap className="treemap-icon" size={20} aria-hidden="true" />
          <h2 className="treemap-title">Storage Distribution - Treemap View</h2>
        </header>
        <div className="treemap-empty-message">
          <HardDrive size={48} className="treemap-empty-icon" aria-hidden="true" />
          <p className="treemap-empty-text">No data available for visualization</p>
        </div>
      </section>
    );
  }

  return (
    <section className="treemap-panel" aria-label="Interactive Treemap visualization">
      <header className="treemap-header">
        <Zap className="treemap-icon" size={20} aria-hidden="true" />
        <div className="flex-1">
          <h2 className="treemap-title">Interactive Storage Visualization</h2>
          <p className="treemap-subtitle">Explore your storage with advanced filtering, drill-down, and multiple view modes</p>
        </div>
      </header>

      {/* Simplified Controls Bar */}
      <div className="treemap-controls-bar">
        <div className="treemap-search-container">
          <Search size={16} className="treemap-search-icon" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="treemap-search-input"
          />
        </div>

        <div className="treemap-control-buttons">
          <button
            onClick={() => handleZoom('in')}
            className="treemap-control-btn"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="treemap-control-btn"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => handleZoom('reset')}
            className="treemap-control-btn"
            title="Reset View"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {breadcrumb.length > 1 && (
        <div className="treemap-breadcrumb">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={index}>
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`treemap-breadcrumb-item ${index === breadcrumb.length - 1 ? 'active' : ''}`}
              >
                {index === 0 ? <Home size={14} /> : item.name}
              </button>
              {index < breadcrumb.length - 1 && (
                <ChevronRight size={14} className="treemap-breadcrumb-separator" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <div
        className="treemap-container"
        role="img"
        aria-label={`Interactive treemap showing ${treeData.length} storage ${breadcrumb.length > 1 ? 'subdirectories' : 'categories'}`}
        style={{
          position: 'relative',
          height: dimensions.height,
          width: '100%',
          transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: 'top left'
        }}
        onMouseMove={handleMouseMove}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        ref={containerRef}
      >
        {layout.map((node, index) => (
          <div
            key={`${node.name}-${index}`}
            className={`treemap-node ${selectedCategory === node.name ? 'selected' : ''}`}
            style={{
              left: node.x,
              top: node.y,
              width: node.w,
              height: node.h,
              backgroundColor: node.color,
              cursor: breadcrumb.length === 1 ? 'pointer' : 'default'
            }}
            onClick={() => breadcrumb.length === 1 && handleNodeClick(node)}
            onMouseEnter={() => setHoveredNode(node)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <div className={`treemap-node-content ${node.w > 100 ? 'treemap-node-large' : node.w > 50 ? 'treemap-node-medium' : 'treemap-node-small'}`}>
              <div className="treemap-node-name">{node.name}</div>
              <div className="treemap-node-size">{formatSize(node.size)}</div>
              <div className="treemap-node-files">{node.files} files</div>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced Tooltip */}
      {hoveredNode && (
        <div
          className="treemap-tooltip"
          style={{
            left: tooltipPosition.x + 15,
            top: tooltipPosition.y - 15,
            position: 'fixed'
          }}
        >
          <div className="treemap-tooltip-header">
            <strong>{hoveredNode.name}</strong>
          </div>
          <div className="treemap-tooltip-content">
            <div>Size: {formatSize(hoveredNode.size)}</div>
            <div>Files: {hoveredNode.files.toLocaleString()}</div>
            {hoveredNode.path && <div>Path: {hoveredNode.path}</div>}
            {breadcrumb.length === 1 && <div className="treemap-tooltip-hint">Click to drill down</div>}
          </div>
        </div>
      )}

      {/* Consolidated Information Panel */}
      <div className="treemap-info-panel">
        <div className="treemap-info-header">
          <h3>Storage Overview</h3>
          <div className="treemap-info-stats">
            <span>{treeData.length} categories</span>
            <span>{treeData.reduce((sum, n) => sum + n.files, 0).toLocaleString()} files</span>
            <span>{formatSize(treeData.reduce((sum, n) => sum + n.size, 0))}</span>
          </div>
        </div>

        <div className="treemap-info-content">
          <div className="treemap-categories-list">
            {treeData.slice(0, 8).map((node, index) => (
              <div
                key={node.name}
                className="treemap-category-item"
                onClick={() => breadcrumb.length === 1 && handleNodeClick(node)}
                style={{ cursor: breadcrumb.length === 1 ? 'pointer' : 'default' }}
              >
                <div className="treemap-category-color" style={{ backgroundColor: node.color || COLORS[index % COLORS.length] }}></div>
                <div className="treemap-category-info">
                  <div className="treemap-category-name">{node.name}</div>
                  <div className="treemap-category-details">
                    {formatSize(node.size)} " {node.files} files " {((node.size / treeData.reduce((sum, n) => sum + n.size, 0)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TreeMapView;