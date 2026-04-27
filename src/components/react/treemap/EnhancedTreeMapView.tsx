import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Home,
  ChevronRight,
  Grid3x3,
  Layers,
  Sun,
  MousePointer,
  Eye,
  EyeOff,
  Settings,
  Maximize2,
  Minimize2,
  Palette,
  HelpCircle,
  X,
} from "lucide-react";
import styles from "./EnhancedTreeMapView.module.css";

interface TreeMapData {
  name: string;
  size: number;
  files: number;
  children?: TreeMapData[];
  color?: string;
  path?: string;
  category?: string;
}

interface BreadcrumbItem {
  name: string;
  data: TreeMapData[];
  path: string;
}

interface EnhancedTreeMapViewProps {
  data: {
    categories: { [key: string]: { count: number; size: number } };
    files: Array<{ name: string; size: number; path: string; category: string }>;
  };
  width?: number;
  height?: number;
  onNodeClick?: (node: TreeMapData) => void;
  onExport?: (format: "png" | "svg" | "json") => void;
}

// Colorblind-friendly palette
const COLOR_PALETTES = {
  default: [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#f43f5e",
    "#a855f7",
    "#22c55e",
    "#f97316",
  ],
  colorblind: [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ],
  highContrast: [
    "#ffffff",
    "#cccccc",
    "#999999",
    "#666666",
    "#333333",
    "#000000",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
  ],
};

const EnhancedTreeMapView: React.FC<EnhancedTreeMapViewProps> = ({
  data,
  width = 800,
  height = 500,
  onNodeClick,
  onExport,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State management
  const [dimensions, setDimensions] = useState({ width, height });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeMapData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TreeMapData | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [visualizationMode, setVisualizationMode] = useState<"treemap" | "sunburst" | "icicle">(
    "treemap"
  );
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { name: "Root", data: [], path: "" },
  ]);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [colorPalette, setColorPalette] = useState<keyof typeof COLOR_PALETTES>("default");
  const [minNodeSize, setMinNodeSize] = useState(20);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Touch state for mobile
  const [touchState, setTouchState] = useState({
    isTouching: false,
    lastTouchDistance: 0,
    lastTouchCenter: { x: 0, y: 0 },
    isPanning: false,
    lastPanPoint: { x: 0, y: 0 },
  });

  // Process data with filters
  const processedData = useMemo(() => {
    let categories = Object.entries(data.categories);

    // Apply search filter
    if (searchQuery) {
      categories = categories.filter(([category]) =>
        category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Convert to TreeMapData format
    const treeData: TreeMapData[] = categories.map(([category, info], index) => ({
      name: category,
      size: info.size,
      files: info.count,
      color: COLOR_PALETTES[colorPalette][index % COLOR_PALETTES[colorPalette].length],
      category,
      children: [],
    }));

    // Apply breadcrumb filtering
    if (breadcrumb.length > 1) {
      const currentCategory = breadcrumb[breadcrumb.length - 1].name;
      const categoryFiles = data.files.filter((file) => file.category === currentCategory);
      const subCategories = [
        ...new Set(
          categoryFiles.map((file) => {
            const pathParts = file.path.split("/");
            return pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : file.path;
          })
        ),
      ];

      return subCategories.map((subCat, index) => {
        const subFiles = categoryFiles.filter((file) => file.path.startsWith(subCat + "/"));
        const totalSize = subFiles.reduce((sum, file) => sum + file.size, 0);
        return {
          name: subCat.split("/").pop() || subCat,
          size: totalSize,
          files: subFiles.length,
          path: subCat,
          color: COLOR_PALETTES[colorPalette][index % COLOR_PALETTES[colorPalette].length],
          category: currentCategory,
        };
      });
    }

    return treeData;
  }, [data, searchQuery, breadcrumb, colorPalette]);

  // Enhanced squarified treemap algorithm with minimum size constraints
  const layout = useMemo(() => {
    if (processedData.length === 0) return [];

    const totalSize = processedData.reduce((sum, node) => sum + node.size, 0);
    const padding = 4;
    const availableWidth = dimensions.width - padding * 2;
    const availableHeight = dimensions.height - padding * 2;

    // Sort by size descending and filter by minimum size
    const sorted = [...processedData]
      .sort((a, b) => b.size - a.size)
      .filter(
        (node) => (node.size / totalSize) * Math.min(availableWidth, availableHeight) >= minNodeSize
      );

    const result: Array<TreeMapData & { x: number; y: number; w: number; h: number }> = [];

    const squarify = (children: TreeMapData[], x: number, y: number, w: number, h: number) => {
      if (children.length === 0) return;

      const totalValue = children.reduce((sum, child) => sum + child.size, 0);

      // Handle single child
      if (children.length === 1) {
        const child = children[0];
        const childX = x + padding;
        const childY = y + padding;
        const childW = Math.max(minNodeSize, Math.max(0, w - padding * 2));
        const childH = Math.max(minNodeSize, Math.max(0, h - padding * 2));

        result.push({
          ...child,
          x: childX,
          y: childY,
          w: childW,
          h: childH,
        });
        return;
      }

      // Enhanced aspect ratio calculation
      const isHorizontal = w >= h;
      let bestRatio = Infinity;
      let bestIndex = 1;

      for (let i = 1; i <= children.length; i++) {
        const group1 = children.slice(0, i);
        const group2 = children.slice(i);

        const sum1 = group1.reduce((sum, child) => sum + child.size, 0);
        const sum2 = group2.reduce((sum, child) => sum + child.size, 0);

        // Calculate worst aspect ratio
        const ratio1 = isHorizontal
          ? Math.max((sum1 * h) / ((sum1 * w) / sum1), (sum1 * w) / ((sum1 * h) / sum1))
          : Math.max((sum1 * w) / ((sum1 * h) / sum1), (sum1 * h) / ((sum1 * w) / sum1));

        const ratio2 = isHorizontal
          ? Math.max((sum2 * h) / ((sum2 * w) / sum2), (sum2 * w) / ((sum2 * h) / sum2))
          : Math.max((sum2 * w) / ((sum2 * h) / sum2), (sum2 * h) / ((sum2 * w) / sum2));

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
        const w1 = Math.max(minNodeSize, (sum1 / totalValue) * w);
        const w2 = Math.max(minNodeSize, w - w1);

        if (w1 >= minNodeSize && w2 >= minNodeSize) {
          squarify(group1, x, y, w1, h);
          squarify(group2, x + w1, y, w2, h);
        } else {
          // Fallback: stack vertically
          const h1 = Math.max(minNodeSize, (sum1 / totalValue) * h);
          const h2 = Math.max(minNodeSize, h - h1);
          squarify(group1, x, y, w, h1);
          squarify(group2, x, y + h1, w, h2);
        }
      } else {
        const h1 = Math.max(minNodeSize, (sum1 / totalValue) * h);
        const h2 = Math.max(minNodeSize, h - h1);

        if (h1 >= minNodeSize && h2 >= minNodeSize) {
          squarify(group1, x, y, w, h1);
          squarify(group2, x, y + h1, w, h2);
        } else {
          // Fallback: stack horizontally
          const w1 = Math.max(minNodeSize, (sum1 / totalValue) * w);
          const w2 = Math.max(minNodeSize, w - w1);
          squarify(group1, x, y, w1, h);
          squarify(group2, x + w1, y, w2, h);
        }
      }
    };

    // Start squarification
    squarify(sorted, padding, padding, availableWidth, availableHeight);
    return result;
  }, [processedData, dimensions, minNodeSize]);

  // Format file size
  const formatSize = useCallback((bytes: number) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  // Event handlers
  const handleNodeClick = useCallback(
    (node: TreeMapData) => {
      setSelectedNode(node);
      onNodeClick?.(node);

      // Drill down functionality
      if (breadcrumb.length === 1 && node.children === undefined) {
        const categoryFiles = data.files.filter((file) => file.category === node.name);
        const subCategories = [
          ...new Set(
            categoryFiles.map((file) => {
              const pathParts = file.path.split("/");
              return pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : file.path;
            })
          ),
        ];

        const childNodes: TreeMapData[] = subCategories.map((subCat, index) => {
          const subFiles = categoryFiles.filter((file) => file.path.startsWith(subCat + "/"));
          const totalSize = subFiles.reduce((sum, file) => sum + file.size, 0);
          return {
            name: subCat.split("/").pop() || subCat,
            size: totalSize,
            files: subFiles.length,
            path: subCat,
            color: COLOR_PALETTES[colorPalette][index % COLOR_PALETTES[colorPalette].length],
            category: node.name,
          };
        });

        if (childNodes.length > 0) {
          setBreadcrumb((prev) => [
            ...prev,
            { name: node.name, data: childNodes, path: node.path || "" },
          ]);
          setSelectedCategory(node.name);
        }
      }
    },
    [breadcrumb, data.files, colorPalette, onNodeClick]
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      if (index === 0) {
        setBreadcrumb([{ name: "Root", data: [], path: "" }]);
        setSelectedCategory(null);
      } else {
        setBreadcrumb((prev) => prev.slice(0, index + 1));
        setSelectedCategory(breadcrumb[index].name);
      }
    },
    [breadcrumb]
  );

  const handleZoom = useCallback((direction: "in" | "out" | "reset") => {
    setZoomLevel((prev) => {
      if (direction === "in") return Math.min(prev * 1.2, 3);
      if (direction === "out") return Math.max(prev / 1.2, 0.5);
      return 1;
    });
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      setTouchState((prev) => ({
        ...prev,
        isTouching: true,
        isPanning: true,
        lastTouchCenter: {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        },
        lastPanPoint: {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        },
      }));
    } else if (event.touches.length === 2) {
      const dx = event.touches[1].clientX - event.touches[0].clientX;
      const dy = event.touches[1].clientY - event.touches[0].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      setTouchState((prev) => ({
        ...prev,
        isTouching: true,
        isPanning: false,
        lastTouchDistance: distance,
        lastTouchCenter: {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
        },
      }));
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length === 1 && touchState.isPanning) {
        // Pan
        const dx = event.touches[0].clientX - touchState.lastPanPoint.x;
        const dy = event.touches[0].clientY - touchState.lastPanPoint.y;

        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setTouchState((prev) => ({
          ...prev,
          lastPanPoint: {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          },
        }));
      } else if (event.touches.length === 2) {
        // Zoom
        const dx = event.touches[1].clientX - event.touches[0].clientX;
        const dy = event.touches[1].clientY - event.touches[0].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (touchState.lastTouchDistance > 0) {
          const scale = distance / touchState.lastTouchDistance;
          setZoomLevel((prev) => Math.max(0.5, Math.min(3, prev * scale)));
        }

        setTouchState((prev) => ({
          ...prev,
          lastTouchDistance: distance,
          lastTouchCenter: {
            x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
            y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
          },
        }));
      }
    },
    [touchState]
  );

  const handleTouchEnd = useCallback(() => {
    setTouchState({
      isTouching: false,
      lastTouchDistance: 0,
      lastTouchCenter: { x: 0, y: 0 },
      isPanning: false,
      lastPanPoint: { x: 0, y: 0 },
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "+":
        case "=":
          handleZoom("in");
          break;
        case "-":
        case "_":
          handleZoom("out");
          break;
        case "0":
          handleZoom("reset");
          break;
        case "l":
          setShowLabels((prev) => !prev);
          break;
        case "g":
          setShowGrid((prev) => !prev);
          break;
        case "f":
          setIsFullscreen((prev) => !prev);
          break;
        case "Escape":
          setSelectedNode(null);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleZoom]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div className={styles.enhancedTreeMapView} ref={containerRef}>
      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controlSection}>
          <div className={styles.searchContainer}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.viewModeSelector}>
            <button
              onClick={() => setVisualizationMode("treemap")}
              className={`${styles.viewModeButton} ${visualizationMode === "treemap" ? styles.active : ""}`}
              title="Treemap View"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => setVisualizationMode("sunburst")}
              className={`${styles.viewModeButton} ${visualizationMode === "sunburst" ? styles.active : ""}`}
              title="Sunburst View"
            >
              <Sun size={16} />
            </button>
            <button
              onClick={() => setVisualizationMode("icicle")}
              className={`${styles.viewModeButton} ${visualizationMode === "icicle" ? styles.active : ""}`}
              title="Icicle View"
            >
              <Layers size={16} />
            </button>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.zoomControls}>
            <button
              onClick={() => handleZoom("out")}
              className={styles.controlButton}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <div className={styles.zoomIndicator}>{Math.round(zoomLevel * 100)}%</div>
            <button
              onClick={() => handleZoom("in")}
              className={styles.controlButton}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => handleZoom("reset")}
              className={styles.controlButton}
              title="Reset View"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.displayControls}>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`${styles.controlButton} ${showLabels ? styles.active : ""}`}
              title="Toggle Labels"
            >
              {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`${styles.controlButton} ${showGrid ? styles.active : ""}`}
              title="Toggle Grid"
            >
              <Grid3x3 size={16} />
            </button>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.colorPaletteSelector}>
            <button
              onClick={() => setColorPalette("default")}
              className={`${styles.paletteButton} ${colorPalette === "default" ? styles.active : ""}`}
              title="Default Colors"
            >
              <Palette size={16} />
            </button>
            <button
              onClick={() => setColorPalette("colorblind")}
              className={`${styles.paletteButton} ${colorPalette === "colorblind" ? styles.active : ""}`}
              title="Colorblind Friendly"
            >
              <Palette size={16} />
            </button>
            <button
              onClick={() => setColorPalette("highContrast")}
              className={`${styles.paletteButton} ${colorPalette === "highContrast" ? styles.active : ""}`}
              title="High Contrast"
            >
              <Palette size={16} />
            </button>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.actionControls}>
            <button
              onClick={toggleFullscreen}
              className={styles.controlButton}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={() => onExport?.("png")}
              className={styles.controlButton}
              title="Export as PNG"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={styles.controlButton}
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className={styles.breadcrumbNavigation}>
        {breadcrumb.map((item, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={`${styles.breadcrumbItem} ${index === breadcrumb.length - 1 ? styles.active : ""}`}
            >
              {index === 0 ? <Home size={14} /> : item.name}
            </button>
            {index < breadcrumb.length - 1 && (
              <ChevronRight size={14} className={styles.breadcrumbSeparator} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Treemap Container */}
      <div
        className={styles.treemapContainer}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: "top left",
        }}
      >
        {/* Grid Background */}
        {showGrid && <div className={styles.gridBackground} />}

        {/* Treemap Nodes */}
        {layout.map((node, index) => (
          <motion.div
            key={`${node.name}-${index}`}
            className={`${styles.treemapNode} ${selectedNode?.name === node.name ? styles.selected : ""}`}
            style={{
              left: node.x,
              top: node.y,
              width: node.w,
              height: node.h,
              backgroundColor: node.color,
              cursor: breadcrumb.length === 1 ? "pointer" : "default",
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02, zIndex: 10 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => breadcrumb.length === 1 && handleNodeClick(node)}
            onMouseEnter={() => setHoveredNode(node)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <div
              className={`${styles.nodeContent} ${node.w > 100 ? styles.large : node.w > 50 ? styles.medium : styles.small}`}
            >
              {showLabels && (
                <>
                  <div className={styles.nodeName}>{node.name}</div>
                  <div className={styles.nodeSize}>{formatSize(node.size)}</div>
                  <div className={styles.nodeFiles}>{node.files} files</div>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Enhanced Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            className={styles.tooltip}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              left: tooltipPosition.x + 15,
              top: tooltipPosition.y - 15,
              position: "absolute",
            }}
          >
            <div className={styles.tooltipHeader}>
              <strong>{hoveredNode.name}</strong>
            </div>
            <div className={styles.tooltipContent}>
              <div>Size: {formatSize(hoveredNode.size)}</div>
              <div>Files: {hoveredNode.files.toLocaleString()}</div>
              {hoveredNode.path && <div>Path: {hoveredNode.path}</div>}
              {hoveredNode.category && <div>Category: {hoveredNode.category}</div>}
              {breadcrumb.length === 1 && (
                <div className={styles.tooltipHint}>Click to drill down</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Information Panel */}
      <div className={styles.infoPanel}>
        <div className={styles.infoHeader}>
          <h3>Storage Overview</h3>
        </div>
        <div className={styles.infoStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Categories</span>
            <span className={styles.statValue}>{processedData.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Files</span>
            <span className={styles.statValue}>
              {processedData.reduce((sum, n) => sum + n.files, 0).toLocaleString()}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total Size</span>
            <span className={styles.statValue}>
              {formatSize(processedData.reduce((sum, n) => sum + n.size, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className={styles.helpOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.helpContent}>
              <div className={styles.helpHeader}>
                <h3>TreeMap Help</h3>
                <button onClick={() => setShowHelp(false)} className={styles.helpClose}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Controls</h4>
                  <ul>
                    <li>
                      <kbd>Click</kbd> - Select node
                    </li>
                    <li>
                      <kbd>+/-</kbd> - Zoom in/out
                    </li>
                    <li>
                      <kbd>0</kbd> - Reset view
                    </li>
                    <li>
                      <kbd>L</kbd> - Toggle labels
                    </li>
                    <li>
                      <kbd>G</kbd> - Toggle grid
                    </li>
                    <li>
                      <kbd>F</kbd> - Fullscreen
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Touch Gestures</h4>
                  <ul>
                    <li>
                      <strong>Tap</strong> - Select node
                    </li>
                    <li>
                      <strong>Pinch</strong> - Zoom
                    </li>
                    <li>
                      <strong>Drag</strong> - Pan
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Color Palettes</h4>
                  <ul>
                    <li>
                      <span className={styles.paletteDefault}>Default</span> - Standard colors
                    </li>
                    <li>
                      <span className={styles.paletteColorblind}>Colorblind</span> - Accessible
                      colors
                    </li>
                    <li>
                      <span className={styles.paletteHighContrast}>High Contrast</span> - Maximum
                      contrast
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedTreeMapView;
