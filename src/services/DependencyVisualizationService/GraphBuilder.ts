/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Dependency Graph Builder
// Responsible for building and analyzing dependency graphs

import { DependencyNode, DependencyLink, DependencyGraph } from "./interfaces";

export class GraphBuilder {
  buildDependencyGraph(codeAnalyses: any[]): DependencyGraph {
    console.warn("🔗 Building dependency graph...");

    const nodes: DependencyNode[] = [];
    const links: DependencyLink[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // Create nodes
    for (const analysis of codeAnalyses) {
      const node: DependencyNode = {
        id: analysis.file,
        name: this.getFileName(analysis.file),
        path: analysis.file,
        type: this.getNodeType(analysis.file),
        size: analysis.size || 0,
        complexity: analysis.complexity || 0,
        issues: analysis.issues?.length || 0,
        dependencies: [],
        dependents: [],
        circular: false,
        layer: 0,
        metrics: {
          lines: analysis.lines || 0,
          functions: analysis.functions?.length || 0,
          classes: analysis.classes?.length || 0,
          maintainability: this.calculateMaintainability(analysis),
          coupling: 0,
          cohesion: this.calculateCohesion(analysis),
        },
      };

      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // Create links
    for (const analysis of codeAnalyses) {
      if (analysis.dependencies) {
        for (const dep of analysis.dependencies) {
          const targetNode = nodeMap.get(dep.source);
          const sourceNode = nodeMap.get(analysis.file);

          if (targetNode && sourceNode) {
            const link: DependencyLink = {
              source: sourceNode.id,
              target: targetNode.id,
              type: this.getDependencyType(dep.type),
              strength: this.calculateLinkStrength(sourceNode, targetNode),
              frequency: 1,
              bidirectional: false,
              circular: false,
              distance: this.calculateDistance(sourceNode, targetNode),
            };

            links.push(link);
            sourceNode.dependencies.push(targetNode.id);
            targetNode.dependents.push(sourceNode.id);
          }
        }
      }
    }

    // Calculate metadata
    const metadata = {
      totalNodes: nodes.length,
      totalLinks: links.length,
      circularDependencies: 0, // Will be calculated later
      maxDepth: this.calculateMaxDepth(nodes),
      avgComplexity: nodes.reduce((sum, n) => sum + n.complexity, 0) / nodes.length,
      totalComplexity: nodes.reduce((sum, n) => sum + n.complexity, 0),
      coupling: this.calculateOverallCoupling(nodes),
      cohesion: this.calculateOverallCohesion(nodes),
      maintainability: this.calculateOverallMaintainability(nodes),
    };

    console.warn(
      `✅ Built dependency graph: ${metadata.totalNodes} nodes, ${metadata.totalLinks} links`
    );

    return {
      nodes,
      links,
      metadata,
    };
  }

  private getFileName(path: string): string {
    return path.split("/").pop() || path;
  }

  private getNodeType(path: string): "file" | "module" | "package" | "external" {
    if (path.includes("node_modules")) return "external";
    if (path.includes("src/")) return "module";
    if (path.includes("package.json")) return "package";
    return "file";
  }

  private getDependencyType(type: string): DependencyLink["type"] {
    switch (type) {
      case "import":
        return "import";
      case "require":
        return "require";
      case "dynamic-import":
        return "dynamic-import";
      case "extends":
        return "extends";
      case "implements":
        return "implements";
      case "call":
        return "call";
      default:
        return "import";
    }
  }

  private calculateLinkStrength(source: DependencyNode, target: DependencyNode): number {
    const complexityFactor = (source.complexity + target.complexity) / 2;
    const sizeFactor = (source.size + target.size) / 2;
    return Math.min(1, (complexityFactor + sizeFactor) / 1000);
  }

  private calculateDistance(source: DependencyNode, target: DependencyNode): number {
    const sourceParts = source.path.split("/");
    const targetParts = target.path.split("/");

    let commonDepth = 0;
    const minLength = Math.min(sourceParts.length, targetParts.length);

    for (let i = 0; i < minLength; i++) {
      if (sourceParts[i] === targetParts[i]) {
        commonDepth++;
      } else {
        break;
      }
    }

    return sourceParts.length + targetParts.length - 2 * commonDepth;
  }

  private calculateMaxDepth(nodes: DependencyNode[]): number {
    return Math.max(...nodes.map((node) => node.layer));
  }

  private calculateOverallCoupling(nodes: DependencyNode[]): number {
    return nodes.reduce((sum, node) => sum + node.metrics.coupling, 0) / nodes.length;
  }

  private calculateOverallCohesion(nodes: DependencyNode[]): number {
    return nodes.reduce((sum, node) => sum + node.metrics.cohesion, 0) / nodes.length;
  }

  private calculateOverallMaintainability(nodes: DependencyNode[]): number {
    return nodes.reduce((sum, node) => sum + node.metrics.maintainability, 0) / nodes.length;
  }

  private calculateMaintainability(analysis: any): number {
    const complexity = analysis.complexity || 0;
    const lines = analysis.lines || 0;
    const issues = analysis.issues?.length || 0;

    return Math.max(0, 100 - (complexity * 2 + lines * 0.01 + issues * 5));
  }

  private calculateCohesion(analysis: any): number {
    const functions = analysis.functions || [];
    const classes = analysis.classes || [];

    if (functions.length === 0 && classes.length === 0) return 1;

    return Math.random() * 0.5 + 0.5; // Mock value between 0.5 and 1.0
  }
}
