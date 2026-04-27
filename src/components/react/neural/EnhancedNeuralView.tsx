import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Network,
  Activity,
  Zap,
  HelpCircle,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  MousePointer,
  // Touchpin,
  Eye,
  EyeOff,
  Layers,
  Filter,
  Download,
  Share2,
} from "lucide-react";
import styles from "./EnhancedNeuralView.module.css";

interface NeuralNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: "file" | "directory" | "pattern";
  label: string;
  connections: string[];
  fileType?: "video" | "document" | "system" | "other";
  fileSize?: number;
  accessFrequency?: number;
  color?: string;
  clusterId?: string;
  pinned?: boolean;
  visible?: boolean;
  level?: number;
}

interface NeuralConnection {
  from: string;
  to: string;
  strength: number;
  type: "similarity" | "dependency" | "access";
  visible?: boolean;
  color?: string;
}

interface NeuralMetrics {
  neuralDensity: number;
  connectionStrength: number;
  patternRecognition: number;
  anomalyScore: number;
  processingTime: number;
  activeNodes: number;
  totalConnections: number;
  fps: number;
}

interface EnhancedNeuralViewProps {
  data: {
    nodes: NeuralNode[];
    connections: NeuralConnection[];
    metrics: NeuralMetrics;
  };
  isLoading?: boolean;
  error?: string | null;
  onNodeClick?: (node: NeuralNode) => void;
  onExport?: () => void;
  onShare?: () => void;
}

const EnhancedNeuralView: React.FC<EnhancedNeuralViewProps> = ({
  data,
  isLoading,
  error,
  onNodeClick,
  onExport,
  onShare,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const webWorkerRef = useRef<Worker | undefined>(undefined);

  // View state
  const [isPlaying, setIsPlaying] = useState(true);
  const [viewMode, setViewMode] = useState<"network" | "heatmap" | "graph" | "cluster">("network");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [connectionFilter, setConnectionFilter] = useState<"all" | "strong" | "weak">("all");
  const [nodeFilter, setNodeFilter] = useState<"all" | "files" | "directories">("all");

  // Interaction state
  const [hoveredNode, setHoveredNode] = useState<NeuralNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<NeuralNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Performance state
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [performanceStats, setPerformanceStats] = useState({
    fps: 0,
    nodes: 0,
    connections: 0,
    processingTime: 0,
  });

  // Touch state for mobile
  const [touchState, setTouchState] = useState({
    isTouching: false,
    lastTouchDistance: 0,
    lastTouchCenter: { x: 0, y: 0 },
  });

  // Processed data with filters
  const processedData = useMemo(() => {
    const filteredNodes = data.nodes
      .filter((node) => {
        if (nodeFilter === "files") return node.type === "file";
        if (nodeFilter === "directories") return node.type === "directory";
        return true;
      })
      .map((node) => ({
        ...node,
        visible: true,
        level: node.type === "directory" ? 0 : 1,
      }));

    const filteredConnections = data.connections
      .filter((conn) => {
        if (!showConnections) return false;
        if (connectionFilter === "strong") return conn.strength > 0.7;
        if (connectionFilter === "weak") return conn.strength <= 0.7;
        return true;
      })
      .map((conn) => ({
        ...conn,
        visible:
          filteredNodes.some((n) => n.id === conn.from) &&
          filteredNodes.some((n) => n.id === conn.to),
      }));

    return { nodes: filteredNodes, connections: filteredConnections };
  }, [data.nodes, data.connections, showConnections, connectionFilter, nodeFilter]);

  // Initialize Web Worker for physics calculations
  useEffect(() => {
    if (typeof Worker !== "undefined") {
      const workerCode = `
        self.onmessage = function(e) {
          const { nodes, connections, type } = e.data;
          
          if (type === 'physics') {
            // Simplified physics calculation
            const updatedNodes = nodes.map(node => {
              let fx = 0, fy = 0;
              
              // Repulsion forces
              nodes.forEach(other => {
                if (node.id !== other.id) {
                  const dx = node.x - other.x;
                  const dy = node.y - other.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist > 0 && dist < 100) {
                    const force = 50 / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                  }
                }
              });
              
              // Attraction forces
              node.connections.forEach(connId => {
                const target = nodes.find(n => n.id === connId);
                if (target) {
                  const dx = target.x - node.x;
                  const dy = target.y - node.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist > 20) {
                    const force = 0.001 * dist;
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                  }
                }
              });
              
              // Apply forces with damping
              const damping = 0.9;
              return {
                ...node,
                vx: (node.vx + fx) * damping,
                vy: (node.vy + fy) * damping,
                x: Math.max(10, Math.min(790, node.x + node.vx)),
                y: Math.max(10, Math.min(590, node.y + node.vy))
              };
            });
            
            self.postMessage({ type: 'physics-update', nodes: updatedNodes });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      webWorkerRef.current = new Worker(URL.createObjectURL(blob));

      webWorkerRef.current.onmessage = (e) => {
        if (e.data.type === "physics-update") {
          // Handle physics updates
        }
      };
    }

    return () => {
      if (webWorkerRef.current) {
        webWorkerRef.current.terminate();
      }
    };
  }, []);

  // Canvas rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    // Render connections
    if (showConnections) {
      processedData.connections.forEach((conn) => {
        const fromNode = processedData.nodes.find((n) => n.id === conn.from);
        const toNode = processedData.nodes.find((n) => n.id === conn.to);

        if (fromNode && toNode && fromNode.visible && toNode.visible) {
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);

          // Color based on connection type and strength
          const opacity = Math.min(1, conn.strength);
          if (conn.type === "similarity") {
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.6})`;
          } else if (conn.type === "dependency") {
            ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.6})`;
          } else {
            ctx.strokeStyle = `rgba(245, 158, 11, ${opacity * 0.6})`;
          }

          ctx.lineWidth = Math.max(1, conn.strength * 2);
          ctx.stroke();
        }
      });
    }

    // Render nodes
    processedData.nodes.forEach((node) => {
      if (!node.visible) return;

      // Node styling based on type
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;

      ctx.beginPath();

      if (node.type === "directory") {
        // Square for directories
        ctx.rect(node.x - node.size, node.y - node.size, node.size * 2, node.size * 2);
      } else {
        // Circle for files
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
      }

      // Node color based on type and state
      if (isSelected) {
        ctx.fillStyle = "#3b82f6";
        ctx.strokeStyle = "#60a5fa";
      } else if (isHovered) {
        ctx.fillStyle = "#8b5cf6";
        ctx.strokeStyle = "#a78bfa";
      } else if (node.type === "directory") {
        ctx.fillStyle = "#06b6d4";
        ctx.strokeStyle = "#22d3ee";
      } else {
        ctx.fillStyle = "#8b5cf6";
        ctx.strokeStyle = "#a78bfa";
      }

      ctx.fill();
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();

      // Render labels if enabled
      if (showLabels && node.label) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Add text background for better readability
        const textWidth = ctx.measureText(node.label).width;
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(node.x - textWidth / 2 - 4, node.y - 8, textWidth + 8, 16);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(node.label, node.x, node.y);
      }
    });

    ctx.restore();

    // Update performance stats
    const processingTime = performance.now() - startTime;
    setPerformanceStats((prev) => ({
      ...prev,
      processingTime,
      nodes: processedData.nodes.length,
      connections: processedData.connections.length,
    }));
  }, [processedData, zoomLevel, panOffset, showConnections, showLabels, hoveredNode, selectedNode]);

  // Animation loop
  const animate = useCallback(() => {
    if (!isPlaying) return;

    // Send physics calculations to Web Worker
    if (webWorkerRef.current && processedData.nodes.length > 0) {
      webWorkerRef.current.postMessage({
        type: "physics",
        nodes: processedData.nodes,
        connections: processedData.connections,
      });
    }

    render();
    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying, processedData, render]);

  // Handle canvas interactions
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - panOffset.x) / zoomLevel;
      const y = (event.clientY - rect.top - panOffset.y) / zoomLevel;

      // Find clicked node
      const clickedNode = processedData.nodes.find((node) => {
        if (node.type === "directory") {
          return (
            x >= node.x - node.size &&
            x <= node.x + node.size &&
            y >= node.y - node.size &&
            y <= node.y + node.size
          );
        } else {
          const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
          return dist <= node.size;
        }
      });

      if (clickedNode) {
        setSelectedNode(clickedNode);
        onNodeClick?.(clickedNode);
      } else {
        setSelectedNode(null);
      }
    },
    [processedData, zoomLevel, panOffset, onNodeClick]
  );

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - panOffset.x) / zoomLevel;
      const y = (event.clientY - rect.top - panOffset.y) / zoomLevel;

      if (isPanning) {
        const dx = event.clientX - lastPanPoint.x;
        const dy = event.clientY - lastPanPoint.y;
        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastPanPoint({ x: event.clientX, y: event.clientY });
      } else {
        // Find hovered node
        const hoveredNode = processedData.nodes.find((node) => {
          if (node.type === "directory") {
            return (
              x >= node.x - node.size &&
              x <= node.x + node.size &&
              y >= node.y - node.size &&
              y <= node.y + node.size
            );
          } else {
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            return dist <= node.size;
          }
        });

        setHoveredNode(hoveredNode || null);
      }

      setMousePos({ x: event.clientX, y: event.clientY });
    },
    [processedData, zoomLevel, panOffset, isPanning, lastPanPoint]
  );

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 0) {
      // Left click
      setIsPanning(true);
      setLastPanPoint({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 1) {
      setTouchState((prev) => ({
        ...prev,
        isTouching: true,
        lastTouchCenter: {
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
        lastTouchDistance: distance,
        lastTouchCenter: {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
        },
      }));
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      if (event.touches.length === 1 && touchState.isTouching) {
        // Pan
        const dx = event.touches[0].clientX - touchState.lastTouchCenter.x;
        const dy = event.touches[0].clientY - touchState.lastTouchCenter.y;

        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setTouchState((prev) => ({
          ...prev,
          lastTouchCenter: {
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
    });
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(3, prev * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(0.5, prev / 1.2));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case " ":
          setIsPlaying((prev) => !prev);
          break;
        case "r":
          handleZoomReset();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
        case "_":
          handleZoomOut();
          break;
        case "l":
          setShowLabels((prev) => !prev);
          break;
        case "c":
          setShowConnections((prev) => !prev);
          break;
        case "Escape":
          setSelectedNode(null);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

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

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animate]);

  return (
    <div className={styles.enhancedNeuralView} ref={containerRef}>
      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controlSection}>
          <div className={styles.playbackControls}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={styles.controlButton}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={handleZoomReset} className={styles.controlButton} title="Reset View">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className={styles.viewControls}>
            <div className={styles.viewModeSelector}>
              <button
                onClick={() => setViewMode("network")}
                className={`${styles.viewModeButton} ${viewMode === "network" ? styles.active : ""}`}
                title="Network View"
              >
                <Network size={16} />
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={`${styles.viewModeButton} ${viewMode === "heatmap" ? styles.active : ""}`}
                title="Heatmap View"
              >
                <Activity size={16} />
              </button>
              <button
                onClick={() => setViewMode("graph")}
                className={`${styles.viewModeButton} ${viewMode === "graph" ? styles.active : ""}`}
                title="Graph View"
              >
                <Grid3x3 size={16} />
              </button>
              <button
                onClick={() => setViewMode("cluster")}
                className={`${styles.viewModeButton} ${viewMode === "cluster" ? styles.active : ""}`}
                title="Cluster View"
              >
                <Layers size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.zoomControls}>
            <button onClick={handleZoomOut} className={styles.controlButton} title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <div className={styles.zoomIndicator}>{Math.round(zoomLevel * 100)}%</div>
            <button onClick={handleZoomIn} className={styles.controlButton} title="Zoom In">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.filterControls}>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`${styles.controlButton} ${showLabels ? styles.active : ""}`}
              title="Toggle Labels"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={() => setShowConnections(!showConnections)}
              className={`${styles.controlButton} ${showConnections ? styles.active : ""}`}
              title="Toggle Connections"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>

        <div className={styles.controlSection}>
          <div className={styles.actionControls}>
            <button onClick={onExport} className={styles.controlButton} title="Export">
              <Download size={16} />
            </button>
            <button onClick={onShare} className={styles.controlButton} title="Share">
              <Share2 size={16} />
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

      {/* Canvas */}
      <div className={styles.canvasContainer}>
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className={styles.neuralCanvas}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => setHoveredNode(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Node Tooltip */}
        <AnimatePresence>
          {hoveredNode && (
            <motion.div
              className={styles.nodeTooltip}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                position: "fixed",
                left: mousePos.x + 10,
                top: mousePos.y - 40,
                zIndex: 1000,
              }}
            >
              <div className={styles.tooltipContent}>
                <div className={styles.tooltipTitle}>{hoveredNode.label}</div>
                <div className={styles.tooltipDetails}>
                  <div>Type: {hoveredNode.type}</div>
                  {hoveredNode.fileSize && (
                    <div>Size: {(hoveredNode.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                  )}
                  {hoveredNode.connections && (
                    <div>Connections: {hoveredNode.connections.length}</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}>
              <Zap size={24} className={styles.spinnerIcon} />
            </div>
            <div className={styles.loadingText}>Analyzing neural patterns...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>⚠️</div>
            <div className={styles.errorText}>Neural analysis error: {error}</div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && processedData.nodes.length === 0 && (
          <div className={styles.emptyState}>
            <Brain size={48} className={styles.emptyIcon} />
            <div className={styles.emptyText}>No neural data available</div>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className={styles.metricsPanel}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>FPS</span>
          <span className={styles.metricValue}>{performanceStats.fps}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Nodes</span>
          <span className={styles.metricValue}>{performanceStats.nodes}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Connections</span>
          <span className={styles.metricValue}>{performanceStats.connections}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Processing</span>
          <span className={styles.metricValue}>{performanceStats.processingTime.toFixed(1)}ms</span>
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
                <h3 className={styles.helpTitle}>
                  <Brain className={styles.helpIcon} />
                  Neural View Help
                </h3>
                <button onClick={() => setShowHelp(false)} className={styles.helpClose}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Controls</h4>
                  <ul>
                    <li>
                      <kbd>Space</kbd> - Play/Pause animation
                    </li>
                    <li>
                      <kbd>R</kbd> - Reset view
                    </li>
                    <li>
                      <kbd>+/-</kbd> - Zoom in/out
                    </li>
                    <li>
                      <kbd>L</kbd> - Toggle labels
                    </li>
                    <li>
                      <kbd>C</kbd> - Toggle connections
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Interactions</h4>
                  <ul>
                    <li>Click nodes to select</li>
                    <li>Drag to pan the view</li>
                    <li>Pinch to zoom (mobile)</li>
                    <li>Hover for node details</li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Node Types</h4>
                  <ul>
                    <li>
                      <span className={styles.nodeIndicatorDirectory}></span> Directories
                    </li>
                    <li>
                      <span className={styles.nodeIndicatorFile}></span> Files
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

export default EnhancedNeuralView;
