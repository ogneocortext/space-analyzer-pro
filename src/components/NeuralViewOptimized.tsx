/* Optimized Neural View Component for Space Analyzer */

import React, { useEffect, useRef, useState, useCallback, useMemo, FC } from 'react';
import { usePerformanceOptimization } from '../hooks/usePerformanceOptimization';
import { useAccessibility } from '../hooks/useAccessibility';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { NeuralData, NeuralNode, NeuralConnection, PerformanceMetrics } from '../types/frontend';
import { Brain, Play, Pause, RefreshCw, Settings, Network, Activity, Zap, HelpCircle, X } from 'lucide-react';
import './NeuralView.module.css';
import './neural-view.css';

interface NeuralViewOptimizedProps {
  data: NeuralData;
  isLoading?: boolean;
  error?: string | null;
  onNodeSelect?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

const NeuralViewOptimized: FC<NeuralViewOptimizedProps> = ({ 
  data, 
  isLoading, 
  error, 
  onNodeSelect, 
  onNodeHover 
}) => {
  // Performance optimization
  const performance = usePerformanceOptimization({
    maxNodes: 1000,
    maxConnections: 5000,
    frameRateLimit: 60,
    enableVirtualization: true,
    enableCanvasOptimization: true,
    enableMemoization: true
  });

  // Accessibility features
  const { state: accessibilityState, actions: accessibilityActions } = useAccessibility();

  // Responsive design
  const { screenSize, getCanvasSize } = useResponsiveDesign();

  // Component state
  const [isPlaying, setIsPlaying] = useState(true);
  const [neuralType, setNeuralType] = useState<'network' | 'heatmap' | 'graph'>('network');
  const [connectionLines, setConnectionLines] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const dimensions = useRef({ width: 800, height: 500 });

  // Optimized neural data
  const optimizedData = useMemo(() => {
    if (!data) return null;
    // @ts-ignore - optimizeData method
    return performance.optimizeData(data) as NeuralData;
  }, [data, performance]);

  // Neural network state with memoization
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

  // Initialize neural network with performance optimizations
  const initializeNeuralNetwork = useCallback(() => {
    if (!optimizedData?.nodes) {
      setNeurons([]);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    dimensions.current = { width, height };

    const centerX = width / 2;
    const centerY = height / 2;

    // Group nodes by category for better clustering
    const clusters = new Map<string, NeuralNode[]>();
    const processed = new Set<string>();

    // Create clusters based on node type and category
    optimizedData.nodes.forEach(node => {
      if (processed.has(node.id)) return;

      const clusterKey = node.type === 'directory' ? node.id : node.category || 'other';
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      
      clusters.get(clusterKey)!.push(node);
      processed.add(node.id);
    });

    // Position clusters around center
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
      pinned?: boolean;
    }> = [];

    let clusterIndex = 0;
    clusters.forEach((clusterNodes, clusterId) => {
      const center = clusterCenters[clusterIndex % clusterCenters.length];
      clusterIndex++;

      clusterNodes.forEach((node, nodeIndex) => {
        const clusterRadius = Math.min(50, clusterNodes.length * 5);
        const nodeAngle = (nodeIndex / clusterNodes.length) * Math.PI * 2;
        const distanceFromCenter = clusterRadius * (0.3 + Math.random() * 0.7);

        const x = center.x + Math.cos(nodeAngle) * distanceFromCenter;
        const y = center.y + Math.sin(nodeAngle) * distanceFromCenter;

        newNeurons.push({
          x: Math.max(node.size, Math.min(width - node.size, x)),
          y: Math.max(node.size, Math.min(height - node.size, y)),
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          active: node.type === 'directory',
          pulse: node.type === 'directory' ? 0.5 : 0,
          size: node.size,
          id: node.id,
          connections: node.connections,
          type: node.type,
          pinned: false
        });
      });
    });

    setNeurons(newNeurons);
  }, [optimizedData, performance]);

  // Optimized rendering function
  const renderNeuralNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || neurons.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Optimize canvas size
    // @ts-ignore - optimizeCanvas method
    performance.optimizeCanvas(canvas, ctx);

    // Clear canvas efficiently
    ctx.clearRect(0, 0, width, height);

    // Draw background
    const bgGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    bgGradient.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw grid effect
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
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
    if (connectionLines && neurons.length > 0) {
      neurons.forEach((neuron, i) => {
        neuron.connections.forEach(connId => {
          const other = neurons.find(n => n.id === connId);
          if (other) {
            const distance = Math.sqrt(
              Math.pow(neuron.x - other.x, 2) + Math.pow(neuron.y - other.y, 2)
            );

            if (distance < 200) {
              const connection = optimizedData?.connections.find(c =>
                (c.from === neuron.id && c.to === other.id) ||
                (c.from === other.id && c.to === neuron.id)
              );
              const accessFreq = connection?.accessFrequency || 0;
              const pulseIntensity = Math.min(accessFreq * 0.1, 0.8) + (neuron.pulse * 0.2);

              const gradient = ctx.createLinearGradient(neuron.x, neuron.y, other.x, other.y);
              gradient.addColorStop(0, `rgba(59, 130, 246, ${0.1 + pulseIntensity})`);
              gradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.1 + pulseIntensity})`);
              gradient.addColorStop(1, `rgba(59, 130, 246, ${0.1 + pulseIntensity})`);

              ctx.strokeStyle = gradient;
              ctx.lineWidth = 1 + (pulseIntensity * 3);
              ctx.globalCompositeOperation = 'lighter';
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

    // Draw neurons with performance optimizations
    neurons.forEach(neuron => {
      let nodeColor = '#60a5fa';
      if (neuron.type === 'file') {
        // @ts-ignore - fileType property
        const fileType = neuron.fileType || 'other';
        switch (fileType) {
          case 'video': nodeColor = '#f87171'; break;
          case 'document': nodeColor = '#60a5fa'; break;
          case 'system': nodeColor = '#34d399'; break;
          default: nodeColor = '#a78bfa'; break;
        }
      } else if (neuron.type === 'directory') {
        nodeColor = '#fbbf24';
      }

      // @ts-ignore - fileSize property
      const baseSize = neuron.type === 'file' && neuron.fileSize
        // @ts-ignore - fileSize property
        ? Math.max(3, Math.min(25, neuron.fileSize / 1000000))
        : neuron.size;

      let glowColor = nodeColor;
      let glowIntensity = 0.2;
      let scaleMultiplier = 1;

      if (neuron.id === selectedNode) {
        glowIntensity = 0.9;
        scaleMultiplier = 1.3;
        glowColor = '#ffffff';
      } else if (neuron.id === hoveredNode) {
        glowIntensity = 0.7;
        scaleMultiplier = 1.2;
      } else if (neuron.active) {
        glowIntensity = 0.5 + (Math.sin(Date.now() / 200) * 0.2);
      }

      const displaySize = baseSize * scaleMultiplier;

      // Draw glow
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

      // Draw node
      const gradient = ctx.createRadialGradient(
        neuron.x, neuron.y, 0,
        neuron.x, neuron.y, displaySize
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.4, nodeColor);
      gradient.addColorStop(1, `rgba(0,0,0,0.1)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, displaySize, 0, Math.PI * 2);
      ctx.fill();

      // Draw rings for directories
      if (neuron.type === 'directory') {
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.3 + (Math.sin(Date.now() / 500) * 0.1)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, displaySize + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw pulse effects
    neurons.forEach(neuron => {
      if (neuron.pulse > 0) {
        ctx.strokeStyle = `rgba(59, 130, 246, ${neuron.pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, neuron.size * 3 * (1 - neuron.pulse) + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw tooltip
    if (hoveredNode && mousePos && screenSize.isDesktop) {
      const hoveredNeuron = neurons.find(n => n.id === hoveredNode);
      if (hoveredNeuron) {
        const tooltipX = mousePos.x + 20;
        const tooltipY = mousePos.y - 20;
        const tooltipWidth = 220;
        const tooltipHeight = 100;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        
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

        ctx.fillText(fileName, tooltipX + 10, tooltipY + 12);
        
        ctx.font = '11px "Inter", sans-serif';
        ctx.fillStyle = '#94a3b8';
        
        ctx.fillText(`Type:`, tooltipX + 10, tooltipY + 35);
        ctx.fillText(hoveredNeuron.type.toUpperCase(), tooltipX + 50, tooltipY + 35);
        
        ctx.fillText(`Size:`, tooltipX + 10, tooltipY + 52);
        ctx.fillText(fileSize, tooltipX + 50, tooltipY + 52);
        
        ctx.fillText(`Links:`, tooltipX + 10, tooltipY + 69);
        ctx.fillText(`${hoveredNeuron.connections.length}`, tooltipX + 50, tooltipY + 69);

        const statusColor = hoveredNeuron.active ? '#4ade80' : '#64748b';
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(tooltipX + tooltipWidth - 15, tooltipY + 15, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [neurons, connectionLines, hoveredNode, mousePos, screenSize.isDesktop, optimizedData?.connections]);

  // Optimized physics simulation
  const applyForces = useCallback((neurons: any, canvas: HTMLCanvasElement) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const REPULSION_STRENGTH = 2000;
    const ATTRACTION_STRENGTH = 0.001;
    const DAMPING = 0.92;
    const MAX_FORCE = 3;
    const MIN_DISTANCE = 20;
    const MAX_DISTANCE = 120;

    return neurons.map((neuron, i) => {
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
          const repulsion = REPULSION_STRENGTH / (distance * distance);
          forceX += (dx / distance) * repulsion;
          forceY += (dy / distance) * repulsion;
        }
      });

      // Calculate attraction to connected nodes
      neuron.connections.forEach(connId => {
        const target = neurons.find(n => n.id === connId);
        if (target) {
          const dx = target.x - neuron.x;
          const dy = target.y - neuron.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > MIN_DISTANCE) {
            const attractionMultiplier = target.type === 'directory' ? 3.0 : 1.0;
            const attraction = ATTRACTION_STRENGTH * distance * attractionMultiplier;
            forceX += (dx / distance) * attraction;
            forceY += (dy / distance) * attraction;
          }
        }
      });

      // Center attraction
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

      const newVx = (neuron.vx + forceX) * DAMPING;
      const newVy = (neuron.vy + forceY) * DAMPING;

      let newX = neuron.x + newVx;
      let newY = neuron.y + newVy;

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
        active: Math.random() > 0.95,
        pulse: neuron.pulse > 0 ? neuron.pulse - 0.01 : (Math.random() > 0.99 ? 0.8 : 0)
      };
    });
  }, []);

  // Animation loop with performance monitoring
  const animate = useCallback(() => {
    if (!isPlaying || neurons.length === 0) return;

    // @ts-ignore - performance.now
    const start = performance.now();
    const canvas = canvasRef.current;

    if (canvas) {
      const updatedNeurons = applyForces(neurons, canvas);
      setNeurons(updatedNeurons);
    }

    renderNeuralNetwork();

    // @ts-ignore - performance.now
    const end = performance.now();
    const processingTime = end - start;

    // @ts-ignore - performance.state
    performance.state.metrics.processingTime = processingTime;
    // @ts-ignore - performance.state
    performance.state.metrics.nodes = neurons.length;
    // @ts-ignore - performance.state
    performance.state.metrics.connections = optimizedData?.connections.length || 0;

    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying, neurons, applyForces, renderNeuralNetwork, performance, optimizedData?.connections.length]);

  // Start/stop animation
  useEffect(() => {
    if (isPlaying && neurons.length > 0) {
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
  }, [isPlaying, animate, neurons.length]);

  // Initialize neural network
  useEffect(() => {
    initializeNeuralNetwork();
  }, [initializeNeuralNetwork]);

  // Mouse interaction handlers with accessibility support
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  const getNodeAtPosition = useCallback((x: number, y: number) => {
    if (!neurons || neurons.length === 0) return null;

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
  }, [neurons]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setMousePos(pos);

    if (draggedNode) {
      setNeurons(prev => prev.map(neuron =>
        neuron.id === draggedNode
          ? { ...neuron, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y, pinned: true }
          : neuron
      ));
    } else {
      const node = getNodeAtPosition(pos.x, pos.y);
      const nodeId = node?.id || null;
      setHoveredNode(nodeId);
      onNodeHover?.(nodeId);
    }
  }, [draggedNode, dragOffset, getMousePos, getNodeAtPosition, onNodeHover]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const node = getNodeAtPosition(pos.x, pos.y);

    if (node) {
      setDraggedNode(node.id);
      setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
      setSelectedNode(node.id);
      onNodeSelect?.(node.id);
    } else {
      setSelectedNode(null);
    }
  }, [getMousePos, getNodeAtPosition, onNodeSelect]);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
  }, []);

  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = {
          width: Math.max(400, rect.width - 32),
          height: Math.max(300, rect.height - 120)
        };
        dimensions.current = newDimensions;

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
      updateDimensions();
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

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!accessibilityState.isKeyboardNavigation) return;

      const activeNeuron = neurons.find(n => n.id === selectedNode);
      if (!activeNeuron) return;

      let newX = activeNeuron.x;
      let newY = activeNeuron.y;
      const moveStep = 10;

      switch (e.key) {
        case 'ArrowUp':
          newY -= moveStep;
          break;
        case 'ArrowDown':
          newY += moveStep;
          break;
        case 'ArrowLeft':
          newX -= moveStep;
          break;
        case 'ArrowRight':
          newX += moveStep;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onNodeSelect?.(activeNeuron.id);
          break;
      }

      if (newX !== activeNeuron.x || newY !== activeNeuron.y) {
        e.preventDefault();
        setNeurons(prev => prev.map(neuron =>
          neuron.id === activeNeuron.id
            ? { ...neuron, x: newX, y: newY, pinned: true }
            : neuron
        ));
      }
    };

    if (accessibilityState.isKeyboardNavigation) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedNode, neurons, accessibilityState.isKeyboardNavigation, onNodeSelect]);

  // Control handlers
  const handleToggleMode = useCallback((mode: 'network' | 'heatmap' | 'graph') => {
    setNeuralType(mode);
    accessibilityActions.announce(`Switched to ${mode} view`);
  }, [accessibilityActions]);

  const handleSimulationControl = useCallback((action: 'toggle' | 'reset') => {
    if (action === 'toggle') {
      setIsPlaying(prev => !prev);
      accessibilityActions.announce(isPlaying ? 'Simulation paused' : 'Simulation resumed');
    } else if (action === 'reset') {
      initializeNeuralNetwork();
      accessibilityActions.announce('Neural network reset');
    }
  }, [isPlaying, accessibilityActions, initializeNeuralNetwork]);

  const handleToggleConnections = useCallback((enabled: boolean) => {
    setConnectionLines(enabled);
    accessibilityActions.announce(enabled ? 'Connection lines enabled' : 'Connection lines disabled');
  }, [accessibilityActions]);

  const handleToggleLabels = useCallback((enabled: boolean) => {
    setShowLabels(enabled);
    accessibilityActions.announce(enabled ? 'Labels enabled' : 'Labels disabled');
  }, [accessibilityActions]);

  const handleExport = useCallback((format: 'png' | 'svg' | 'json') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (format === 'png') {
      const link = document.createElement('a');
      link.download = `neural-visualization-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else if (format === 'json') {
      const neuralData = {
        nodes: neurons,
        connections: optimizedData?.connections || [],
        metrics: optimizedData?.metrics || {},
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(neuralData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = `neural-data-${Date.now()}.json`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
    accessibilityActions.announce(`Exported as ${format}`);
  }, [neurons, optimizedData, accessibilityActions]);

  const handleSettings = useCallback(() => {
    setShowHelp(true);
    accessibilityActions.announce('Opening help dialog');
  }, [accessibilityActions]);

  return (
    <div 
      className="neural-view-container" 
      ref={containerRef}
      style={{ position: 'relative' }}
      role="img"
      aria-label="Neural network visualization"
    >
      <div className="neural-view-header">
        <h2 className="neural-view-title">
          <Brain size={24} style={{ marginRight: '0.5rem' }} />
          Neural Analysis View
        </h2>
      </div>

      <div
        className="neural-canvas"
        data-neural-type={neuralType}
        data-neural-active={isPlaying.toString()}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          style={{ width: '100%', height: '100%' }}
          aria-label="Interactive neural network canvas"
          role="application"
        />
        
        {isLoading && (
          <div className="neural-loading" aria-live="polite">
            <Zap size={24} style={{ marginRight: '0.5rem' }} />
            Analyzing neural patterns...
          </div>
        )}

        {error && (
          <div className="neural-error" aria-live="assertive">
            Neural analysis error: {error}
          </div>
        )}

        {!isLoading && !error && (!optimizedData || optimizedData.nodes.length === 0) && (
          <div className="neural-empty">
            <div className="neural-empty-icon">
              <Brain size={48} />
            </div>
            <div>No neural data available for visualization</div>
          </div>
        )}
      </div>

      {/* Help Overlay */}
      {showHelp && (
        <div 
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
            <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative">
                <button
                    onClick={() => {
                      setShowHelp(false);
                      accessibilityActions.announce('Help dialog closed');
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                    aria-label="Close help dialog"
                    title="Close help"
                >
                    <X size={24} />
                </button>
                
                <h3 id="help-title" className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
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

export default NeuralViewOptimized;