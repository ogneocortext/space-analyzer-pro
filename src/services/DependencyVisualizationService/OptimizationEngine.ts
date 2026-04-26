// Optimization Engine
// Generates optimization suggestions for dependency graph improvements

import { DependencyNode, DependencyLink, DependencyGraph, OptimizationSuggestion, LayerAnalysis } from './interfaces';

export class OptimizationEngine {
  private circularDependencies: Set<string> = new Set();

  constructor(circularDependencies: Set<string>) {
    this.circularDependencies = circularDependencies;
  }

  generateOptimizationSuggestions(graph: DependencyGraph): OptimizationSuggestion[] {
    console.log('🔧 Generating optimization suggestions...');
    
    const suggestions: OptimizationSuggestion[] = [];
    
    // Check for unused dependencies
    suggestions.push(...this.findUnusedDependencies(graph));
    
    // Check for modules that can be merged
    suggestions.push(...this.findMergeableModules(graph));
    
    // Check for large modules that should be split
    suggestions.push(...this.findSplittableModules(graph));
    
    // Check for high coupling
    suggestions.push(...this.findHighCouplingModules(graph));
    
    // Check for circular dependencies
    suggestions.push(...this.findCircularDependencySolutions());
    
    // Check for layer violations
    suggestions.push(...this.findLayerViolations(graph));
    
    // Check for external dependency optimization
    suggestions.push(...this.findExternalDependencyOptimizations(graph));
    
    // Sort by impact
    suggestions.sort((a, b) => {
      const impactA = a.impact.complexityReduction + a.impact.maintainabilityImprovement + a.impact.sizeReduction;
      const impactB = b.impact.complexityReduction + b.impact.maintainabilityImprovement + b.impact.sizeReduction;
      return impactB - impactA;
    });
    
    console.log(`✅ Generated ${suggestions.length} optimization suggestions`);
    
    return suggestions;
  }

  private findUnusedDependencies(graph: DependencyGraph): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    graph.nodes.forEach(node => {
      const unusedDeps = node.dependencies.filter(depId => {
        const depNode = graph.nodes.find(n => n.id === depId);
        return depNode && depNode.dependents.length === 1; // Only this node depends on it
      });
      
      if (unusedDeps.length > 0) {
        suggestions.push({
          id: `unused-deps-${node.id}`,
          type: 'remove-unused',
          title: 'Remove Unused Dependencies',
          description: `Node ${node.name} has ${unusedDeps.length} unused dependencies`,
          impact: {
            complexityReduction: unusedDeps.length * 0.1,
            maintainabilityImprovement: unusedDeps.length * 0.2,
            sizeReduction: unusedDeps.length * 50,
            couplingReduction: unusedDeps.length * 0.15
          },
          effort: 'low',
          risk: 'low',
          nodes: [node.id, ...unusedDeps],
          beforeState: { dependencies: node.dependencies },
          afterState: { dependencies: node.dependencies.filter(d => !unusedDeps.includes(d)) },
          automated: true,
          steps: [
            `Remove unused imports from ${node.name}`,
            'Run tests to ensure no breaking changes',
            'Update documentation if needed'
          ]
        });
      }
    });
    
    return suggestions;
  }

  private findMergeableModules(graph: DependencyGraph): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // Find nodes with high cohesion and similar functionality
    const nodesByType = new Map<string, DependencyNode[]>();
    
    graph.nodes.forEach(node => {
      const type = this.getNodeCategory(node);
      if (!nodesByType.has(type)) {
        nodesByType.set(type, []);
      }
      nodesByType.get(type)!.push(node);
    });
    
    nodesByType.forEach(nodes => {
      if (nodes.length >= 2) {
        // Check if these nodes can be merged
        const totalComplexity = nodes.reduce((sum, n) => sum + n.complexity, 0);
        const avgComplexity = totalComplexity / nodes.length;
        
        if (avgComplexity < 10 && totalComplexity < 20) {
          suggestions.push({
            id: `merge-${nodes.map(n => n.id).join('-')}`,
            type: 'merge-modules',
            title: 'Merge Related Modules',
            description: `Merge ${nodes.length} related modules: ${nodes.map(n => n.name).join(', ')}`,
            impact: {
              complexityReduction: nodes.length * 0.2,
              maintainabilityImprovement: nodes.length * 0.3,
              sizeReduction: nodes.length * 100,
              couplingReduction: nodes.length * 0.1
            },
            effort: 'medium',
            risk: 'medium',
            nodes: nodes.map(n => n.id),
            beforeState: { modules: nodes.length },
            afterState: { modules: 1 },
            automated: false,
            steps: [
              'Analyze shared functionality between modules',
              'Create merged module with combined functionality',
              'Update all import statements',
              'Run comprehensive tests',
              'Update documentation'
            ]
          });
        }
      }
    });
    
    return suggestions;
  }

  private findSplittableModules(graph: DependencyGraph): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    graph.nodes.forEach(node => {
      if (node.complexity > 20 || node.size > 5000) {
        suggestions.push({
          id: `split-${node.id}`,
          type: 'split-large',
          title: 'Split Large Module',
          description: `Module ${node.name} is too large (complexity: ${node.complexity}, size: ${node.size})`,
          impact: {
            complexityReduction: 0.4,
            maintainabilityImprovement: 0.5,
            sizeReduction: 0,
            couplingReduction: 0.2
          },
          effort: 'high',
          risk: 'high',
          nodes: [node.id],
          beforeState: { complexity: node.complexity, size: node.size },
          afterState: { complexity: node.complexity * 0.6, size: node.size * 0.8 },
          automated: false,
          steps: [
            'Analyze module responsibilities',
            'Identify logical groupings',
            'Create separate modules',
            'Update imports and exports',
            'Run integration tests',
            'Update documentation'
          ]
        });
      }
    });
    
    return suggestions;
  }

  private findHighCouplingModules(graph: DependencyGraph): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    graph.nodes.forEach(node => {
      if (node.metrics.coupling > 0.7) {
        suggestions.push({
          id: `reduce-coupling-${node.id}`,
          type: 'reduce-coupling',
          title: 'Reduce High Coupling',
          description: `Module ${node.name} has high coupling (${(node.metrics.coupling * 100).toFixed(1)}%)`,
          impact: {
            complexityReduction: 0.3,
            maintainabilityImprovement: 0.4,
            sizeReduction: 0,
            couplingReduction: 0.5
          },
          effort: 'medium',
          risk: 'medium',
          nodes: [node.id],
          beforeState: { coupling: node.metrics.coupling },
          afterState: { coupling: node.metrics.coupling * 0.5 },
          automated: false,
          steps: [
            'Analyze dependency relationships',
            'Identify abstraction opportunities',
            'Implement dependency injection',
            'Create interfaces for loose coupling',
            'Refactor to use design patterns',
            'Run tests to ensure functionality'
          ]
        });
      }
    });
    
    return suggestions;
  }

  private findCircularDependencySolutions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    this.circularDependencies.forEach(cycle => {
      const nodes = cycle.split('->');
      suggestions.push({
        id: `circular-${nodes.join('-')}`,
        type: 'eliminate-circular',
        title: 'Eliminate Circular Dependency',
        description: `Circular dependency detected: ${cycle}`,
        impact: {
          complexityReduction: 0.5,
          maintainabilityImprovement: 0.6,
          sizeReduction: 0,
          couplingReduction: 0.7
        },
        effort: 'high',
        risk: 'high',
        nodes,
        beforeState: { circular: true },
        afterState: { circular: false },
        automated: false,
        steps: [
          'Analyze the circular dependency',
          'Identify the dependency that can be inverted',
          'Create abstraction layer',
          'Implement dependency inversion',
          'Update imports',
          'Test thoroughly'
        ]
      });
    });
    
    return suggestions;
  }

  private findLayerViolations(graph: DependencyGraph): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    graph.links.forEach(link => {
      const sourceNode = graph.nodes.find(n => n.id === link.source);
      const targetNode = graph.nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode && sourceNode.layer > targetNode.layer) {
        suggestions.push({
          id: `layer-violation-${link.source}-${link.target}`,
          type: 'layer-violation',
          title: 'Fix Layer Violation',
          description: `Layer violation: ${sourceNode.name} (layer ${sourceNode.layer}) depends on ${targetNode.name} (layer ${targetNode.layer})`,
          impact: {
            complexityReduction: 0.2,
            maintainabilityImprovement: 0.3,
            sizeReduction: 0,
            couplingReduction: 0.3
          },
          effort: 'medium',
          risk: 'medium',
          nodes: [link.source, link.target],
          beforeState: { violation: true },
          afterState: { violation: false },
          automated: false,
          steps: [
            'Analyze the layer violation',
            'Determine if dependency is necessary',
            'Create interface in appropriate layer',
            'Update dependency to use interface',
            'Test the changes'
          ]
        });
      }
    });
    
    return suggestions;
  }

  private findExternalDependencyOptimizations(graph: DependencyGraph): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    const externalNodes = graph.nodes.filter(node => node.type === 'external');
    
    // Group external dependencies by package
    const packageGroups = new Map<string, DependencyNode[]>();
    
    externalNodes.forEach(node => {
      const packageName = this.extractPackageName(node.name);
      if (!packageGroups.has(packageName)) {
        packageGroups.set(packageName, []);
      }
      packageGroups.get(packageName)!.push(node);
    });
    
    packageGroups.forEach((nodes, packageName) => {
      if (nodes.length > 1) {
        suggestions.push({
          id: `external-${packageName}`,
          type: 'external-dependency',
          title: 'Optimize External Dependencies',
          description: `Package ${packageName} is used in ${nodes.length} places`,
          impact: {
            complexityReduction: nodes.length * 0.1,
            maintainabilityImprovement: nodes.length * 0.1,
            sizeReduction: nodes.length * 20,
            couplingReduction: nodes.length * 0.05
          },
          effort: 'low',
          risk: 'low',
          nodes: nodes.map(n => n.id),
          beforeState: { usages: nodes.length },
          afterState: { usages: 1 },
          automated: true,
          steps: [
            'Consolidate external dependency usage',
            'Create wrapper module if needed',
            'Update all import statements',
            'Test functionality'
          ]
        });
      }
    });
    
    return suggestions;
  }

  private getNodeCategory(node: DependencyNode): string {
    if (node.path.includes('service')) return 'service';
    if (node.path.includes('component')) return 'component';
    if (node.path.includes('util')) return 'utility';
    if (node.path.includes('helper')) return 'helper';
    if (node.path.includes('config')) return 'config';
    return 'other';
  }

  private extractPackageName(name: string): string {
    return name.split('/')[0];
  }
}