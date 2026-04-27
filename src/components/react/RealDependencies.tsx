import React, { useState, useMemo, useCallback } from "react";
import {
  GitBranch,
  Package,
  FileText,
  Network,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Info,
  ArrowRight,
  Folder,
  Code,
  ExternalLink,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Zap,
  X,
} from "lucide-react";
import { AnalysisResult } from "../services/AnalysisBridge";

interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  extension?: string;
  category: string;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: string;
}

export const RealDependencies: React.FC<{ analysisData: AnalysisResult }> = ({ analysisData }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "list" | "tree">("graph");

  const dependencyGraph = analysisData?.dependencyGraph;
  const nodes = dependencyGraph?.nodes || [];
  const edges = dependencyGraph?.edges || [];

  // Analyze dependencies
  const dependencyAnalysis = useMemo(() => {
    if (!nodes.length) {
      return {
        totalNodes: 0,
        totalEdges: 0,
        nodeTypes: {} as Record<string, number>,
        edgeTypes: {} as Record<string, number>,
        mostConnected: [] as Array<{ id: string; name: string; connections: number }>,
        isolatedNodes: [] as DependencyNode[],
        circularDependencies: [] as Array<{ from: string; to: string }>,
      };
    }

    // Count node types
    const nodeTypes: Record<string, number> = {};
    nodes.forEach((node) => {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    });

    // Count edge types
    const edgeTypes: Record<string, number> = {};
    edges.forEach((edge) => {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    });

    // Find most connected nodes
    const connectionCount: Record<string, number> = {};
    edges.forEach((edge) => {
      connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
      connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    });

    const mostConnected = Object.entries(connectionCount)
      .map(([id, connections]) => {
        const node = nodes.find((n) => n.id === id);
        return {
          id,
          name: node?.name || id,
          connections,
        };
      })
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);

    // Find isolated nodes (no connections)
    const connectedIds = new Set(edges.flatMap((e) => [e.from, e.to]));
    const isolatedNodes = nodes.filter((n) => !connectedIds.has(n.id));

    // Find potential circular dependencies
    const circularDependencies: Array<{ from: string; to: string }> = [];
    const edgeMap = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!edgeMap.has(edge.from)) {
        edgeMap.set(edge.from, []);
      }
      edgeMap.get(edge.from)!.push(edge.to);
    });

    // Simple circular dependency detection
    edges.forEach((edge) => {
      const targets = edgeMap.get(edge.to) || [];
      if (targets.includes(edge.from)) {
        circularDependencies.push({ from: edge.from, to: edge.to });
      }
    });

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes,
      edgeTypes,
      mostConnected,
      isolatedNodes,
      circularDependencies,
    };
  }, [nodes, edges]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesSearch =
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === "all" || node.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [nodes, searchQuery, selectedType]);

  // Get connections for selected node
  const nodeConnections = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };

    const incoming = edges.filter((e) => e.to === selectedNode);
    const outgoing = edges.filter((e) => e.from === selectedNode);

    return { incoming, outgoing };
  }, [selectedNode, edges]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "directory":
        return <Folder size={16} className="text-yellow-400" />;
      case "file":
        return <FileText size={16} className="text-blue-400" />;
      default:
        return <Code size={16} className="text-purple-400" />;
    }
  };

  const getEdgeTypeColor = (type: string) => {
    switch (type) {
      case "import":
        return "text-cyan-400";
      case "require":
        return "text-purple-400";
      case "extends":
        return "text-green-400";
      case "call":
        return "text-orange-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <GitBranch className="w-8 h-8 text-cyan-400" />
          Dependencies
        </h1>
        <p className="text-slate-400 text-lg">Module analysis and dependency graph visualization</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-semibold">Total Nodes</h3>
          </div>
          <div className="text-3xl font-bold text-cyan-400 mb-2">
            {dependencyAnalysis.totalNodes}
          </div>
          <div className="text-slate-400 text-sm">Files and directories</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <GitBranch className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold">Total Edges</h3>
          </div>
          <div className="text-3xl font-bold text-purple-400 mb-2">
            {dependencyAnalysis.totalEdges}
          </div>
          <div className="text-slate-400 text-sm">Dependency connections</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold">Circular Deps</h3>
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">
            {dependencyAnalysis.circularDependencies.length}
          </div>
          <div className="text-slate-400 text-sm">Potential issues</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Package className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold">Isolated</h3>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">
            {dependencyAnalysis.isolatedNodes.length}
          </div>
          <div className="text-slate-400 text-sm">No connections</div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
              >
                <option value="all">All Types</option>
                {Object.keys(dependencyAnalysis.nodeTypes).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === "graph"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              <Network size={16} />
              Graph
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              <FileText size={16} />
              List
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === "tree"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              <GitBranch size={16} />
              Tree
            </button>
          </div>
        </div>
      </div>

      {/* Most Connected Nodes */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Most Connected Nodes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {dependencyAnalysis.mostConnected.map((node, index) => (
            <div
              key={node.id}
              className="bg-slate-700/50 rounded-lg p-4 cursor-pointer hover:bg-slate-600/50 transition-colors"
              onClick={() => setSelectedNode(node.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 text-xs font-bold">
                  {index + 1}
                </div>
                <div className="text-white font-medium text-sm truncate">{node.name}</div>
              </div>
              <div className="text-cyan-400 text-lg font-bold">{node.connections}</div>
              <div className="text-slate-400 text-xs">connections</div>
            </div>
          ))}
        </div>
      </div>

      {/* Node List View */}
      {viewMode === "list" && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            All Nodes ({filteredNodes.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredNodes.map((node) => (
              <div
                key={node.id}
                className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-600/50 transition-colors"
                onClick={() => setSelectedNode(node.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getTypeIcon(node.type)}
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">{node.name}</div>
                    <div className="text-slate-400 text-xs truncate">{node.path}</div>
                  </div>
                </div>
                <div className="text-slate-400 text-xs">{formatBytes(node.size)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Info className="w-5 h-5 text-cyan-400" />
              Node Details
            </h2>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {(() => {
            const node = nodes.find((n) => n.id === selectedNode);
            if (!node) return null;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Name</div>
                    <div className="text-white font-medium">{node.name}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Type</div>
                    <div className="text-white font-medium flex items-center gap-2">
                      {getTypeIcon(node.type)}
                      {node.type}
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Size</div>
                    <div className="text-white font-medium">{formatBytes(node.size)}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Extension</div>
                    <div className="text-white font-medium">{node.extension || "N/A"}</div>
                  </div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-slate-400 text-sm mb-1">Path</div>
                  <div className="text-white font-mono text-sm break-all">{node.path}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                      <ArrowRight size={16} className="text-green-400" />
                      Outgoing ({nodeConnections.outgoing.length})
                    </h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {nodeConnections.outgoing.map((edge, index) => {
                        const targetNode = nodes.find((n) => n.id === edge.to);
                        return (
                          <div key={index} className="p-2 bg-slate-600/50 rounded text-sm">
                            <span className={getEdgeTypeColor(edge.type)}>{edge.type}</span>
                            <span className="text-white ml-2">→ {targetNode?.name || edge.to}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                      <ArrowRight size={16} className="rotate-180 text-blue-400" />
                      Incoming ({nodeConnections.incoming.length})
                    </h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {nodeConnections.incoming.map((edge, index) => {
                        const sourceNode = nodes.find((n) => n.id === edge.from);
                        return (
                          <div key={index} className="p-2 bg-slate-600/50 rounded text-sm">
                            <span className="text-white">{sourceNode?.name || edge.from}</span>
                            <span className="text-slate-400 ml-2">→</span>
                            <span className={getEdgeTypeColor(edge.type)}>{edge.type}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Circular Dependencies Warning */}
      {dependencyAnalysis.circularDependencies.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-5 h-5" />
            Circular Dependencies Detected
          </h2>
          <div className="space-y-2">
            {dependencyAnalysis.circularDependencies.map((dep, index) => {
              const fromNode = nodes.find((n) => n.id === dep.from);
              const toNode = nodes.find((n) => n.id === dep.to);
              return (
                <div
                  key={index}
                  className="p-3 bg-orange-500/10 rounded-lg flex items-center gap-2"
                >
                  <span className="text-white">{fromNode?.name || dep.from}</span>
                  <ArrowRight size={16} className="text-orange-400" />
                  <span className="text-white">{toNode?.name || dep.to}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Node Types Distribution */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-cyan-400" />
          Node Types Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(dependencyAnalysis.nodeTypes).map(([type, count]) => (
            <div key={type} className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {getTypeIcon(type)}
                <span className="text-white font-medium capitalize">{type}</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400">{count}</div>
              <div className="text-slate-400 text-sm">nodes</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
