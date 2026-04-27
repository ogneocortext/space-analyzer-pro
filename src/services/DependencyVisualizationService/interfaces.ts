/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Dependency Visualization Service - Interfaces
// Defines all interfaces and types for dependency visualization

export interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "module" | "package" | "external";
  size: number;
  complexity: number;
  issues: number;
  dependencies: string[];
  dependents: string[];
  circular: boolean;
  layer: number;
  metrics: {
    lines: number;
    functions: number;
    classes: number;
    maintainability: number;
    coupling: number;
    cohesion: number;
  };
}

export interface DependencyLink {
  source: string;
  target: string;
  type: "import" | "require" | "dynamic-import" | "extends" | "implements" | "call";
  strength: number;
  frequency: number;
  bidirectional: boolean;
  circular: boolean;
  distance: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  links: DependencyLink[];
  metadata: {
    totalNodes: number;
    totalLinks: number;
    circularDependencies: number;
    maxDepth: number;
    avgComplexity: number;
    totalComplexity: number;
    coupling: number;
    cohesion: number;
    maintainability: number;
  };
}

export interface OptimizationSuggestion {
  id: string;
  type:
    | "remove-unused"
    | "merge-modules"
    | "split-large"
    | "reduce-coupling"
    | "eliminate-circular"
    | "layer-violation"
    | "external-dependency";
  title: string;
  description: string;
  impact: {
    complexityReduction: number;
    maintainabilityImprovement: number;
    sizeReduction: number;
    couplingReduction: number;
  };
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  nodes: string[];
  beforeState: any;
  afterState: any;
  automated: boolean;
  steps: string[];
}

export interface LayerAnalysis {
  layers: {
    layer: number;
    name: string;
    nodes: string[];
    violations: string[];
  }[];
  violations: {
    source: string;
    target: string;
    sourceLayer: number;
    targetLayer: number;
    violation: "upward" | "downward" | "same";
  }[];
}

export interface OptimizationStatistics {
  total: number;
  byType: { [key: string]: number };
  byEffort: { [key: string]: number };
  byRisk: { [key: string]: number };
  automated: number;
  manual: number;
  totalImpact: {
    complexityReduction: number;
    maintainabilityImprovement: number;
    sizeReduction: number;
    couplingReduction: number;
  };
}
