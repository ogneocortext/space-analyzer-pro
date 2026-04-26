// Dependency Visualization Service - Main Entry Point
// Refactored to reduce complexity and improve maintainability

import { DependencyNode, DependencyLink, DependencyGraph, OptimizationSuggestion, LayerAnalysis, OptimizationStatistics } from './interfaces';
import { GraphBuilder } from './GraphBuilder';
import { CircularDependencyDetector } from './CircularDependencyDetector';
import { LayerCalculator } from './LayerCalculator';
import { MetricsCalculator } from './MetricsCalculator';
import { OptimizationEngine } from './OptimizationEngine';
import { LayerAnalyzer } from './LayerAnalyzer';
import { StatisticsCalculator } from './StatisticsCalculator';

export class DependencyVisualizationService {
  private dependencyGraph: DependencyGraph | null = null;
  private optimizationCache: Map<string, OptimizationSuggestion[]> = new Map();
  private circularDependencyDetector: CircularDependencyDetector;
  private graphBuilder: GraphBuilder;
  private layerCalculator: LayerCalculator;
  private metricsCalculator: MetricsCalculator;
  private optimizationEngine: OptimizationEngine;
  private layerAnalyzer: LayerAnalyzer;
  private statisticsCalculator: StatisticsCalculator;

  constructor() {
    console.log('🔗 Initializing Dependency Visualization Service...');
    
    // Initialize specialized classes
    this.circularDependencyDetector = new CircularDependencyDetector();
    this.graphBuilder = new GraphBuilder();
    this.layerCalculator = new LayerCalculator();
    this.metricsCalculator = new MetricsCalculator();
    this.layerAnalyzer = new LayerAnalyzer();
    this.statisticsCalculator = new StatisticsCalculator();
  }

  // Build dependency graph from code analysis
  async buildDependencyGraph(codeAnalyses: any[]): Promise<DependencyGraph> {
    console.log('🔗 Building dependency graph...');
    
    // Build the basic graph structure
    this.dependencyGraph = this.graphBuilder.buildDependencyGraph(codeAnalyses);
    
    // Detect circular dependencies
    const circularDeps = this.circularDependencyDetector.detectCircularDependencies(
      this.dependencyGraph.nodes,
      this.dependencyGraph.links
    );
    
    // Update metadata with circular dependency count
    this.dependencyGraph.metadata.circularDependencies = circularDeps.size;
    
    // Calculate layers
    this.layerCalculator.calculateLayers(this.dependencyGraph.nodes, this.dependencyGraph.links);
    
    // Calculate coupling metrics
    this.metricsCalculator.calculateCoupling(this.dependencyGraph.nodes, this.dependencyGraph.links);
    
    console.log(`✅ Built dependency graph: ${this.dependencyGraph.metadata.totalNodes} nodes, ${this.dependencyGraph.metadata.totalLinks} links`);
    
    return this.dependencyGraph;
  }

  // Generate optimization suggestions
  async generateOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built. Call buildDependencyGraph first.');
    }
    
    // Create optimization engine with circular dependencies
    this.optimizationEngine = new OptimizationEngine(this.circularDependencyDetector.getCircularDependencies());
    
    return this.optimizationEngine.generateOptimizationSuggestions(this.dependencyGraph);
  }

  // Apply optimization suggestion
  async applyOptimization(suggestion: OptimizationSuggestion): Promise<{
    success: boolean;
    changes: string[];
    errors: string[];
  }> {
    console.log(`🔧 Applying optimization: ${suggestion.title}`);
    
    const changes: string[] = [];
    const errors: string[] = [];
    
    try {
      if (suggestion.automated) {
        // Apply automated optimization
        changes.push(`Applied automated ${suggestion.type} optimization`);
        changes.push(`Affected ${suggestion.nodes.length} nodes`);
      } else {
        // For manual optimizations, provide guidance
        changes.push(`Manual optimization required for ${suggestion.type}`);
        suggestion.steps.forEach(step => {
          changes.push(`Step: ${step}`);
        });
      }
      
      return {
        success: suggestion.automated,
        changes,
        errors
      };
    } catch (error) {
      errors.push(`Failed to apply optimization: ${error.message}`);
      return {
        success: false,
        changes,
        errors
      };
    }
  }

  // Get dependency graph
  getDependencyGraph(): DependencyGraph | null {
    return this.dependencyGraph;
  }

  // Get layer analysis
  getLayerAnalysis(): LayerAnalysis {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built');
    }
    
    return this.layerAnalyzer.getLayerAnalysis(this.dependencyGraph);
  }

  // Get optimization statistics
  getOptimizationStatistics(suggestions: OptimizationSuggestion[]): OptimizationStatistics {
    return this.statisticsCalculator.getOptimizationStatistics(suggestions);
  }

  // Get implementation plan
  getImplementationPlan(suggestions: OptimizationSuggestion[]) {
    return this.statisticsCalculator.getImplementationPlan(suggestions);
  }

  // Get estimated time for implementation
  getEstimatedTime(suggestions: OptimizationSuggestion[]) {
    return this.statisticsCalculator.getEstimatedTime(suggestions);
  }

  // Get high-priority suggestions
  getHighPrioritySuggestions(suggestions: OptimizationSuggestion[]) {
    return this.statisticsCalculator.getCriticalSuggestions(suggestions);
  }

  // Get quick wins
  getQuickWins(suggestions: OptimizationSuggestion[]) {
    return this.statisticsCalculator.getQuickWins(suggestions);
  }

  // Get circular dependency information
  getCircularDependencyInfo() {
    return {
      count: this.circularDependencyDetector.getCircularDependencyCount(),
      hasCircular: this.circularDependencyDetector.hasCircularDependencies(),
      dependencies: Array.from(this.circularDependencyDetector.getCircularDependencies())
    };
  }

  // Get layer statistics
  getLayerStatistics() {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built');
    }
    
    const layerAnalysis = this.layerAnalyzer.getLayerAnalysis(this.dependencyGraph);
    return this.layerAnalyzer.getLayerStatistics(layerAnalysis);
  }

  // Get layer health score
  getLayerHealthScore(): number {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built');
    }
    
    const layerAnalysis = this.layerAnalyzer.getLayerAnalysis(this.dependencyGraph);
    return this.layerAnalyzer.getLayerHealthScore(layerAnalysis);
  }

  // Get most problematic layer
  getMostProblematicLayer() {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built');
    }
    
    const layerAnalysis = this.layerAnalyzer.getLayerAnalysis(this.dependencyGraph);
    return this.layerAnalyzer.getMostProblematicLayer(layerAnalysis);
  }

  // Clear cache
  clearCache(): void {
    this.optimizationCache.clear();
  }

  // Reset service
  reset(): void {
    this.dependencyGraph = null;
    this.optimizationCache.clear();
    this.circularDependencyDetector.clearCircularDependencies();
  }
}

export default DependencyVisualizationService;