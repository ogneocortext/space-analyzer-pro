import React, { useEffect, useRef, useState, useCallback, type FC } from 'react';
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
  X
} from 'lucide-react';
import styles from './NeuralView.module.css';
import NeuralControls from './NeuralControls';
import NeuralMetrics from './NeuralMetrics';
import './neural-view.css';
import { convertDependencyGraphToNeuralData, type DependencyGraph } from '../utils/dependencyGraphConverter';

interface NeuralData {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    size: number;
    type: 'file' | 'directory' | 'pattern';
    connections: string[];
    fileType?: 'video' | 'document' | 'system' | 'other';
    fileSize?: number;
    accessFrequency?: number;
  }>;
  connections: Array<{
    from: string;
    to: string;
    strength: number;
    type: 'similarity' | 'dependency' | 'access';
    accessFrequency?: number;
  }>;
  metrics: {
    neuralDensity: number;
    connectionStrength: number;
    patternRecognition: number;
    anomalyScore: number;
  };
}

interface NeuralViewProps {
  data?: NeuralData;
  dependencyGraph?: DependencyGraph;
  isLoading?: boolean;
  error?: string | null;
}

const NeuralView: FC<NeuralViewProps> = ({ data, dependencyGraph, isLoading, error }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(true);
  const [neuralType, setNeuralType] = useState<'network' | 'heatmap' | 'graph'>('network');
  const [connectionLines, setConnectionLines] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [stats, setStats] = useState({
    fps: 0,
    nodes: 0,
    connections: 0,
    processingTime: 0
  });

  // Interaction state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Convert dependencyGraph to NeuralData if provided
  const convertedData = dependencyGraph ? convertDependencyGraphToNeuralData(dependencyGraph) : null;

  // Provide default data structure to prevent undefined errors
  const safeData = data || convertedData || {
    nodes: [],
    connections: [],
    metrics: {
      neuralDensity: 0,
      connectionStrength: 0,
      patternRecognition: 0,
      anomalyScore: 0
    }
  };

  // Neural network simulation state
  const [neurons, setNeurons] = useState<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
    pulse: number;
    size: number;
    id: string;
    connections: string[];
    type: string;
    pinned?: boolean;
  }>>([]);

  // Control handlers
  const handleToggleMode = useCallback((mode: 'network' | 'heatmap' | 'graph') => {
    setNeuralType(mode);
  }, []);

  const handleSimulationControl = useCallback((action: 'toggle' | 'reset') => {
    if (action === 'toggle') {
      setIsPlaying(prev => !prev);
    } else if (action === 'reset') {
      // Reset will trigger reinitialization
      initializeNeuralNetwork();
    }
  }, []);

  const handleToggleConnections = useCallback((enabled: boolean) => {
    setConnectionLines(enabled);
  }, []);

  const handleToggleLabels = useCallback((enabled: boolean) => {
    setShowLabels(enabled);
  }, []);

  const handleSearch = useCallback((query: string) => {
    // Filter nodes based on search query
    if (!neurons || !Array.isArray(neurons)) return;

    const filtered = neurons.map(neuron => ({
      ...neuron,
      opacity: query && !neuron.id.toLowerCase().includes(query.toLowerCase()) ? 0.2 : 1,
      highlighted: query && neuron.id.toLowerCase().includes(query.toLowerCase())
    }));

    setNeurons(filtered);
  }, [neurons]);

  const handleExport = useCallback((format: 'png' | 'svg' | 'json') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (format === 'png') {
      // Export as PNG
      const link = document.createElement('a');
      link.download = `neural-visualization-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else if (format === 'json') {
      // Export neural data as JSON
      const neuralData = {
        nodes: neurons,
        connections: safeData.connections,
        metrics: safeData.metrics,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(neuralData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = `neural-data-${Date.now()}.json`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  }, [neurons, safeData]);

  const handleSettings = useCallback(() => {
    setShowHelp(true);
  }, []);

  // Initialize neural network with smart positioning
  const initializeNeuralNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !data.nodes) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Group nodes by directory clusters for better initial positioning
    const clusters = new Map<string, typeof data.nodes>();
    const processed = new Set<string>();

    // Find directory hubs and cluster files around them
    data.nodes.forEach(node => {
      if (processed.has(node.id)) return;

      if (node.type === 'directory') {
        // Create cluster for this directory
        const cluster = [node];
        processed.add(node.id);

        // Find all files that should cluster around this directory
        const directoryPath = node.id;
        data.nodes.forEach(fileNode => {
          if (!processed.has(fileNode.id) && fileNode.type === 'file') {
            // Check if file is in this directory or subdirectory
            if (fileNode.id.startsWith(directoryPath + '/') ||
                fileNode.id.includes(directoryPath.split('/').pop() || '')) {
              cluster.push(fileNode);
              processed.add(fileNode.id);
            }
          }
        });

        clusters.set(node.id, cluster);
      }
    });

    // Handle any remaining unclustered nodes
    data.nodes.forEach(node => {
      if (!processed.has(node.id)) {
        clusters.set(node.id, [node]);
        processed.add(node.id);
      }
    });

    // Position clusters around the center
    const clusterCenters: Array<{x: number, y: number}> = [];
    const numClusters = clusters.size;
    const radius = Math.min(width, height) * 0.25;

    for (let i = 0; i < numClusters; i++) {
      const angle = (i / numClusters) * Math.PI * 2;
      clusterCenters.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    }

    // Create neurons with smart positioning
    const newNeurons: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      active: boolean;
      pulse: number;
      size: number;
      id: string;
      connections: string[];
      type: string;
    }> = [];

    let clusterIndex = 0;
    clusters.forEach((clusterNodes, clusterId) => {
      const center = clusterCenters[clusterIndex % clusterCenters.length];
      clusterIndex++;

      clusterNodes.forEach((node, nodeIndex) => {
        // Position nodes within their cluster
        const clusterRadius = Math.min(50, clusterNodes.length * 5);
        const nodeAngle = (nodeIndex / clusterNodes.length) * Math.PI * 2;
        const distanceFromCenter = clusterRadius * (0.3 + Math.random() * 0.7);

        const x = center.x + Math.cos(nodeAngle) * distanceFromCenter;
        const y = center.y + Math.sin(nodeAngle) * distanceFromCenter;

        newNeurons.push({
          x: Math.max(node.size, Math.min(width - node.size, x)),
          y: Math.max(node.size, Math.min(height - node.size, y)),
          vx: (Math.random() - 0.5) * 2, // Initial velocity for physics
          vy: (Math.random() - 0.5) * 2,
          active: node.type === 'directory',
          pulse: node.type === 'directory' ? 0.5 : 0,
          size: node.size,
          id: node.id,
          connections: node.connections,
          type: node.type,
          // @ts-ignore - pinned property
          pinned: false
        });
      });
    });

    // Fallback for empty data
    if (newNeurons.length === 0) {
      for (let i = 0; i < 20; i++) {
        newNeurons.push({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          active: Math.random() > 0.8,
          pulse: 0,
          size: 5,
          id: `random-${i}`,
          connections: [],
          type: 'unknown',
          // @ts-ignore - pinned property
          pinned: false
        });
      }
    }

    console.log(`Initialized ${newNeurons.length} neurons in ${clusters.size} clusters`);
    setNeurons(newNeurons);
  }, [data]);

  // Neural rendering loop
  const renderNeuralNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Set canvas size to match display size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, width, height);

    if (neuralType === 'heatmap') {
      renderHeatmap(ctx, width, height);
    } else if (neuralType === 'graph') {
      renderGraph(ctx, width, height);
    } else {
      // Default network view
      renderNetwork(ctx, width, height);
    }

    // Draw labels if enabled
    if (showLabels && neurons && Array.isArray(neurons)) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      neurons.forEach(neuron => {
        if (neuron.type === 'directory') {
          ctx.fillText(neuron.id.split('/').pop() || 'dir', neuron.x, neuron.y - neuron.size - 5);
        }
      });
    }
  }, [data, neuralType, showLabels, hoveredNode, selectedNode, mousePos]);

  const renderNetwork = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw neural background with gradient
    const bgGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    bgGradient.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw grid effect (cyberpunk style)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)'; // Subtle sky blue
    ctx.lineWidth = 1;
    const gridSize = 50;
    const offsetX = (Date.now() / 50) % gridSize;
    const offsetY = (Date.now() / 50) % gridSize;
    
    for(let x = offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for(let y = offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw connections if enabled
    if (connectionLines && neurons && Array.isArray(neurons)) {
      neurons.forEach((neuron, i) => {
        neuron.connections.forEach(connId => {
          const other = neurons.find(n => n.id === connId);
          if (other) {
            const distance = Math.sqrt(
              Math.pow(neuron.x - other.x, 2) + Math.pow(neuron.y - other.y, 2)
            );

            if (distance < 200) {
              // Pulse based on access frequency
              const connection = safeData.connections.find(c =>
                (c.from === neuron.id && c.to === other.id) ||
                (c.from === other.id && c.to === neuron.id)
              );
              const accessFreq = connection?.accessFrequency || 0;
              const pulseIntensity = Math.min(accessFreq * 0.1, 0.8) + (neuron.pulse * 0.2);

              // Gradient connection
              const gradient = ctx.createLinearGradient(neuron.x, neuron.y, other.x, other.y);
              gradient.addColorStop(0, `rgba(59, 130, 246, ${0.1 + pulseIntensity})`);
              gradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.1 + pulseIntensity})`);
              gradient.addColorStop(1, `rgba(59, 130, 246, ${0.1 + pulseIntensity})`);

              ctx.strokeStyle = gradient;
              ctx.lineWidth = 1 + (pulseIntensity * 3);
              ctx.globalCompositeOperation = 'lighter'; // Additive blending for glow
              ctx.beginPath();
              ctx.moveTo(neuron.x, neuron.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
              ctx.globalCompositeOperation = 'source-over';
            }
          }
        });
      });
    }

    // Draw neurons
    if (neurons && Array.isArray(neurons)) {
      neurons.forEach(neuron => {
        // Get file type color - using neon theme colors
        let nodeColor = '#60a5fa'; // Blue-400
        if (neuron.type === 'file') {
          // @ts-ignore - fileType property
          const fileType = neuron.fileType || 'other';
          switch (fileType) {
            case 'video': nodeColor = '#f87171'; break; // Red-400
            case 'document': nodeColor = '#60a5fa'; break; // Blue-400
            case 'system': nodeColor = '#34d399'; break; // Emerald-400
            default: nodeColor = '#a78bfa'; break; // Violet-400
          }
        } else if (neuron.type === 'directory') {
          nodeColor = '#fbbf24'; // Amber-400
        }

        // Size based on file size (with minimum size)
        // @ts-ignore - fileSize property
        const baseSize = neuron.type === 'file' && neuron.fileSize
          // @ts-ignore - fileSize property
          ? Math.max(3, Math.min(25, neuron.fileSize / 1000000))
          : neuron.size;

        // Visual feedback for interaction states
        let glowColor = nodeColor;
        let glowIntensity = 0.2; // Base glow
        let scaleMultiplier = 1;

        if (neuron.id === selectedNode) {
          glowIntensity = 0.9;
          scaleMultiplier = 1.3;
          glowColor = '#ffffff';
        } else if (neuron.id === hoveredNode) {
          glowIntensity = 0.7;
          scaleMultiplier = 1.2;
        } else if (neuron.active) {
            glowIntensity = 0.5 + (Math.sin(Date.now() / 200) * 0.2); // Pulse active nodes
        }

        const displaySize = baseSize * scaleMultiplier;

        // Draw intense outer glow
        if (glowIntensity > 0) {
          const glowGradient = ctx.createRadialGradient(
            neuron.x, neuron.y, 0,
            neuron.x, neuron.y, displaySize * 4
          );
          glowGradient.addColorStop(0, `${glowColor}${Math.floor(glowIntensity * 200).toString(16).padStart(2, '0')}`);
          glowGradient.addColorStop(0.5, `${glowColor}${Math.floor(glowIntensity * 50).toString(16).padStart(2, '0')}`);
          glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(neuron.x, neuron.y, displaySize * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }

        // Inner Gradient
        const gradient = ctx.createRadialGradient(
          neuron.x, neuron.y, 0,
          neuron.x, neuron.y, displaySize
        );

        gradient.addColorStop(0, '#ffffff'); // White center
        gradient.addColorStop(0.4, nodeColor);
        gradient.addColorStop(1, `rgba(0,0,0,0.1)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, displaySize, 0, Math.PI * 2);
        ctx.fill();

        // Rings for directories
        if (neuron.type === 'directory') {
           ctx.strokeStyle = `rgba(251, 191, 36, ${0.3 + (Math.sin(Date.now() / 500) * 0.1)})`;
           ctx.lineWidth = 1.5;
           ctx.beginPath();
           ctx.arc(neuron.x, neuron.y, displaySize + 3, 0, Math.PI * 2);
           ctx.stroke();
        }

        // Draw pin indicator for manually positioned nodes
        if (neuron.pinned) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(neuron.x + displaySize * 0.8, neuron.y - displaySize * 0.8, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw pulse effect ripples
    if (neurons && Array.isArray(neurons)) {
      neurons.forEach(neuron => {
        if (neuron.pulse > 0) {
          ctx.strokeStyle = `rgba(59, 130, 246, ${neuron.pulse * 0.4})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(neuron.x, neuron.y, neuron.size * 3 * (1 - neuron.pulse) + 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    // Draw hover tooltip
    if (hoveredNode && mousePos) {
      const hoveredNeuron = neurons.find(n => n.id === hoveredNode);
      if (hoveredNeuron) {
        const tooltipX = mousePos.x + 20;
        const tooltipY = mousePos.y - 20;
        const tooltipWidth = 220;
        const tooltipHeight = 100;

        // Glassmorphism Tooltip
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Slate-900 transparent
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'; // Slate-400 transparent
        
        // Rounded rect
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(tooltipX + radius, tooltipY);
        ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
        ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + radius);
        ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
        ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight, tooltipX + tooltipWidth - radius, tooltipY + tooltipHeight);
        ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
        ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - radius);
        ctx.lineTo(tooltipX, tooltipY + radius);
        ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Tooltip text
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 13px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const fileName = hoveredNeuron.id.split('/').pop() || hoveredNeuron.id;
        // @ts-ignore - fileSize property
        const fileSize = hoveredNeuron.type === 'file' && hoveredNeuron.fileSize
          // @ts-ignore - fileSize property
          ? `${(hoveredNeuron.fileSize / 1024 / 1024).toFixed(2)} MB`
          : hoveredNeuron.type === 'directory' ? 'Directory' : 'File';

        // Header with truncation
        const maxWidth = tooltipWidth - 20;
        let displayTitle = fileName;
        if (ctx.measureText(displayTitle).width > maxWidth) {
            while (ctx.measureText(displayTitle + '...').width > maxWidth && displayTitle.length > 0) {
                displayTitle = displayTitle.slice(0, -1);
            }
            displayTitle += '...';
        }
        
        ctx.fillText(displayTitle, tooltipX + 10, tooltipY + 12);
        
        ctx.font = '11px "Inter", sans-serif';
        ctx.fillStyle = '#94a3b8'; // Slate-400
        
        // Stats
        ctx.fillText(`Type:`, tooltipX + 10, tooltipY + 35);
        ctx.fillText(hoveredNeuron.type.toUpperCase(), tooltipX + 50, tooltipY + 35);
        
        ctx.fillText(`Size:`, tooltipX + 10, tooltipY + 52);
        ctx.fillText(fileSize, tooltipX + 50, tooltipY + 52);
        
        ctx.fillText(`Links:`, tooltipX + 10, tooltipY + 69);
        ctx.fillText(`${hoveredNeuron.connections.length}`, tooltipX + 50, tooltipY + 69);
        
        // Status indicator
        const statusColor = hoveredNeuron.active ? '#4ade80' : '#64748b';
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(tooltipX + tooltipWidth - 15, tooltipY + 15, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const renderHeatmap = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Create heatmap based on neuron density and activity
    const gridSize = 50;
    const opacityMap = new Map<string, number>();

    if (neurons && Array.isArray(neurons)) {
      neurons.forEach(neuron => {
        const gridX = Math.floor(neuron.x / gridSize);
        const gridY = Math.floor(neuron.y / gridSize);
        const key = `${gridX},${gridY}`;
        const current = opacityMap.get(key) || 0;
        const activity = neuron.active ? 1 : neuron.pulse;
        opacityMap.set(key, Math.min(current + activity, 1));
      });
    }

    // Draw heatmap grid
    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        const key = `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
        const opacity = opacityMap.get(key) || 0;

        if (opacity > 0) {
          ctx.fillStyle = `rgba(239, 68, 68, ${opacity * 0.6})`;
          ctx.fillRect(x, y, gridSize, gridSize);

          // Add glow effect
          ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
          ctx.shadowBlur = opacity * 20;
          ctx.fillRect(x, y, gridSize, gridSize);
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw neurons on top
    if (neurons && Array.isArray(neurons)) {
      neurons.forEach(neuron => {
        ctx.fillStyle = neuron.active ? '#ef4444' : '#fca5a5';
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, neuron.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

  const renderGraph = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear background
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, width, height);

    // Draw nodes as squares for graph view
    if (neurons && Array.isArray(neurons)) {
      neurons.forEach(neuron => {
        const size = neuron.size * 2;
        ctx.fillStyle = neuron.type === 'directory' ? '#3b82f6' : '#8b5cf6';
        ctx.fillRect(neuron.x - size/2, neuron.y - size/2, size, size);

        // Draw borders
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(neuron.x - size/2, neuron.y - size/2, size, size);

        // Add activity indicator
        if (neuron.active) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(neuron.x - size/2 - 2, neuron.y - size/2 - 2, 4, 4);
        }
      });
    }

    // Draw connections as arrows
    if (neurons && Array.isArray(neurons)) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      neurons.forEach(neuron => {
        neuron.connections.forEach(connId => {
          const target = neurons.find(n => n.id === connId);
          if (target) {
            // Draw line
            ctx.beginPath();
            ctx.moveTo(neuron.x, neuron.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            // Draw arrow head
            const angle = Math.atan2(target.y - neuron.y, target.x - neuron.x);
            const arrowSize = 8;
            ctx.beginPath();
            ctx.moveTo(target.x, target.y);
            ctx.lineTo(
              target.x - arrowSize * Math.cos(angle - Math.PI/6),
              target.y - arrowSize * Math.sin(angle - Math.PI/6)
            );
            ctx.lineTo(
              target.x - arrowSize * Math.cos(angle + Math.PI/6),
              target.y - arrowSize * Math.sin(angle + Math.PI/6)
            );
            ctx.closePath();
            ctx.fillStyle = '#64748b';
            ctx.fill();
          }
        });
      });
    }
  };


  // Force-directed graph physics
  const applyForces = useCallback((neurons: any, canvas: HTMLCanvasElement) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // Physics constants - optimized for performance and stability
    const REPULSION_STRENGTH = 2000;
    const ATTRACTION_STRENGTH = 0.001;
    const DAMPING = 0.92;
    const MAX_FORCE = 3;
    const MIN_DISTANCE = 20;
    const MAX_DISTANCE = 120;

    return neurons.map((neuron, i) => {
      // Skip physics for pinned nodes
      if (neuron.pinned) {
        return {
          ...neuron,
          vx: 0,
          vy: 0,
          active: Math.random() > 0.95,
          pulse: neuron.pulse > 0 ? neuron.pulse - 0.01 : (Math.random() > 0.99 ? 0.8 : 0)
        };
      }

      let forceX = 0;
      let forceY = 0;

      // Calculate repulsion from all other nodes
      neurons.forEach((other, j) => {
        if (i === j) return;

        const dx = neuron.x - other.x;
        const dy = neuron.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Repulsion force (Coulomb's law)
          const repulsion = REPULSION_STRENGTH / (distance * distance);
          forceX += (dx / distance) * repulsion;
          forceY += (dy / distance) * repulsion;
        }
      });

      // Calculate attraction to connected nodes and directory hubs
      neuron.connections.forEach(connId => {
        const target = neurons.find(n => n.id === connId);
        if (target) {
          const dx = target.x - neuron.x;
          const dy = target.y - neuron.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > MIN_DISTANCE) {
            // Stronger attraction to directories (hubs)
            const attractionMultiplier = target.type === 'directory' ? 3.0 : 1.0;
            const attraction = ATTRACTION_STRENGTH * distance * attractionMultiplier;
            forceX += (dx / distance) * attraction;
            forceY += (dy / distance) * attraction;
          }
        }
      });

      // Additional attraction to directory hubs for files
      if (neuron.type === 'file') {
        neurons.forEach(other => {
          if (other.type === 'directory') {
            const dx = other.x - neuron.x;
            const dy = other.y - neuron.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Weak but persistent attraction to directory hubs
            if (distance > MIN_DISTANCE && distance < MAX_DISTANCE * 2) {
              const hubAttraction = ATTRACTION_STRENGTH * distance * 0.5;
              forceX += (dx / distance) * hubAttraction;
              forceY += (dy / distance) * hubAttraction;
            }
          }
        });
      }

      // Center attraction (weak)
      const centerDx = centerX - neuron.x;
      const centerDy = centerY - neuron.y;
      const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
      const centerAttraction = 0.0001 * centerDist;
      forceX += (centerDx / centerDist) * centerAttraction;
      forceY += (centerDy / centerDist) * centerAttraction;

      // Limit maximum force
      const forceMagnitude = Math.sqrt(forceX * forceX + forceY * forceY);
      if (forceMagnitude > MAX_FORCE) {
        forceX = (forceX / forceMagnitude) * MAX_FORCE;
        forceY = (forceY / forceMagnitude) * MAX_FORCE;
      }

      // Update velocity with damping
      const newVx = (neuron.vx + forceX) * DAMPING;
      const newVy = (neuron.vy + forceY) * DAMPING;

      // Update position
      let newX = neuron.x + newVx;
      let newY = neuron.y + newVy;

      // Keep nodes within bounds with bounce
      const margin = neuron.size * 2;
      if (newX < margin) {
        newX = margin;
        forceX = -forceX * 0.5;
      } else if (newX > width - margin) {
        newX = width - margin;
        forceX = -forceX * 0.5;
      }

      if (newY < margin) {
        newY = margin;
        forceY = -forceY * 0.5;
      } else if (newY > height - margin) {
        newY = height - margin;
        forceY = -forceY * 0.5;
      }

      return {
        ...neuron,
        x: newX,
        y: newY,
        vx: newVx,
        vy: newVy,
        active: Math.random() > 0.95, // Less frequent activation
        pulse: neuron.pulse > 0 ? neuron.pulse - 0.01 : (Math.random() > 0.99 ? 0.8 : 0)
      };
    });
  }, []);

  // Animation loop with physics
  const animate = useCallback(() => {
    if (!isPlaying) return;

    const start = performance.now();
    const canvas = canvasRef.current;

    if (canvas && neurons.length > 0) {
      // Apply physics forces
      const updatedNeurons = applyForces(neurons, canvas);
      setNeurons(updatedNeurons);
    }

    renderNeuralNetwork();

    const end = performance.now();
    const processingTime = end - start;

    // Update stats
    setStats(prev => ({
      ...prev,
      processingTime,
      nodes: neurons.length,
      connections: safeData.connections.length
    }));

    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying, neurons, applyForces, renderNeuralNetwork, safeData.connections.length]);

  // Start/stop animation
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animate]);

  // Initialize neural network
  useEffect(() => {
    initializeNeuralNetwork();
  }, [initializeNeuralNetwork]);

  // Mouse interaction handlers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getNodeAtPosition = (x: number, y: number) => {
    if (!neurons || !Array.isArray(neurons)) return null;

    for (const neuron of neurons) {
      const distance = Math.sqrt(Math.pow(x - neuron.x, 2) + Math.pow(y - neuron.y, 2));
      // @ts-ignore - fileSize property
      const scaledSize = neuron.type === 'file' && neuron.fileSize
        // @ts-ignore - fileSize property
        ? Math.max(3, Math.min(20, neuron.fileSize / 1000000))
        : neuron.size;
      if (distance <= scaledSize * 1.5) {
        return neuron;
      }
    }
    return null;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setMousePos(pos);

    if (draggedNode) {
      // Update dragged node position
      setNeurons(prev => prev.map(neuron =>
        neuron.id === draggedNode
          ? { ...neuron, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y, pinned: true }
          : neuron
      ));
    } else {
      // Check for hover
      const node = getNodeAtPosition(pos.x, pos.y);
      setHoveredNode(node?.id || null);
    }
  }, [draggedNode, dragOffset]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const node = getNodeAtPosition(pos.x, pos.y);

    if (node) {
      setDraggedNode(node.id);
      setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
      setSelectedNode(node.id);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
  }, []);

  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = {
          width: Math.max(400, rect.width - 32), // Account for padding
          height: Math.max(300, rect.height - 120) // Account for header and stats
        };
        setDimensions(newDimensions);

        // Update canvas size
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = newDimensions.width;
          canvas.height = newDimensions.height;
        }
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateDimensions(); // Initial measurement
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Add mouse event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // @ts-ignore - event type mismatch
      canvas.addEventListener('mousemove', handleMouseMove);
      // @ts-ignore - event type mismatch
      canvas.addEventListener('mousedown', handleMouseDown);
      // @ts-ignore - event type mismatch
      canvas.addEventListener('mouseup', handleMouseUp);
      // @ts-ignore - event type mismatch
      canvas.addEventListener('mouseleave', handleMouseUp);

      return () => {
        // @ts-ignore - event type mismatch
        canvas.removeEventListener('mousemove', handleMouseMove);
        // @ts-ignore - event type mismatch
        canvas.removeEventListener('mousedown', handleMouseDown);
        // @ts-ignore - event type mismatch
        canvas.removeEventListener('mouseup', handleMouseUp);
        // @ts-ignore - event type mismatch
        canvas.removeEventListener('mouseleave', handleMouseUp);
      };
    }
  }, [handleMouseMove, handleMouseDown, handleMouseUp]);



  return (
    <div className={styles.neuralViewContainer} style={{ position: 'relative' }}>
      <div className={styles.neuralViewHeader}>
        <h2 className={styles.neuralViewTitle}>
          <Brain size={24} style={{ marginRight: '0.5rem' }} />
          Neural Analysis View
        </h2>
      </div>

      <>
        {/* New NeuralControls Component */}
        <NeuralControls
          onToggleMode={handleToggleMode}
          onSimulationControl={handleSimulationControl}
          onToggleConnections={handleToggleConnections}
          onToggleLabels={handleToggleLabels}
          onSearch={handleSearch}
          onExport={handleExport}
          onSettings={handleSettings}
          activeMode={neuralType}
          simulationState={isPlaying ? 'running' : 'paused'}
          connectionsEnabled={connectionLines}
          labelsEnabled={showLabels}
          searchQuery=""
        />

        <div
          className={styles.neuralCanvas}
          data-neural-type={neuralType}
          data-neural-active={isPlaying.toString()}
        >
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          style={{ width: '100%', height: '100%' }}
        />
        
        {isLoading && (
          <div className={styles.neuralLoading}>
            <Zap size={24} style={{ marginRight: '0.5rem' }} />
            Analyzing neural patterns...
          </div>
        )}

        {error && (
          <div className={styles.neuralError}>
            Neural analysis error: {error}
          </div>
        )}

        {!isLoading && !error && safeData.nodes.length === 0 && (
          <div className={styles.neuralEmpty}>
            <div className={styles.neuralEmptyIcon}>
              <Brain size={48} />
            </div>
            <div>No neural data available for visualization</div>
          </div>
        )}
      </div>
      </>

      {/* New NeuralMetrics Component */}
      <NeuralMetrics
        density={safeData.metrics?.neuralDensity || 0}
        connectionStrength={safeData.metrics?.connectionStrength || 0}
        patternRecognition={safeData.metrics?.patternRecognition || 0}
        anomalyScore={safeData.metrics?.anomalyScore || 0}
        processingTime={stats.processingTime}
        activeNodes={stats.nodes}
      />

      {/* Help Overlay */}
      {showHelp && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative">
                <button
                    onClick={() => setShowHelp(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                    aria-label="Close help dialog"
                    title="Close help"
                >
                    <X size={24} />
                </button>
                
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
                    <Brain className="text-blue-500" />
                    How Neural View Works
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-300">
                    <div>
                        <h4 className="font-semibold text-white mb-2">Visualization Elements</h4>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500 block"></span>
                                <span><strong>Blue Nodes:</strong> Directories & Folder Clusters</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-purple-500 block"></span>
                                <span><strong>Purple Nodes:</strong> Individual Files (Scale = Size)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-8 h-px bg-blue-400/50 block"></span>
                                <span><strong>Lines:</strong> File Dependencies & Relationships</span>
                            </li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold text-white mb-2">Interactions</h4>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                                <Play size={16} />
                                <span><strong>Play/Pause:</strong> Control the neural simulation</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <RefreshCw size={16} />
                                <span><strong>Reset:</strong> Regenerate node positions</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Activity size={16} />
                                <span><strong>Modes:</strong> Switch between Network, Heatmap, etc.</span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-700">
                    <p className="text-sm text-slate-400">
                        The Neural View uses a physics-based force-directed graph to visualize your file system. 
                        Files that are semantically related or in the same directory will cluster together. 
                        Large files appear as larger nodes with stronger gravitational pull.
                    </p>
                </div>
            </div>
        </div>
      )}


    </div>
  );
};

export default NeuralView;