import React, { useState, useRef, useEffect } from "react";
import styles from "./InteractiveTreemap.module.css";

interface TreemapNode {
  id: string;
  name: string;
  size: number;
  color?: string;
  children?: TreemapNode[];
  path?: string;
  type?: "file" | "directory";
}

interface InteractiveTreemapProps {
  data: TreemapNode[];
  width?: number;
  height?: number;
  onNodeClick?: (node: TreemapNode) => void;
  onNodeHover?: (node: TreemapNode | null) => void;
  maxDepth?: number;
}

const InteractiveTreemap: React.FC<InteractiveTreemapProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover,
  maxDepth = 3,
}) => {
  const [hoveredNode, setHoveredNode] = useState<TreemapNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreemapNode | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const calculateTreemapLayout = (
    nodes: TreemapNode[],
    x: number,
    y: number,
    width: number,
    height: number
  ): Array<TreemapNode & { x: number; y: number; width: number; height: number }> => {
    if (nodes.length === 0) return [];

    const totalSize = nodes.reduce((sum, node) => sum + node.size, 0);
    let currentX = x;
    const currentY = y;
    const layout: Array<TreemapNode & { x: number; y: number; width: number; height: number }> = [];

    // Simple squarified treemap algorithm
    const sortedNodes = [...nodes].sort((a, b) => b.size - a.size);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const nodeWidth = (node.size / totalSize) * width;
      const nodeHeight = height;

      layout.push({
        ...node,
        x: currentX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
      });

      currentX += nodeWidth;
    }

    return layout;
  };

  const layout = calculateTreemapLayout(data, 0, 0, dimensions.width, dimensions.height);

  const handleNodeClick = (
    node: TreemapNode & { x: number; y: number; width: number; height: number }
  ) => {
    setSelectedNode(node);
    onNodeClick?.(node);
  };

  const handleNodeHover = (
    node: TreemapNode & { x: number; y: number; width: number; height: number },
    event: React.MouseEvent
  ) => {
    setHoveredNode(node);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
    onNodeHover?.(node);
  };

  const handleNodeLeave = () => {
    setHoveredNode(null);
    onNodeHover?.(null);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getNodeColor = (node: TreemapNode): string => {
    if (node.color) return node.color;

    const colors = {
      directory: "rgba(59, 130, 246, 0.8)",
      file: "rgba(16, 185, 129, 0.8)",
      video: "rgba(239, 68, 68, 0.8)",
      image: "rgba(245, 158, 11, 0.8)",
      audio: "rgba(139, 92, 246, 0.8)",
      document: "rgba(236, 72, 153, 0.8)",
      other: "rgba(107, 114, 128, 0.8)",
    };

    const extension = node.name.split(".").pop()?.toLowerCase();
    if (node.type === "directory") return colors.directory;

    const videoExts = ["mp4", "avi", "mov", "wmv", "flv", "webm"];
    const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"];
    const audioExts = ["mp3", "wav", "flac", "aac", "ogg"];
    const documentExts = ["pdf", "doc", "docx", "txt", "md", "rtf"];

    if (extension && videoExts.includes(extension)) return colors.video;
    if (extension && imageExts.includes(extension)) return colors.image;
    if (extension && audioExts.includes(extension)) return colors.audio;
    if (extension && documentExts.includes(extension)) return colors.document;

    return colors.file;
  };

  return (
    <div ref={containerRef} className={styles.treemapContainer}>
      <svg width={dimensions.width} height={dimensions.height} className={styles.treemapSvg}>
        {layout.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              fill={getNodeColor(node)}
              stroke={hoveredNode?.id === node.id ? "#ffffff" : "rgba(255, 255, 255, 0.2)"}
              strokeWidth={hoveredNode?.id === node.id ? 2 : 1}
              className={`${styles.treemapNode} ${hoveredNode?.id === node.id ? styles.treemapNodeHovered : ""}`}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={(e) => handleNodeHover(node, e)}
              onMouseLeave={handleNodeLeave}
            />

            {/* Render label if node is large enough */}
            {node.width > 60 && node.height > 30 && (
              <text
                x={node.x + node.width / 2}
                y={node.y + node.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.treemapLabel}
                fill="#ffffff"
                fontSize={Math.min(14, node.width / 8)}
                pointerEvents="none"
              >
                {node.name.length > 15 ? node.name.substring(0, 15) + "..." : node.name}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className={styles.tooltip}
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
          }}
        >
          <div className={styles.tooltipHeader}>
            <span className={styles.tooltipName}>{hoveredNode.name}</span>
            <span className={styles.tooltipSize}>{formatBytes(hoveredNode.size)}</span>
          </div>
          {hoveredNode.type && <div className={styles.tooltipType}>Type: {hoveredNode.type}</div>}
          {hoveredNode.path && <div className={styles.tooltipPath}>{hoveredNode.path}</div>}
        </div>
      )}

      {/* Selection Details Panel */}
      {selectedNode && (
        <div className={styles.selectionPanel}>
          <div className={styles.selectionHeader}>
            <h3>{selectedNode.name}</h3>
            <button className={styles.closeButton} onClick={() => setSelectedNode(null)}>
              ×
            </button>
          </div>

          <div className={styles.selectionContent}>
            <div className={styles.selectionRow}>
              <span className={styles.selectionLabel}>Size:</span>
              <span className={styles.selectionValue}>{formatBytes(selectedNode.size)}</span>
            </div>

            {selectedNode.type && (
              <div className={styles.selectionRow}>
                <span className={styles.selectionLabel}>Type:</span>
                <span className={styles.selectionValue}>{selectedNode.type}</span>
              </div>
            )}

            {selectedNode.path && (
              <div className={styles.selectionRow}>
                <span className={styles.selectionLabel}>Path:</span>
                <span className={styles.selectionValue}>{selectedNode.path}</span>
              </div>
            )}

            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className={styles.selectionRow}>
                <span className={styles.selectionLabel}>Children:</span>
                <span className={styles.selectionValue}>{selectedNode.children.length}</span>
              </div>
            )}
          </div>

          <div className={styles.selectionActions}>
            <button className={styles.actionButton}>Explore</button>
            <button className={styles.actionButton}>Analyze</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveTreemap;
