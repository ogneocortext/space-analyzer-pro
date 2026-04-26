export interface FileNode {
  id: string;
  name: string;
  path: string;
  extension: string;
  size: number;
  type: 'source' | 'config' | 'asset' | 'build' | 'doc';
  dependencies: string[];
  dependents: string[];
  x?: number;
  y?: number;
  z?: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  strength: number;
  type: 'import' | 'include' | 'require' | 'reference';
}

export interface ParsedProject {
  nodes: FileNode[];
  edges: DependencyEdge[];
  stats: {
    totalFiles: number;
    totalDependencies: number;
    mostConnected: string[];
    circularDependencies: string[][];
    averageComplexity?: number;
    complexityDistribution?: {
      simple: number;
      basic: number;
      moderate: number;
      complex: number;
      expert: number;
    };
    highComplexityFiles?: Array<{
      name: string;
      score: number;
      guidance: string;
    }>;
  };
}

// Pattern definitions for future use (kept for documentation purposes)
// These patterns can be used for more sophisticated dependency parsing
const _DEPENDENCY_PATTERNS = {
  javascript: [
    /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
    /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ],
  typescript: [
    /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
    /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\/\s*<reference\s+path\s*=\s*['"`]([^'"`]+)['"`]\s*\/>/g,
  ],
  cpp: [
    /#include\s*[<"]([^>"]+)[>"]/g,
    /#pragma\s+once/g,
  ],
  python: [
    /import\s+([^\s]+)/g,
    /from\s+([^\s]+)\s+import/g,
  ],
};

export class FileDependencyParser {
  private static readonly FILE_TYPES = {
    source: ['.js', '.jsx', '.ts', '.tsx', '.cpp', '.c', '.h', '.hpp', '.py', '.java', '.cs'],
    config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.xml', '.gradle', '.cmake'],
    asset: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.scss', '.less', '.woff', '.woff2', '.ttf'],
    build: ['.exe', '.dll', '.so', '.dylib', '.a', '.lib', '.obj', '.o'],
    doc: ['.md', '.txt', '.rst', '.doc', '.docx', '.pdf'],
  };

  static async parseProject(files: Array<{ name: string; path: string; size: number }>): Promise<ParsedProject> {
    const nodes: FileNode[] = [];
    const edges: DependencyEdge[] = [];
    const pathToId = new Map<string, string>();

    // Create file nodes
    for (const file of files) {
      const extension = this.getExtension(file.name);
      const type = this.getFileType(extension);
      const id = this.generateId(file.path);

      pathToId.set(file.path, id);

      nodes.push({
        id,
        name: file.name,
        path: file.path,
        extension,
        size: file.size,
        type,
        dependencies: [],
        dependents: [],
      });
    }

    // Parse dependencies for each file
    for (const file of files) {
      const fileNode = nodes.find(n => n.path === file.path);
      if (!fileNode) continue;

      const dependencies = await this.extractDependencies(file);
      
      for (const dep of dependencies) {
        const resolvedDep = this.resolveDependency(dep, file.path, files);
        if (resolvedDep) {
          const depId = pathToId.get(resolvedDep);
          if (depId && depId !== fileNode.id) {
            fileNode.dependencies.push(depId);
            
            const edgeType = this.getDependencyType(dep, fileNode.extension);
            edges.push({
              from: fileNode.id,
              to: depId,
              strength: this.calculateStrength(fileNode.id, depId, nodes),
              type: edgeType,
            });
          }
        }
      }
    }

    // Build dependents list
    for (const edge of edges) {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (fromNode && toNode) {
        toNode.dependents.push(edge.from);
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(nodes, edges);

    return { nodes, edges, stats };
  }

  private static async extractDependencies(file: { name: string; path: string; size: number }): Promise<string[]> {
    const extension = this.getExtension(file.name);
    const dependencies: string[] = [];

    // For now, we'll simulate dependency extraction
    // In a real implementation, you'd read the file content
    // For demonstration, we'll create realistic mock dependencies
    
    if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
      // Simulate JS/TS imports
      if (file.name.includes('index') || file.name.includes('App')) {
        dependencies.push('./components/*', './services/*', './utils/*');
      } else if (file.name.includes('component')) {
        dependencies.push('react', '../hooks/*', '../utils/*');
      } else if (file.name.includes('service')) {
        dependencies.push('../types/*', '../config/*');
      }
    } else if (['.cpp', '.c', '.h', '.hpp'].includes(extension)) {
      // Simulate C++ includes
      if (extension === '.h' || extension === '.hpp') {
        dependencies.push('iostream', 'vector', 'string', 'memory');
      } else {
        dependencies.push('./headers/*', '../lib/*');
      }
    }

    return dependencies;
  }

  private static resolveDependency(dep: string, filePath: string, allFiles: Array<{ name: string; path: string; size: number }>): string | null {
    // Remove wildcards and resolve relative paths
    const cleanDep = dep.replace(/\*/g, '').replace('./', '');
    
    // Try to find matching file
    // Note: dir is calculated but not used in current implementation
    // const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    
    for (const file of allFiles) {
      if (file.path.includes(cleanDep) || file.name.includes(cleanDep)) {
        return file.path;
      }
    }
    
    return null;
  }

  private static getDependencyType(dependency: string, fileExtension: string): DependencyEdge['type'] {
    if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExtension)) {
      if (dependency.includes('import')) return 'import';
      if (dependency.includes('require')) return 'require';
      return 'import';
    } else if (['.cpp', '.c', '.h', '.hpp'].includes(fileExtension)) {
      return 'include';
    }
    return 'reference';
  }

  private static calculateStrength(fromId: string, toId: string, nodes: FileNode[]): number {
    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toId);
    
    if (!fromNode || !toNode) return 0.5;
    
    // Calculate strength based on file types and relationship
    let strength = 0.5;
    
    // Same type files have stronger connections
    if (fromNode.type === toNode.type) {
      strength += 0.2;
    }
    
    // Source to source files have stronger connections
    if (fromNode.type === 'source' && toNode.type === 'source') {
      strength += 0.3;
    }
    
    return Math.min(1.0, strength);
  }

  private static calculateStats(nodes: FileNode[], edges: DependencyEdge[]) {
      const connectionCounts = new Map<string, number>();
      
      for (const node of nodes) {
        connectionCounts.set(node.id, node.dependencies.length + node.dependents.length);
      }
      
      const sortedConnections = Array.from(connectionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      const mostConnected = sortedConnections.map(([id]) => {
        const node = nodes.find(n => n.id === id);
        return node?.name || '';
      });
  
      // Detect circular dependencies (simplified)
      const circularDependencies: string[][] = [];
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
  
      const detectCycles = (nodeId: string, path: string[]) => {
        if (recursionStack.has(nodeId)) {
          const cycleStart = path.indexOf(nodeId);
          if (cycleStart !== -1) {
            circularDependencies.push(path.slice(cycleStart));
          }
          return;
        }
        
        if (visited.has(nodeId)) return;
        
        visited.add(nodeId);
        recursionStack.add(nodeId);
        
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          for (const depId of node.dependencies) {
            detectCycles(depId, [...path, nodeId]);
          }
        }
        
        recursionStack.delete(nodeId);
      };
  
      for (const node of nodes) {
        if (!visited.has(node.id)) {
          detectCycles(node.id, []);
        }
      }
  
      // Calculate complexity distribution
      const complexityDistribution = {
        simple: 0,
        basic: 0,
        moderate: 0,
        complex: 0,
        expert: 0,
      };
      
      const highComplexityFiles: Array<{ name: string; score: number; guidance: string }> = [];
      let totalComplexity = 0;
      
      nodes.forEach((node, index) => {
        // Calculate complexity based on file properties
        const sizeComplexity = Math.min(1, node.size / (100 * 1024)); // Normalize by 100KB
        const dependencyComplexity = Math.min(1, (node.dependencies.length + node.dependents.length) / 10);
        const typeComplexity = node.type === 'source' ? 0.3 : node.type === 'build' ? 0.5 : 0.1;
        
        // Use node index for deterministic pseudo-random complexity
        const baseComplexity = (index * 0.1) % 1;
        const complexity = Math.min(1, sizeComplexity * 0.3 + dependencyComplexity * 0.4 + typeComplexity * 0.2 + baseComplexity * 0.1);
        
        totalComplexity += complexity;
        
        // Categorize complexity
        if (complexity < 0.3) {
          complexityDistribution.simple++;
        } else if (complexity < 0.5) {
          complexityDistribution.basic++;
        } else if (complexity < 0.7) {
          complexityDistribution.moderate++;
        } else if (complexity < 0.9) {
          complexityDistribution.complex++;
          highComplexityFiles.push({
            name: node.name,
            score: complexity,
            guidance: this.getComplexityGuidance(complexity, node.name),
          });
        } else {
          complexityDistribution.expert++;
          highComplexityFiles.push({
            name: node.name,
            score: complexity,
            guidance: this.getComplexityGuidance(complexity, node.name),
          });
        }
      });
  
      return {
        totalFiles: nodes.length,
        totalDependencies: edges.length,
        mostConnected,
        circularDependencies,
        averageComplexity: nodes.length > 0 ? totalComplexity / nodes.length : 0,
        complexityDistribution,
        highComplexityFiles: highComplexityFiles.slice(0, 10), // Limit to top 10
      };
    }
    
    private static getComplexityGuidance(score: number, fileName: string): string {
      if (score < 0.3) {
        return `This ${fileName} file is simple and straightforward. You can confidently make changes without risking functionality.`;
      } else if (score < 0.5) {
        return `This ${fileName} file has basic complexity. Review changes before committing to ensure stability.`;
      } else if (score < 0.7) {
        return `This ${fileName} file has moderate complexity. Carefully review changes and consider the impact on dependent files.`;
      } else if (score < 0.9) {
        return `This ${fileName} file is complex. Changes may impact multiple areas. Consider expert review before modifications.`;
      } else {
        return `This ${fileName} file is highly complex. Only experienced developers should modify this file. Consider architectural changes instead.`;
      }
    }

  private static getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
  }

  private static getFileType(extension: string): FileNode['type'] {
    for (const [type, extensions] of Object.entries(this.FILE_TYPES)) {
      if (extensions.includes(extension)) {
        return type as FileNode['type'];
      }
    }
    return 'source'; // Default to source for unknown types
  }

  private static generateId(path: string): string {
    return btoa(path).replace(/[+/=]/g, '').substring(0, 12);
  }
}
