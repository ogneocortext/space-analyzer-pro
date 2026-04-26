// Circular Dependency Detector
// Detects and analyzes circular dependencies in the dependency graph

import { DependencyNode, DependencyLink } from './interfaces';

export class CircularDependencyDetector {
  private circularDependencies: Set<string> = new Set();

  detectCircularDependencies(nodes: DependencyNode[], links: DependencyLink[]): Set<string> {
    console.log('🔄 Detecting circular dependencies...');
    
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found circular dependency
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        const cycleKey = cycle.join('->');
        
        this.circularDependencies.add(cycleKey);
        
        // Mark nodes as circular
        cycle.forEach(id => {
          const node = nodes.find(n => n.id === id);
          if (node) node.circular = true;
        });
        
        // Mark links as circular
        for (let i = 0; i < cycle.length; i++) {
          const source = cycle[i];
          const target = cycle[(i + 1) % cycle.length];
          const link = links.find(l => l.source === source && l.target === target);
          if (link) link.circular = true;
        }
        
        return true;
      }
      
      if (visited.has(nodeId)) return false;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (dfs(depId, [...path, nodeId])) {
            return true;
          }
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    });
    
    console.log(`🔄 Detected ${this.circularDependencies.size} circular dependencies`);
    return this.circularDependencies;
  }

  getCircularDependencies(): Set<string> {
    return this.circularDependencies;
  }

  getCircularDependencyCount(): number {
    return this.circularDependencies.size;
  }

  hasCircularDependencies(): boolean {
    return this.circularDependencies.size > 0;
  }

  clearCircularDependencies(): void {
    this.circularDependencies.clear();
  }
}