import React, { useEffect, useRef, useState, FC } from 'react';
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  Search, 
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  GitBranch,
  FileText,
  Code,
  Database,
  Globe,
  Layers,
  ArrowRight
} from 'lucide-react';
// @ts-ignore - d3 module
import * as d3 from 'd3';
// @ts-ignore - DependencyCheckerService module
import { dependencyCheckerService } from '../services/DependencyCheckerService';
import './CodeMapVisualization.css';

interface CodeMapVisualizationProps {
  files: any[];
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  width?: number;
  height?: number;
}

interface CodeMapNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'export';
  filePath: string;
  group: string;
  size: number;
  color: string;
  issues: {
    unusedImports: number;
    missingImports: number;
    circularDependencies: number;
    deadCode: number;
  };
}

interface CodeMapLink extends d3.SimulationLinkDatum {
  source: string;
  target: string;
  type: 'import' | 'export' | 'call' | 'reference';
  strength: 'strong' | 'medium' | 'weak';
  color: string;
}

interface CodeMapData {
  nodes: CodeMapNode[];
  links: CodeMapLink[];
}

export const CodeMapVisualization: FC<CodeMapVisualizationProps> = ({
  files,
  selectedFile,
  onFileSelect,
  width = 800,
  height = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<CodeMapData>({ nodes: [], links: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'issues' | 'connections'>('all');
  const [selectedNode, setSelectedNode] = useState<CodeMapNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalIssues: 0,
    circularDependencies: 0,
    unusedImports: 0,
    deadCode: 0
  });

  // Process files and build code map data
  useEffect(() => {
    const processData = async () => {
      setLoading(true);
      
      try {
        const codeFiles = files.filter(f => 
          f.path.endsWith('.js') || f.path.endsWith('.jsx') || 
          f.path.endsWith('.ts') || f.path.endsWith('.tsx') || 
          f.path.endsWith('.py')
        );

        const analyses = await dependencyCheckerService.getAllCodeAnalyses(codeFiles);
        const nodes: CodeMapNode[] = [];
        const links: CodeMapLink[] = [];
        
        let totalIssues = 0;
        let totalCircularDependencies = 0;
        let totalUnusedImports = 0;
        let totalDeadCode = 0;

        // Create nodes for each file
        for (const [filePath, analysis] of analyses) {
          const fileIssues = {
            unusedImports: analysis.unusedImports.length,
            missingImports: analysis.missingImports.length,
            circularDependencies: analysis.circularDependencies.length,
            deadCode: analysis.deadCode.length
          };

          totalIssues += Object.values(fileIssues).reduce((sum, count) => sum + count, 0);
          totalCircularDependencies += fileIssues.circularDependencies;
          totalUnusedImports += fileIssues.unusedImports;
          totalDeadCode += fileIssues.deadCode;

          // Main file node
          nodes.push({
            id: filePath,
            name: filePath.split(/[/\\]/).pop() || '',
            type: 'file',
            filePath,
            group: 'files',
            size: 20,
            color: getNodeColor('file', fileIssues),
            issues: fileIssues
          });

          // Function nodes
          for (const func of analysis.functions) {
            nodes.push({
              id: `${filePath}::${func.name}`,
              name: func.name,
              type: 'function',
              filePath,
              group: 'functions',
              size: 10,
              color: getNodeColor('function', { isUsed: func.isUsed, isExported: func.isExported }),
              issues: { unusedImports: 0, missingImports: 0, circularDependencies: 0, deadCode: func.isUsed ? 0 : 1 }
            });
          }

          // Class nodes
          for (const cls of analysis.classes) {
            nodes.push({
              id: `${filePath}::${cls.name}`,
              name: cls.name,
              type: 'class',
              filePath,
              group: 'classes',
              size: 15,
              color: getNodeColor('class', { isUsed: cls.isUsed, isExported: cls.isExported }),
              issues: { unusedImports: 0, missingImports: 0, circularDependencies: 0, deadCode: cls.isUsed ? 0 : 1 }
            });
          }
        }

        // Create links based on imports and dependencies
        for (const [filePath, analysis] of analyses) {
          // Import links
          for (const imp of analysis.imports) {
            const targetNode = nodes.find(node => 
              node.name === imp.source || node.id.includes(imp.source)
            );
            
            if (targetNode) {
              links.push({
                source: filePath,
                target: targetNode.id,
                type: 'import',
                strength: imp.isUsed ? 'strong' : 'weak',
                color: imp.isUsed ? '#10b981' : '#6b7280'
              });
            }
          }

          // Function call links (simplified)
          for (const func of analysis.functions) {
            // This would need more sophisticated analysis to find actual calls
            // For now, we'll create some example links
            if (func.name.includes('fetch') || func.name.includes('api')) {
              const apiNodes = nodes.filter(node => 
                node.type === 'function' && 
                node.name !== func.name &&
                (node.name.includes('api') || node.name.includes('fetch'))
              );
              
              for (const apiNode of apiNodes) {
                links.push({
                  source: `${filePath}::${func.name}`,
                  target: apiNode.id,
                  type: 'call',
                  strength: 'medium',
                  color: '#3b82f6'
                });
              }
            }
          }
        }

        setData({ nodes, links });
        setStats({
          totalFiles: codeFiles.length,
          totalIssues,
          circularDependencies: totalCircularDependencies,
          unusedImports: totalUnusedImports,
          deadCode: totalDeadCode
        });

      } catch (error) {
        console.error('Failed to process code map data:', error);
      } finally {
        setLoading(false);
      }
    };

    processData();
  }, [files]);

  // D3.js visualization
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create simulation
    const simulation = d3.forceSimulation<CodeMapNode>(data.nodes)
      .forceLink(d3.forceLink<CodeMapLink, CodeMapNode>(data.links)
        .id(d => d.id)
        .distance(100)
        .strength(0.5))
      .forceCharge(d3.forceManyBody().strength(-300))
      .forceCenter(d3.forceCenter(width / 2, height / 2))
      .forceCollision(d3.forceCollide().radius(d => d.size + 5));

    // Create links
    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.strength === 'strong' ? 2 : d.strength === 'medium' ? 1.5 : 1)
      .attr('stroke-opacity', 0.6);

    // Create nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, CodeMapNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) {
            d.fx = null;
            d.fy = null;
          }
        }));

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
        if (onFileSelect && d.type === 'file') {
          onFileSelect(d.filePath);
        }
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.size * 1.2);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.size);
      });

    // Add labels
    node.append('text')
      // @ts-ignore - d3 callback type
      .text(d => d.name.length > 15 ? d.name.substring(0, 12) + '...' : d.name)
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('text-anchor', 'middle')
      // @ts-ignore - d3 callback type
      .attr('dy', d.size + 15)
      .attr('fill', '#374151')
      .style('pointer-events', 'none');

    // Add issue indicators
    node.append('g')
      // @ts-ignore - d3 callback type
      .filter(d => Object.values(d.issues).some(count => count > 0))
      .append('circle')
      .attr('r', 4)
      .attr('cx', d => d.size - 4)
      .attr('cy', d => -d.size + 4)
      .attr('fill', '#ef4444')
      .style('pointer-events', 'none');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };

  }, [data, width, height]);

  // Helper function to get node color
  const getNodeColor = (type: string, metadata?: any): string => {
    switch (type) {
      case 'file':
        return metadata?.issues?.unusedImports > 0 ? '#ef4444' : '#3b82f6';
      case 'function':
        return metadata?.isUsed ? '#10b981' : metadata?.isExported ? '#f59e0b' : '#6b7280';
      case 'class':
        return metadata?.isUsed ? '#10b981' : metadata?.isExported ? '#f59e0b' : '#6b7280';
      case 'variable':
        return '#8b5cf6';
      case 'import':
        return '#06b6d4';
      case 'export':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  // Filter data based on search and filter type
  const filteredData = React.useMemo(() => {
    let filteredNodes = [...data.nodes];
    let filteredLinks = [...data.links];

    // Apply search filter
    if (searchTerm) {
      filteredNodes = filteredNodes.filter(node =>
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.filePath.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link =>
        nodeIds.has(link.source) && nodeIds.has(link.target)
      );
    }

    // Apply type filter
    if (filterType === 'issues') {
      filteredNodes = filteredNodes.filter(node =>
        Object.values(node.issues).some(count => count > 0)
      );
      
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link =>
        nodeIds.has(link.source) && nodeIds.has(link.target)
      );
    } else if (filterType === 'connections') {
      // Show only nodes with connections
      const connectedNodeIds = new Set(
        filteredLinks.flatMap(link => [link.source, link.target])
      );
      filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
    }

    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, searchTerm, filterType]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleExport = () => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'code-map.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="code-map-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing code dependencies...</p>
      </div>
    );
  }

  return (
    <div className="code-map-visualization">
      {/* Header */}
      <div className="code-map-header">
        <div className="header-left">
          <h3 className="code-map-title">
            <Network className="title-icon" size={20} />
            Interactive Code Map
          </h3>
          <div className="code-map-stats">
            <div className="stat">
              <span className="stat-label">Files</span>
              <span className="stat-value">{stats.totalFiles}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Issues</span>
              <span className="stat-value">{stats.totalIssues}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Circular</span>
              <span className="stat-value">{stats.circularDependencies}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Unused</span>
              <span className="stat-value">{stats.unusedImports}</span>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          {/* Search */}
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search files, functions, classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Items</option>
            <option value="issues">Issues Only</option>
            <option value="connections">Connections Only</option>
          </select>
          
          {/* Zoom controls */}
          <div className="zoom-controls">
            <button
              onClick={handleZoomOut}
              className="zoom-btn"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleResetZoom}
              className="zoom-btn"
              title="Reset zoom"
            >
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            </button>
            <button
              onClick={handleZoomIn}
              className="zoom-btn"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          
          {/* Export */}
          <button
            onClick={handleExport}
            className="export-btn"
            title="Export as SVG"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Visualization */}
      <div className="code-map-container" style={{ width, height }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
      </div>

      {/* Legend */}
      <div className="code-map-legend">
        <h4 className="legend-title">Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>File (No Issues)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
            <span>File (Has Issues)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
            <span>Used Function/Class</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>Exported (Unused)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#6b7280' }}></div>
            <span>Unused Code</span>
          </div>
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="node-details">
          <div className="details-header">
            <h4 className="details-title">
              {selectedNode.type === 'file' ? (
                <FileText size={16} />
              ) : selectedNode.type === 'function' ? (
                <Code size={16} />
              ) : (
                <Database size={16} />
              )}
              {selectedNode.name}
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="close-btn"
            >
              ×
            </button>
          </div>
          
          <div className="details-content">
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{selectedNode.type}</span>
            </div>
            
            {selectedNode.type === 'file' && (
              <div className="detail-row">
                <span className="detail-label">Path:</span>
                <span className="detail-value">{selectedNode.filePath}</span>
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-label">Issues:</span>
              <div className="issues-list">
                {selectedNode.issues.unusedImports > 0 && (
                  <div className="issue-item">
                    <AlertTriangle size={12} className="issue-icon" />
                    <span>{selectedNode.issues.unusedImports} unused imports</span>
                  </div>
                )}
                {selectedNode.issues.missingImports > 0 && (
                  <div className="issue-item">
                    <XCircle size={12} className="issue-icon" />
                    <span>{selectedNode.issues.missingImports} missing imports</span>
                  </div>
                )}
                {selectedNode.issues.circularDependencies > 0 && (
                  <div className="issue-item">
                    <GitBranch size={12} className="issue-icon" />
                    <span>{selectedNode.issues.circularDependencies} circular dependencies</span>
                  </div>
                )}
                {selectedNode.issues.deadCode > 0 && (
                  <div className="issue-item">
                    <Info size={12} className="issue-icon" />
                    <span>{selectedNode.issues.deadCode} dead code segments</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};