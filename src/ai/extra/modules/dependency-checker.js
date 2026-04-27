/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

/**
 * Dependency Checker Module for Space Analyzer Pro 2026
 * Analyzes code files for dependencies and relationships
 */

export class DependencyChecker {
  constructor() {
    this.supportedLanguages = {
      javascript: [".js", ".jsx", ".ts", ".tsx", ".mjs"],
      python: [".py"],
      java: [".java"],
      cpp: [".cpp", ".c", ".h", ".hpp"],
      go: [".go"],
      rust: [".rs"],
      json: [".json"],
      yaml: [".yaml", ".yml"],
      xml: [".xml"],
      html: [".html", ".htm"],
      css: [".css", ".scss", ".sass", ".less"],
    };

    this.dependencyPatterns = {
      javascript: [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ],
      typescript: [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /import\s+.*?=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ],
      python: [
        /import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g,
        /from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/g,
      ],
      java: [/import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*;/g],
      cpp: [/#include\s*[<"]([^>"]+)[>"]/g],
      go: [/import\s*\(\s*["]([^"]+)["]\s*\)/g, /import\s+["]([^"]+)["]/g],
      rust: [/use\s+([^;]+);/g, /extern\s+crate\s+([^\s;]+);/g],
      json: [/"dependencies"\s*:\s*\{([^}]+)\}/g],
      yaml: [/dependencies\s*:\s*([^}]+?)(?=^[a-z]|\n---|\n$)/gms],
      xml: [/<dependency[^>]*>[\s\S]*?<\/dependency>/g],
      html: [
        /<script[^>]*src\s*=\s*['"]([^'"]+)['"][^>]*>/g,
        /<link[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>/g,
      ],
      css: [/@import\s+['"]([^'"]+)['"]/g, /url\s*\(\s*['"]([^'"]+)['"]\s*\)/g],
    };
  }

  /**
   * Analyze dependencies for a directory of files
   */
  async analyzeDependencies(files) {
    const dependencyGraph = {
      nodes: [],
      edges: [],
      circularDependencies: [],
      missingDependencies: [],
      vulnerabilityReport: [],
      recommendations: [],
    };

    // Process each file
    for (const file of files) {
      if (this.isSupportedFile(file.path)) {
        const fileNode = await this.analyzeFileDependencies(file);
        if (fileNode) {
          dependencyGraph.nodes.push(fileNode);
        }
      }
    }

    // Build dependency relationships
    dependencyGraph.edges = this.buildDependencyEdges(dependencyGraph.nodes);

    // Analyze for issues
    dependencyGraph.circularDependencies = this.detectCircularDependencies(dependencyGraph.edges);
    dependencyGraph.missingDependencies = await this.detectMissingDependencies(
      dependencyGraph.nodes,
      dependencyGraph.edges
    );
    dependencyGraph.vulnerabilityReport = await this.checkVulnerabilities(dependencyGraph.nodes);
    dependencyGraph.recommendations = this.generateRecommendations(dependencyGraph);

    return dependencyGraph;
  }

  /**
   * Analyze dependencies for a single file
   */
  async analyzeFileDependencies(file) {
    const language = this.detectLanguage(file.path);
    if (!language) return null;

    const content = file.content_preview || "";
    const dependencies = this.extractDependencies(content, language);

    return {
      id: file.path,
      name: file.name,
      path: file.path,
      type: "file",
      language: language,
      dependencies: dependencies,
      dependents: [], // Will be populated when building edges
      size: file.size,
      category: file.category,
      complexity: file.complexity_score || 1,
      lastModified: file.modified,
    };
  }

  /**
   * Extract dependencies from file content
   */
  extractDependencies(content, language) {
    const patterns = this.dependencyPatterns[language] || [];
    const dependencies = new Set();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dep = match[1];
        if (dep && this.isValidDependency(dep, language)) {
          dependencies.add(this.normalizeDependency(dep, language));
        }
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Build dependency edges between nodes
   */
  buildDependencyEdges(nodes) {
    const edges = [];
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    for (const node of nodes) {
      for (const dep of node.dependencies) {
        // Try to find matching node
        const targetNode = this.findDependencyNode(dep, nodes);
        if (targetNode && targetNode.id !== node.id) {
          edges.push({
            from: node.id,
            to: targetNode.id,
            type: "dependency",
            strength: this.calculateDependencyStrength(node, targetNode),
            language: node.language,
          });

          // Add to dependents
          if (!targetNode.dependents.includes(node.id)) {
            targetNode.dependents.push(node.id);
          }
        }
      }
    }

    return edges;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(edges) {
    const circularDeps = [];
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (nodeId, path = []) => {
      if (recStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        circularDeps.push(path.slice(cycleStart));
        return true;
      }

      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const outgoingEdges = edges.filter((edge) => edge.from === nodeId);
      for (const edge of outgoingEdges) {
        if (hasCycle(edge.to, [...path])) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    const nodeIds = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))];
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        hasCycle(nodeId);
      }
    }

    return circularDeps;
  }

  /**
   * Detect missing dependencies
   */
  async detectMissingDependencies(nodes, edges) {
    const missingDeps = [];
    const existingPaths = new Set(nodes.map((node) => node.path));

    for (const edge of edges) {
      const targetNode = nodes.find((node) => node.id === edge.to);
      if (!targetNode) {
        missingDeps.push({
          from: edge.from,
          dependency: edge.to,
          type: "missing_file",
        });
      }
    }

    return missingDeps;
  }

  /**
   * Check for known vulnerabilities
   */
  async checkVulnerabilities(nodes) {
    // This would integrate with vulnerability databases
    // For now, return empty report
    return [];
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(dependencyGraph) {
    const recommendations = [];

    // Circular dependency recommendations
    if (dependencyGraph.circularDependencies.length > 0) {
      recommendations.push({
        type: "refactor",
        priority: "high",
        message: `Found ${dependencyGraph.circularDependencies.length} circular dependencies. Consider breaking these cycles by introducing interfaces or dependency injection.`,
      });
    }

    // Missing dependency recommendations
    if (dependencyGraph.missingDependencies.length > 0) {
      recommendations.push({
        type: "install",
        priority: "high",
        message: `Found ${dependencyGraph.missingDependencies.length} missing dependencies. Ensure all required packages are installed.`,
      });
    }

    // Unused dependency recommendations
    const unusedDeps = this.findUnusedDependencies(dependencyGraph);
    if (unusedDeps.length > 0) {
      recommendations.push({
        type: "cleanup",
        priority: "medium",
        message: `Found ${unusedDeps.length} potentially unused dependencies. Consider removing them to reduce bundle size.`,
      });
    }

    return recommendations;
  }

  /**
   * Find unused dependencies
   */
  findUnusedDependencies(dependencyGraph) {
    return dependencyGraph.nodes.filter(
      (node) => node.dependents.length === 0 && node.type === "external"
    );
  }

  /**
   * Helper methods
   */
  isSupportedFile(filePath) {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
    return Object.values(this.supportedLanguages).flat().includes(extension);
  }

  detectLanguage(filePath) {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
    for (const [lang, extensions] of Object.entries(this.supportedLanguages)) {
      if (extensions.includes(extension)) {
        return lang;
      }
    }
    return null;
  }

  isValidDependency(dep, language) {
    // Filter out relative paths and URLs for external dependencies
    if (language === "javascript" || language === "typescript") {
      return !dep.startsWith(".") && !dep.startsWith("/");
    }
    return true;
  }

  normalizeDependency(dep, language) {
    if (language === "javascript" || language === "typescript") {
      // Remove file extensions for module names
      return dep.replace(/\.[^/.]+$/, "");
    }
    return dep;
  }

  findDependencyNode(dep, nodes) {
    // Try exact match first
    let node = nodes.find((n) => n.name === dep || n.path.includes(dep));

    // Try fuzzy matching for partial names
    if (!node) {
      const depLower = dep.toLowerCase();
      node = nodes.find(
        (n) => n.name.toLowerCase().includes(depLower) || depLower.includes(n.name.toLowerCase())
      );
    }

    return node;
  }

  calculateDependencyStrength(fromNode, toNode) {
    // Calculate strength based on various factors
    let strength = 0.5;

    // Language compatibility
    if (fromNode.language === toNode.language) strength += 0.2;

    // Size factor (larger files might be more important)
    if (toNode.size > 1000000) strength += 0.1;

    // Complexity factor
    if (toNode.complexity > 5) strength += 0.1;

    return Math.min(1.0, strength);
  }
}
