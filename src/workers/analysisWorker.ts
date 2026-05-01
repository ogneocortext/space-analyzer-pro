// Web Worker for heavy computations in Space Analyzer
// Handles file analysis, neural physics calculations, and data processing

import * as Comlink from "comlink";

export interface WorkerAPI {
  analyzeFileTree: (files: FileNode[], options: AnalysisOptions) => Promise<AnalysisResult>;
  calculateNeuralPhysics: (nodes: NeuralNode[], deltaTime: number) => Promise<NeuralNode[]>;
  processLargeDataset: (
    data: Array<Record<string, unknown>>,
    operation: string
  ) => Promise<Record<string, unknown>>;
  generateFileInsights: (files: FileNode[]) => Promise<FileInsights>;
  calculateDuplicates: (files: FileNode[]) => Promise<DuplicateGroup[]>;
  compressAnalysis: (data: Record<string, unknown>) => Promise<CompressedData>;
  simulateHash: (file: FileNode) => string;
}

export interface FileNode {
  name: string;
  path: string;
  size: number;
  type: "file" | "directory";
  modified: Date;
  accessed?: Date;
  children?: FileNode[];
  hash?: string;
}

export interface AnalysisOptions {
  includeHashes?: boolean;
  deepScan?: boolean;
  maxDepth?: number;
  excludePatterns?: string[];
}

export interface AnalysisResult {
  totalSize: number;
  totalFiles: number;
  totalDirectories: number;
  largestFiles: FileNode[];
  fileTypes: Record<string, { count: number; size: number }>;
  sizeDistribution: SizeBucket[];
  scanTime: number;
}

export interface NeuralNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  charge: number;
  connections: string[];
  data: FileNode;
}

export interface FileInsights {
  duplicates: DuplicateGroup[];
  largeFiles: FileNode[];
  oldFiles: FileNode[];
  temporaryFiles: FileNode[];
  recommendations: string[];
}

export interface DuplicateGroup {
  files: FileNode[];
  totalSize: number;
  hash: string;
}

export interface SizeBucket {
  min: number;
  max: number;
  count: number;
  totalSize: number;
}

export interface CompressedData {
  version: string;
  timestamp: number;
  data: string;
  compression: string;
}

// Main worker implementation
const worker: WorkerAPI = {
  async analyzeFileTree(files: FileNode[], options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const startTime = performance.now();

    const result: AnalysisResult = {
      totalSize: 0,
      totalFiles: 0,
      totalDirectories: 0,
      largestFiles: [],
      fileTypes: {},
      sizeDistribution: [],
      scanTime: 0,
    };

    const processNode = (node: FileNode, depth = 0): void => {
      if (options.maxDepth && depth > options.maxDepth) return;

      if (node.type === "file") {
        result.totalFiles++;
        result.totalSize += node.size;

        // Track file types
        const ext = node.name.split(".").pop()?.toLowerCase() || "unknown";
        if (!result.fileTypes[ext]) {
          result.fileTypes[ext] = { count: 0, size: 0 };
        }
        result.fileTypes[ext].count++;
        result.fileTypes[ext].size += node.size;

        // Track largest files
        result.largestFiles.push(node);
        result.largestFiles.sort((a, b) => b.size - a.size);
        if (result.largestFiles.length > 10) {
          result.largestFiles.pop();
        }
      } else if (node.type === "directory") {
        result.totalDirectories++;
      }

      // Process children
      if (node.children) {
        for (const child of node.children) {
          processNode(child, depth + 1);
        }
      }
    };

    // Process all files
    for (const file of files) {
      processNode(file);
    }

    // Generate size distribution
    const sizeBuckets = [
      { min: 0, max: 1024, label: "< 1KB" },
      { min: 1024, max: 1024 * 1024, label: "1KB - 1MB" },
      { min: 1024 * 1024, max: 1024 * 1024 * 100, label: "1MB - 100MB" },
      { min: 1024 * 1024 * 100, max: 1024 * 1024 * 1024, label: "100MB - 1GB" },
      { min: 1024 * 1024 * 1024, max: Infinity, label: "> 1GB" },
    ];

    result.sizeDistribution = sizeBuckets.map((bucket) => {
      const bucketFiles = files.filter(
        (f) => f.type === "file" && f.size >= bucket.min && f.size < bucket.max
      );

      return {
        min: bucket.min,
        max: bucket.max,
        count: bucketFiles.length,
        totalSize: bucketFiles.reduce((sum, f) => sum + f.size, 0),
      };
    });

    result.scanTime = performance.now() - startTime;

    return result;
  },

  async calculateNeuralPhysics(nodes: NeuralNode[], deltaTime: number): Promise<NeuralNode[]> {
    const updatedNodes = [...nodes];
    const damping = 0.95;
    const repulsionStrength = 1000;
    const attractionStrength = 0.001;
    const centerForce = 0.01;

    // Apply forces to each node
    for (let i = 0; i < updatedNodes.length; i++) {
      const node = updatedNodes[i];
      let fx = 0;
      let fy = 0;

      // Repulsion between all nodes
      for (let j = 0; j < updatedNodes.length; j++) {
        if (i === j) continue;

        const other = updatedNodes[j];
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance < 200) {
          const force = repulsionStrength / (distance * distance);
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        }
      }

      // Attraction along connections
      for (const connectionId of node.connections) {
        const connected = updatedNodes.find((n) => n.id === connectionId);
        if (connected) {
          const dx = connected.x - node.x;
          const dy = connected.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 50) {
            fx += dx * attractionStrength;
            fy += dy * attractionStrength;
          }
        }
      }

      // Center force
      fx -= node.x * centerForce;
      fy -= node.y * centerForce;

      // Update velocity
      node.vx = (node.vx + fx * deltaTime) * damping;
      node.vy = (node.vy + fy * deltaTime) * damping;

      // Update position
      node.x += node.vx * deltaTime;
      node.y += node.vy * deltaTime;

      // Keep nodes within bounds
      const maxRadius = 300;
      const distance = Math.sqrt(node.x * node.x + node.y * node.y);
      if (distance > maxRadius) {
        node.x = (node.x / distance) * maxRadius;
        node.y = (node.y / distance) * maxRadius;
        node.vx *= -0.5;
        node.vy *= -0.5;
      }
    }

    return updatedNodes;
  },

  async processLargeDataset(data: Array<Record<string, unknown>>, operation: string): Promise<any> {
    switch (operation) {
      case "sort":
        return data.sort((a: any, b: any) => b.size - a.size);

      case "group": {
        const groups = data.reduce((acc: any, item) => {
          const key = (item.type as string) || "unknown";
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});
        return groups;
      }

      case "aggregate": {
        return data.reduce((acc: any, item: any) => {
          acc.totalSize = (acc.totalSize || 0) + (item.size || 0);
          acc.count = (acc.count || 0) + 1;
          return acc;
        }, {});
      }

      case "filter-large":
        return data.filter((item: any) => item.size > 1024 * 1024); // > 1MB

      default:
        return data;
    }
  },

  async generateFileInsights(files: FileNode[]): Promise<FileInsights> {
    const insights: FileInsights = {
      duplicates: [],
      largeFiles: [],
      oldFiles: [],
      temporaryFiles: [],
      recommendations: [],
    };

    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Find large files (>100MB)
    insights.largeFiles = files
      .filter((f) => f.type === "file" && f.size > 100 * 1024 * 1024)
      .sort((a, b) => b.size - a.size)
      .slice(0, 20);

    // Find old files (>1 year)
    insights.oldFiles = files
      .filter((f) => f.type === "file" && f.modified < oneYearAgo)
      .sort((a, b) => a.modified.getTime() - b.modified.getTime());

    // Find temporary files
    insights.temporaryFiles = files.filter(
      (f) =>
        f.type === "file" &&
        (f.name.startsWith(".") ||
          f.name.includes("tmp") ||
          f.name.includes("temp") ||
          f.name.endsWith(".tmp") ||
          f.name.endsWith(".temp"))
    );

    // Generate recommendations
    if (insights.largeFiles.length > 0) {
      insights.recommendations.push(
        `Found ${insights.largeFiles.length} large files that could be compressed or moved to cloud storage`
      );
    }

    if (insights.oldFiles.length > 0) {
      insights.recommendations.push(
        `Found ${insights.oldFiles.length} files older than 1 year that could be archived`
      );
    }

    if (insights.temporaryFiles.length > 0) {
      insights.recommendations.push(
        `Found ${insights.temporaryFiles.length} temporary files that can likely be safely deleted`
      );
    }

    return insights;
  },

  async calculateDuplicates(files: FileNode[]): Promise<DuplicateGroup[]> {
    const hashGroups = new Map<string, FileNode[]>();

    // Group files by hash (simulated - in real implementation, would calculate actual hashes)
    for (const file of files.filter((f) => f.type === "file")) {
      const hash = file.hash || this.simulateHash(file);
      if (!hashGroups.has(hash)) {
        hashGroups.set(hash, []);
      }
      hashGroups.get(hash)!.push(file);
    }

    // Create duplicate groups
    const duplicateGroups: DuplicateGroup[] = [];
    for (const [hash, group] of hashGroups.entries()) {
      if (group.length > 1) {
        duplicateGroups.push({
          files: group,
          totalSize: group.reduce((sum, f) => sum + f.size, 0),
          hash,
        });
      }
    }

    return duplicateGroups.sort((a, b) => b.totalSize - a.totalSize);
  },

  async compressAnalysis(data: Record<string, unknown>): Promise<CompressedData> {
    // Simple compression simulation
    return {
      version: "1.0",
      timestamp: Date.now(),
      data: JSON.stringify(data),
      compression: "json",
    };
  },

  // Helper method to simulate file hashing
  simulateHash(file: FileNode): string {
    // Simple hash simulation based on file name and size
    const str = `${file.path}:${file.size}:${file.modified.getTime()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  },
};

// Expose the worker API with Comlink
Comlink.expose(worker);

export default worker;
