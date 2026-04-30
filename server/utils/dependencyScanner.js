const fs = require('fs');
const path = require('path');

class DependencyScanner {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Scan files for dependencies and build a dependency graph
     * @param {Array} files - Array of file objects with path, name, etc.
     * @returns {Object} Dependency graph with nodes and edges
     */
    async scan(files) {
        if (!files || files.length === 0) {
            return { nodes: [], edges: [] };
        }

        const nodes = [];
        const edges = [];
        const nodeMap = new Map();
        const processedFiles = new Set();

        // Create nodes for all files
        for (const file of files) {
            const nodeId = this.generateNodeId(file.path);
            if (!nodeMap.has(nodeId)) {
                const node = {
                    id: nodeId,
                    name: file.name,
                    path: file.path,
                    type: this.getFileType(file.name),
                    extension: this.getExtension(file.name)
                };
                nodes.push(node);
                nodeMap.set(nodeId, node);
            }
        }

        // Scan for dependencies in code files
        for (const file of files) {
            if (this.isCodeFile(file.name)) {
                try {
                    const dependencies = await this.extractDependencies(file.path);
                    
                    for (const dep of dependencies) {
                        const fromNodeId = this.generateNodeId(file.path);
                        const toNodeId = this.findNodeByPath(dep, nodeMap);

                        if (toNodeId && fromNodeId !== toNodeId) {
                            const edgeId = `${fromNodeId}-${toNodeId}`;
                            if (!processedFiles.has(edgeId)) {
                                edges.push({
                                    id: edgeId,
                                    from: fromNodeId,
                                    to: toNodeId,
                                    type: 'import',
                                    weight: 1
                                });
                                processedFiles.add(edgeId);
                            }
                        }
                    }
                } catch (error) {
                    // Skip files that can't be read
                }
            }
        }

        // Add directory nodes
        const directoryMap = new Map();
        for (const file of files) {
            const dirPath = path.dirname(file.path);
            if (!directoryMap.has(dirPath)) {
                const dirName = path.basename(dirPath);
                const dirId = this.generateNodeId(dirPath);
                
                if (!nodeMap.has(dirId)) {
                    const dirNode = {
                        id: dirId,
                        name: dirName,
                        path: dirPath,
                        type: 'directory',
                        extension: null
                    };
                    nodes.push(dirNode);
                    nodeMap.set(dirId, dirNode);
                    directoryMap.set(dirPath, dirId);
                }
            }
        }

        // Add file-to-directory edges
        for (const file of files) {
            const fileId = this.generateNodeId(file.path);
            const dirPath = path.dirname(file.path);
            const dirId = directoryMap.get(dirPath);
            
            if (dirId) {
                const edgeId = `${fileId}-${dirId}`;
                if (!processedFiles.has(edgeId)) {
                    edges.push({
                        id: edgeId,
                        from: fileId,
                        to: dirId,
                        type: 'contains',
                        weight: 1
                    });
                    processedFiles.add(edgeId);
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Extract dependencies from a file
     * @param {string} filePath - Path to the file
     * @returns {Array} Array of dependency paths
     */
    async extractDependencies(filePath) {
        const dependencies = [];
        
        try {
            if (!fs.existsSync(filePath)) {
                return dependencies;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const ext = this.getExtension(filePath);

            switch (ext) {
                case 'js':
                case 'jsx':
                case 'ts':
                case 'tsx':
                case 'mjs':
                case 'cjs':
                    dependencies.push(...this.extractJSDependencies(content, filePath));
                    break;
                case 'py':
                    dependencies.push(...this.extractPythonDependencies(content, filePath));
                    break;
                case 'java':
                    dependencies.push(...this.extractJavaDependencies(content, filePath));
                    break;
                case 'cpp':
                case 'cc':
                case 'cxx':
                case 'h':
                case 'hpp':
                    dependencies.push(...this.extractCppDependencies(content, filePath));
                    break;
                case 'go':
                    dependencies.push(...this.extractGoDependencies(content, filePath));
                    break;
                case 'rs':
                    dependencies.push(...this.extractRustDependencies(content, filePath));
                    break;
            }
        } catch (error) {
            // Return empty array on error
        }

        return dependencies;
    }

    extractJSDependencies(content, filePath) {
        const dependencies = [];
        const dir = path.dirname(filePath);

        // ES6 imports
        const importRegex = /import\s+(?:(?:\{[^}]*\})|(?:\*\s+as\s+\w+)|(?:\w+))\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const dep = this.resolvePath(match[1], dir);
            if (dep) dependencies.push(dep);
        }

        // CommonJS require
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            const dep = this.resolvePath(match[1], dir);
            if (dep) dependencies.push(dep);
        }

        // Dynamic import
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            const dep = this.resolvePath(match[1], dir);
            if (dep) dependencies.push(dep);
        }

        return dependencies;
    }

    extractPythonDependencies(content, filePath) {
        const dependencies = [];
        const dir = path.dirname(filePath);

        // Python imports
        const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const module = match[1] || match[2];
            if (module && !module.startsWith('.')) {
                dependencies.push(module);
            } else if (module && module.startsWith('.')) {
                const dep = this.resolvePythonPath(module, dir);
                if (dep) dependencies.push(dep);
            }
        }

        return dependencies;
    }

    extractJavaDependencies(content, filePath) {
        const dependencies = [];
        const dir = path.dirname(filePath);

        // Java imports
        const importRegex = /import\s+([a-zA-Z0-9_.]+);/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }

        return dependencies;
    }

    extractCppDependencies(content, filePath) {
        const dependencies = [];
        const dir = path.dirname(filePath);

        // C++ includes
        const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
        let match;
        while ((match = includeRegex.exec(content)) !== null) {
            if (!match[1].startsWith('<')) {
                const dep = this.resolvePath(match[1], dir);
                if (dep) dependencies.push(dep);
            }
        }

        return dependencies;
    }

    extractGoDependencies(content, filePath) {
        const dependencies = [];
        const dir = path.dirname(filePath);

        // Go imports
        const importRegex = /import\s+(?:"([^"]+)"|`([^`]+)`)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const dep = match[1] || match[2];
            if (dep) dependencies.push(dep);
        }

        return dependencies;
    }

    extractRustDependencies(content, filePath) {
        const dependencies = [];
        const dir = path.dirname(filePath);

        // Rust use statements
        const useRegex = /use\s+([a-zA-Z0-9_:]+);/g;
        let match;
        while ((match = useRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }

        // Rust mod statements
        const modRegex = /mod\s+([a-zA-Z0-9_]+);/g;
        while ((match = modRegex.exec(content)) !== null) {
            const dep = path.join(dir, match[1] + '.rs');
            dependencies.push(dep);
        }

        return dependencies;
    }

    resolvePath(importPath, baseDir) {
        if (importPath.startsWith('.')) {
            const resolved = path.resolve(baseDir, importPath);
            // Try common extensions
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '/index.js', '/index.ts'];
            for (const ext of extensions) {
                const withExt = resolved + ext;
                if (fs.existsSync(withExt)) {
                    return withExt;
                }
            }
            return resolved;
        }
        return importPath;
    }

    resolvePythonPath(importPath, baseDir) {
        if (importPath.startsWith('.')) {
            const resolved = path.resolve(baseDir, importPath.replace(/\./g, path.sep));
            const withPy = resolved + '.py';
            if (fs.existsSync(withPy)) {
                return withPy;
            }
            const initPy = path.join(resolved, '__init__.py');
            if (fs.existsSync(initPy)) {
                return initPy;
            }
            return resolved;
        }
        return importPath;
    }

    findNodeByPath(depPath, nodeMap) {
        // Try exact match first
        if (nodeMap.has(this.generateNodeId(depPath))) {
            return this.generateNodeId(depPath);
        }

        // Try partial match
        for (const [nodeId, node] of nodeMap) {
            if (node.path === depPath || node.path.endsWith(depPath)) {
                return nodeId;
            }
        }

        return null;
    }

    generateNodeId(filePath) {
        return filePath.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    getFileType(filename) {
        const ext = this.getExtension(filename);
        const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt'];
        const configExtensions = ['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf'];
        const docExtensions = ['md', 'txt', 'rst', 'adoc'];
        const styleExtensions = ['css', 'scss', 'sass', 'less'];
        const markupExtensions = ['html', 'htm', 'xml', 'svg'];

        if (codeExtensions.includes(ext)) return 'code';
        if (configExtensions.includes(ext)) return 'config';
        if (docExtensions.includes(ext)) return 'documentation';
        if (styleExtensions.includes(ext)) return 'style';
        if (markupExtensions.includes(ext)) return 'markup';
        return 'file';
    }

    getExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    isCodeFile(filename) {
        const ext = this.getExtension(filename);
        const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'cpp', 'cc', 'cxx', 'c', 'h', 'hpp', 'go', 'rs', 'rb', 'php', 'swift', 'kt'];
        return codeExtensions.includes(ext);
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = new DependencyScanner();
