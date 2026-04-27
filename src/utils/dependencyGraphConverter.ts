/**
 * Utility to convert backend dependency graph to NeuralView format
 */

import type { NeuralData } from "../types/frontend";

export interface DependencyGraph {
  nodes: Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    type: string;
    extension?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    weight?: number;
  }>;
}

/**
 * Convert dependency graph to NeuralView NeuralData format
 */
export function convertDependencyGraphToNeuralData(dependencyGraph: DependencyGraph): NeuralData {
  if (!dependencyGraph || !dependencyGraph.nodes) {
    return {
      nodes: [],
      connections: [],
      metrics: {
        neuralDensity: 0,
        connectionStrength: 0,
        patternRecognition: 0,
        anomalyScore: 0,
        circularDependencies: 0,
        missingDependencies: 0,
      },
    };
  }

  const { nodes, edges } = dependencyGraph;

  // Convert nodes to NeuralView format with positions
  const canvasSize = 800;
  const nodeCount = nodes.length;
  const gridCols = Math.ceil(Math.sqrt(nodeCount));
  const gridRows = Math.ceil(nodeCount / gridCols);

  const convertedNodes = nodes.map((node, index) => {
    // Calculate position in a grid layout
    const col = index % gridCols;
    const row = Math.floor(index / gridCols);
    const x = (col / (gridCols - 1 || 1)) * (canvasSize - 100) + 50;
    const y = (row / (gridRows - 1 || 1)) * (canvasSize - 100) + 50;

    // Determine file type based on extension
    const fileType = getFileType(node.extension, node.type);

    return {
      id: node.id,
      x: x + (Math.random() - 0.5) * 50, // Add slight randomness
      y: y + (Math.random() - 0.5) * 50,
      size: Math.max(5, Math.min(20, Math.log10(node.size + 1) * 3)),
      type: (node.type === "directory" ? "directory" : "file") as "pattern" | "directory" | "file",
      connections: [],
      fileType,
      fileSize: node.size,
      category: node.type,
    };
  });

  // Build connection map for each node
  const connectionMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!connectionMap.has(edge.from)) {
      connectionMap.set(edge.from, []);
    }
    connectionMap.get(edge.from)!.push(edge.to);
  });

  // Update nodes with their connections
  convertedNodes.forEach((node) => {
    node.connections = connectionMap.get(node.id) || [];
  });

  // Convert edges to NeuralView connections format
  const convertedConnections = edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    strength: edge.weight || 1,
    type:
      edge.type === "import" ? "dependency" : (edge.type as "similarity" | "dependency" | "access"),
  }));

  // Calculate metrics
  const metrics = calculateMetrics(nodes, edges);

  return {
    nodes: convertedNodes,
    connections: convertedConnections,
    metrics,
  };
}

/**
 * Determine file type based on extension and node type
 */
function getFileType(
  extension?: string,
  nodeType?: string
): "video" | "document" | "system" | "other" {
  if (nodeType === "directory") return "system";

  const videoExtensions = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
  const documentExtensions = ["pdf", "doc", "docx", "txt", "md", "rtf", "odt"];
  const systemExtensions = ["exe", "dll", "sys", "bat", "sh", "cmd"];

  if (extension && videoExtensions.includes(extension.toLowerCase())) return "video";
  if (extension && documentExtensions.includes(extension.toLowerCase())) return "document";
  if (extension && systemExtensions.includes(extension.toLowerCase())) return "system";

  return "other";
}

/**
 * Calculate neural metrics from dependency graph
 */
function calculateMetrics(nodes: any[], edges: any[]) {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  // Neural density: ratio of actual edges to possible edges
  const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
  const neuralDensity = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

  // Connection strength: average weight of edges
  const totalWeight = edges.reduce((sum, edge) => sum + (edge.weight || 1), 0);
  const connectionStrength = edgeCount > 0 ? totalWeight / edgeCount : 0;

  // Pattern recognition: based on node type diversity
  const typeSet = new Set(nodes.map((n) => n.type));
  const patternRecognition = typeSet.size / Math.max(nodeCount, 1);

  // Anomaly score: based on nodes with unusual connection counts
  const connectionCounts = new Map<string, number>();
  edges.forEach((edge) => {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) || 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) || 0) + 1);
  });

  const avgConnections =
    Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0) /
    Math.max(connectionCounts.size, 1);
  const anomalyCount = Array.from(connectionCounts.values()).filter(
    (count) => Math.abs(count - avgConnections) > avgConnections * 2
  ).length;
  const anomalyScore = connectionCounts.size > 0 ? anomalyCount / connectionCounts.size : 0;

  return {
    neuralDensity: Math.min(neuralDensity, 1),
    connectionStrength: Math.min(connectionStrength, 1),
    patternRecognition: Math.min(patternRecognition, 1),
    anomalyScore: Math.min(anomalyScore, 1),
    circularDependencies: 0,
    missingDependencies: 0,
  };
}
