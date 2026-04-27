/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Neural Data Service - Transforms analysis data into neural network visualization format

export interface NeuralData {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    size: number;
    type: "file" | "directory" | "pattern";
    connections: string[];
    fileType?: "video" | "document" | "system" | "other" | "code" | "image" | "audio" | "archive";
    fileSize?: number;
    accessFrequency?: number;
    category?: string;
    path?: string;
  }>;
  connections: Array<{
    from: string;
    to: string;
    strength: number;
    type: "similarity" | "dependency" | "access" | "category";
    accessFrequency?: number;
  }>;
  metrics: {
    neuralDensity: number;
    connectionStrength: number;
    patternRecognition: number;
    anomalyScore: number;
  };
}

export class NeuralDataService {
  private static instance: NeuralDataService;

  static getInstance(): NeuralDataService {
    if (!NeuralDataService.instance) {
      NeuralDataService.instance = new NeuralDataService();
    }
    return NeuralDataService.instance;
  }

  /**
   * Transform analysis data into neural network visualization format
   */
  transformAnalysisData(analysisData: any): NeuralData {
    if (!analysisData || !analysisData.files) {
      return this.getEmptyNeuralData();
    }

    const files = analysisData.files;
    const categories = analysisData.categories || {};

    // Create nodes from files
    const nodes = this.createNodes(files, categories);

    // Create connections based on relationships
    const connections = this.createConnections(nodes, categories);

    // Calculate neural metrics
    const metrics = this.calculateMetrics(nodes, connections);

    return {
      nodes,
      connections,
      metrics,
    };
  }

  /**
   * Create neural nodes from file data
   */
  private createNodes(files: any[], categories: any): NeuralData["nodes"] {
    const nodes: NeuralData["nodes"] = [];
    const categoryGroups: { [key: string]: any[] } = {};

    // Group files by category
    files.forEach((file) => {
      const category = this.getFileCategory(file, categories);
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(file);
    });

    // Create category nodes (hubs)
    Object.keys(categoryGroups).forEach((category, index) => {
      const angle = (index / Object.keys(categoryGroups).length) * 2 * Math.PI;
      const radius = 150;

      nodes.push({
        id: `category-${category}`,
        x: 400 + Math.cos(angle) * radius,
        y: 250 + Math.sin(angle) * radius,
        size: Math.min(50, Math.max(20, categoryGroups[category].length * 2)),
        type: "pattern",
        connections: [],
        category,
        accessFrequency: categoryGroups[category].length,
      });
    });

    // Create file nodes
    files.forEach((file, index) => {
      if (index > 100) return; // Limit to 100 files for performance

      const category = this.getFileCategory(file, categories);
      const categoryNode = nodes.find((n) => n.id === `category-${category}`);

      if (categoryNode) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = 30 + Math.random() * 50;

        nodes.push({
          id: `file-${index}`,
          x: categoryNode.x + Math.cos(angle) * radius,
          y: categoryNode.y + Math.sin(angle) * radius,
          size: Math.min(15, Math.max(5, Math.log10(file.size + 1) * 3)),
          type: "file",
          connections: [categoryNode.id],
          fileType: this.getFileType(file.extension),
          fileSize: file.size,
          category,
          path: file.path,
          accessFrequency: Math.random() * 10, // Simulated access frequency
        });

        // Add connection back to category node
        categoryNode.connections.push(`file-${index}`);
      }
    });

    return nodes;
  }

  /**
   * Create connections between nodes based on relationships
   */
  private createConnections(
    nodes: NeuralData["nodes"],
    categories: any
  ): NeuralData["connections"] {
    const connections: NeuralData["connections"] = [];

    // Create category-to-category connections based on similarity
    const categoryNodes = nodes.filter((n) => n.type === "pattern");

    categoryNodes.forEach((node1, i) => {
      categoryNodes.slice(i + 1).forEach((node2) => {
        const strength = this.calculateCategorySimilarity(
          node1.category!,
          node2.category!,
          categories
        );
        if (strength > 0.3) {
          connections.push({
            from: node1.id,
            to: node2.id,
            strength,
            type: "similarity",
          });
        }
      });
    });

    // Create file-to-file connections for similar files
    const fileNodes = nodes.filter((n) => n.type === "file");

    fileNodes.forEach((node1, i) => {
      fileNodes.slice(i + 1).forEach((node2) => {
        if (node1.fileType === node2.fileType && node1.category === node2.category) {
          const distance = this.calculateDistance(node1, node2);
          if (distance < 100) {
            connections.push({
              from: node1.id,
              to: node2.id,
              strength: 1 - distance / 100,
              type: "similarity",
            });
          }
        }
      });
    });

    return connections;
  }

  /**
   * Calculate neural network metrics
   */
  private calculateMetrics(
    nodes: NeuralData["nodes"],
    connections: NeuralData["connections"]
  ): NeuralData["metrics"] {
    const nodeCount = nodes.length;
    const connectionCount = connections.length;

    // Neural density: ratio of actual connections to possible connections
    const maxPossibleConnections = (nodeCount * (nodeCount - 1)) / 2;
    const neuralDensity = maxPossibleConnections > 0 ? connectionCount / maxPossibleConnections : 0;

    // Connection strength: average strength of all connections
    const connectionStrength =
      connections.length > 0
        ? connections.reduce((sum, conn) => sum + conn.strength, 0) / connections.length
        : 0;

    // Pattern recognition: based on category clustering
    const categoryNodes = nodes.filter((n) => n.type === "pattern");
    const patternRecognition = categoryNodes.length > 0 ? categoryNodes.length / nodes.length : 0;

    // Anomaly score: based on outlier detection
    const anomalyScore = this.calculateAnomalyScore(nodes, connections);

    return {
      neuralDensity: Math.min(1, neuralDensity),
      connectionStrength: Math.min(1, connectionStrength),
      patternRecognition: Math.min(1, patternRecognition),
      anomalyScore: Math.min(1, anomalyScore),
    };
  }

  /**
   * Helper methods
   */
  private getFileCategory(file: any, categories: any): string {
    if (file.category) return file.category;

    const ext = file.extension?.toLowerCase();
    if (!ext) return "other";

    // Category mapping
    const categoryMap: { [key: string]: string } = {
      ".js": "code",
      ".ts": "code",
      ".jsx": "code",
      ".tsx": "code",
      ".py": "code",
      ".java": "code",
      ".cpp": "code",
      ".c": "code",
      ".jpg": "images",
      ".jpeg": "images",
      ".png": "images",
      ".gif": "images",
      ".mp4": "video",
      ".avi": "video",
      ".mkv": "video",
      ".mp3": "audio",
      ".wav": "audio",
      ".flac": "audio",
      ".pdf": "documents",
      ".doc": "documents",
      ".txt": "documents",
      ".md": "documents",
      ".zip": "archives",
      ".rar": "archives",
      ".7z": "archives",
      ".exe": "system",
      ".dll": "system",
      ".sys": "system",
    };

    return categoryMap[ext] || "other";
  }

  private getFileType(extension?: string): NeuralData["nodes"][0]["fileType"] {
    if (!extension) return "other";

    const ext = extension.toLowerCase();
    if ([".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c"].includes(ext)) return "code";
    if ([".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(ext)) return "image";
    if ([".mp4", ".avi", ".mkv", ".mov", ".wmv"].includes(ext)) return "video";
    if ([".mp3", ".wav", ".flac", ".aac", ".ogg"].includes(ext)) return "audio";
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
    if ([".pdf", ".doc", ".docx", ".txt", ".md"].includes(ext)) return "document";
    if ([".exe", ".dll", ".sys", ".bat", ".sh"].includes(ext)) return "system";

    return "other";
  }

  private calculateCategorySimilarity(cat1: string, cat2: string, categories: any): number {
    // Simple similarity based on category types
    const typeGroups: { [key: string]: string[] } = {
      media: ["images", "video", "audio"],
      code: ["code", "documents"],
      system: ["system", "archives"],
      other: ["other"],
    };

    for (const [group, cats] of Object.entries(typeGroups)) {
      if (cats.includes(cat1) && cats.includes(cat2)) {
        return 0.6 + Math.random() * 0.4; // 0.6-1.0 similarity
      }
    }

    return Math.random() * 0.3; // 0-0.3 similarity for different groups
  }

  private calculateDistance(node1: NeuralData["nodes"][0], node2: NeuralData["nodes"][0]): number {
    const dx = node1.x - node2.x;
    const dy = node1.y - node2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateAnomalyScore(
    nodes: NeuralData["nodes"],
    connections: NeuralData["connections"]
  ): number {
    // Simple anomaly detection based on connection patterns
    const connectionCounts = new Map<string, number>();

    connections.forEach((conn) => {
      connectionCounts.set(conn.from, (connectionCounts.get(conn.from) || 0) + 1);
      connectionCounts.set(conn.to, (connectionCounts.get(conn.to) || 0) + 1);
    });

    const avgConnections =
      nodes.length > 0
        ? Array.from(connectionCounts.values()).reduce((sum, count) => sum + count, 0) /
          nodes.length
        : 0;

    // Nodes with very few or very many connections are potential anomalies
    let anomalyCount = 0;
    connectionCounts.forEach((count) => {
      if (count < avgConnections * 0.5 || count > avgConnections * 2) {
        anomalyCount++;
      }
    });

    return nodes.length > 0 ? anomalyCount / nodes.length : 0;
  }

  private getEmptyNeuralData(): NeuralData {
    return {
      nodes: [],
      connections: [],
      metrics: {
        neuralDensity: 0,
        connectionStrength: 0,
        patternRecognition: 0,
        anomalyScore: 0,
      },
    };
  }
}

// Export singleton instance
export const neuralDataService = NeuralDataService.getInstance();
