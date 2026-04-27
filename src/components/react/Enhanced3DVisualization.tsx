// Enhanced 3D Visualization with Interactive Exploration
import React, { useState, useCallback, useMemo, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import "./Enhanced3DVisualization.css";

interface EnhancedNode3D {
  id: string;
  name: string;
  path: string;
  type: "file" | "function" | "class" | "module" | "component";
  size: number;
  color: string;
  metadata: {
    path: string;
    lines: number;
    complexity: number;
    issues: number;
    dependencies: number;
  };
}

interface EnhancedLink3D {
  source: string;
  target: string;
  type: "import" | "require" | "extends" | "call";
  strength: number;
  color: string;
}

export const Enhanced3DVisualization: React.FC<{
  data: { nodes: EnhancedNode3D[]; links: EnhancedLink3D[] };
  width?: number;
  height?: number;
  onNodeClick?: (node: EnhancedNode3D) => void;
}> = ({ data, width = 1200, height = 800, onNodeClick }) => {
  const [selectedNode, setSelectedNode] = useState<EnhancedNode3D | null>(null);
  const graphRef = useRef<any>(null);

  // Memoize graph data to prevent re-renders
  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        val: node.size,
        color: node.color,
        group: node.type,
      })),
      links: data.links.map((link) => ({
        source: link.source,
        target: link.target,
        value: link.strength,
        color: link.color,
      })),
    }),
    [data]
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      const nodeData = data.nodes.find((n) => n.id === node.id);
      if (nodeData) {
        setSelectedNode(nodeData);
        onNodeClick?.(nodeData);
      }
    },
    [data, onNodeClick]
  );

  const handleNodeHover = useCallback((node: any | null) => {
    if (node) {
      document.body.style.cursor = "pointer";
    } else {
      document.body.style.cursor = "default";
    }
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(0.7);
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit();
    }
  }, []);

  return (
    <div
      data-testid="3d-visualization"
      className="enhanced-3d-visualization"
      style={{ width, height }}
    >
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        nodeLabel="name"
        nodeAutoColorBy="group"
        nodeRelSize={8}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        enableNodeDrag={true}
        width={width}
        height={height}
        backgroundColor="#0a0a0a"
      />

      {/* Control Panel */}
      <div data-testid="viz-controls" className="control-panel">
        <h3>🎮 3D Controls</h3>
        <div className="stats">
          <div>📦 Nodes: {data.nodes.length}</div>
          <div>🔗 Links: {data.links.length}</div>
        </div>

        <div className="zoom-controls">
          <button data-testid="zoom-in" onClick={handleZoomIn} className="zoom-btn">
            ➕ Zoom In
          </button>
          <button data-testid="zoom-out" onClick={handleZoomOut} className="zoom-btn">
            ➖ Zoom Out
          </button>
          <button data-testid="reset-view" onClick={handleResetView} className="zoom-btn">
            🔄 Reset View
          </button>
        </div>

        {selectedNode && (
          <div className="selected-info">
            <h4>🎯 {selectedNode.name}</h4>
            <div>📁 Path: {selectedNode.path}</div>
            <div>📏 Lines: {selectedNode.metadata.lines}</div>
            <div>🧠 Complexity: {selectedNode.metadata.complexity}</div>
            <div>⚠️ Issues: {selectedNode.metadata.issues}</div>
            <div>🔗 Dependencies: {selectedNode.metadata.dependencies}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Enhanced3DVisualization;
