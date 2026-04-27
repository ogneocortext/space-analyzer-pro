/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Metrics Calculator
// Calculates various metrics for dependency analysis

import { DependencyNode, DependencyLink } from "./interfaces";

export class MetricsCalculator {
  calculateCoupling(nodes: DependencyNode[], links: DependencyLink[]): void {
    nodes.forEach((node) => {
      // Afferent coupling (Ca): number of classes that depend on this class
      const afferent = node.dependents.length;

      // Efferent coupling (Ce): number of classes that this class depends on
      const efferent = node.dependencies.length;

      // Instability: I = Ce / (Ca + Ce)
      const instability = afferent + efferent > 0 ? efferent / (afferent + efferent) : 0;

      node.metrics.coupling = instability;
    });
  }

  calculateOverallCoupling(nodes: DependencyNode[]): number {
    return nodes.reduce((sum, node) => sum + node.metrics.coupling, 0) / nodes.length;
  }

  calculateCohesion(analysis: any): number {
    const functions = analysis.functions || [];
    const classes = analysis.classes || [];

    if (functions.length === 0 && classes.length === 0) return 1;

    // Higher cohesion if functions and classes are related
    const relatedness = this.calculateRelatedness(functions, classes);
    return relatedness;
  }

  private calculateRelatedness(functions: any[], classes: any[]): number {
    // Simplified relatedness calculation
    // In a real implementation, this would analyze function calls, shared variables, etc.
    return Math.random() * 0.5 + 0.5; // Mock value between 0.5 and 1.0
  }

  calculateOverallCohesion(nodes: DependencyNode[]): number {
    return nodes.reduce((sum, node) => sum + node.metrics.cohesion, 0) / nodes.length;
  }

  calculateMaintainability(analysis: any): number {
    const complexity = analysis.complexity || 0;
    const lines = analysis.lines || 0;
    const issues = analysis.issues?.length || 0;

    // Maintainability decreases with complexity, lines, and issues
    const maintainability = Math.max(0, 100 - (complexity * 2 + lines * 0.01 + issues * 5));
    return maintainability;
  }

  calculateOverallMaintainability(nodes: DependencyNode[]): number {
    return nodes.reduce((sum, node) => sum + node.metrics.maintainability, 0) / nodes.length;
  }

  calculateComplexityMetrics(nodes: DependencyNode[]): {
    totalComplexity: number;
    avgComplexity: number;
    maxComplexity: number;
    minComplexity: number;
    highComplexityCount: number;
  } {
    const complexities = nodes.map((n) => n.complexity);

    return {
      totalComplexity: complexities.reduce((sum, c) => sum + c, 0),
      avgComplexity: complexities.reduce((sum, c) => sum + c, 0) / complexities.length,
      maxComplexity: Math.max(...complexities),
      minComplexity: Math.min(...complexities),
      highComplexityCount: complexities.filter((c) => c > 15).length,
    };
  }

  calculateSizeMetrics(nodes: DependencyNode[]): {
    totalSize: number;
    avgSize: number;
    maxSize: number;
    minSize: number;
    largeFileCount: number;
  } {
    const sizes = nodes.map((n) => n.size);

    return {
      totalSize: sizes.reduce((sum, s) => sum + s, 0),
      avgSize: sizes.reduce((sum, s) => sum + s, 0) / sizes.length,
      maxSize: Math.max(...sizes),
      minSize: Math.min(...sizes),
      largeFileCount: sizes.filter((s) => s > 5000).length,
    };
  }

  calculateIssueMetrics(nodes: DependencyNode[]): {
    totalIssues: number;
    avgIssues: number;
    maxIssues: number;
    minIssues: number;
    highIssueCount: number;
  } {
    const issues = nodes.map((n) => n.issues);

    return {
      totalIssues: issues.reduce((sum, i) => sum + i, 0),
      avgIssues: issues.reduce((sum, i) => sum + i, 0) / issues.length,
      maxIssues: Math.max(...issues),
      minIssues: Math.min(...issues),
      highIssueCount: issues.filter((i) => i > 5).length,
    };
  }
}
