import { ref, computed } from "vue";

export interface NetworkNode {
  id: string;
  name: string;
  size: number;
  fileCount?: number;
  type: "folder" | "filetype" | "duplicate" | "file";
  x: number;
  y: number;
  vx: number;
  vy: number;
  level?: number;
  children?: string[];
  connections?: number;
}

export interface NetworkLink {
  source: NetworkNode;
  target: NetworkNode;
  strength: number;
}

export interface NetworkSettings {
  forceStrength: number;
  nodeSize: number;
  linkDistance: number;
  animationSpeed: number;
  showLabels: boolean;
  animateNodes: boolean;
  showConnections: boolean;
  enablePhysics: boolean;
}

export function useNetworkVisualization() {
  // State
  const nodes = ref<NetworkNode[]>([]);
  const links = ref<NetworkLink[]>([]);
  const selectedNode = ref<NetworkNode | null>(null);
  const hoveredNode = ref<NetworkNode | null>(null);
  const isLoading = ref(false);
  const viewMode = ref<"folders" | "types" | "duplicates">("folders");

  const settings = ref<NetworkSettings>({
    forceStrength: 1.0,
    nodeSize: 1.0,
    linkDistance: 100,
    animationSpeed: 50,
    showLabels: true,
    animateNodes: false,
    showConnections: true,
    enablePhysics: true,
  });

  // Generate network data from files
  const generateNetworkData = (files: any[], mode: "folders" | "types" | "duplicates") => {
    const newNodes: NetworkNode[] = [];
    const newLinks: NetworkLink[] = [];
    const nodeMap = new Map<string, NetworkNode>();

    if (mode === "folders") {
      // Group by parent folder
      const folderMap = new Map<string, any>();

      files.forEach((file: any) => {
        const parts = file.path.split(/[\\/]/);
        const parentPath = parts.slice(0, -1).join("/") || "root";

        if (!folderMap.has(parentPath)) {
          const folderNode: NetworkNode = {
            id: parentPath,
            name: parts[parts.length - 2] || "root",
            size: 0,
            fileCount: 0,
            type: "folder",
            x: Math.random() * 800,
            y: Math.random() * 600,
            vx: 0,
            vy: 0,
          };
          folderMap.set(parentPath, folderNode);
          newNodes.push(folderNode);
          nodeMap.set(parentPath, folderNode);
        }

        const folder = folderMap.get(parentPath);
        folder.size += file.size || 0;
        folder.fileCount = (folder.fileCount || 0) + 1;
      });

      // Create parent-child links
      folderMap.forEach((_folder, path) => {
        const parts = path.split("/");
        if (parts.length > 1) {
          const parentPath = parts.slice(0, -1).join("/") || "root";
          if (nodeMap.has(parentPath)) {
            newLinks.push({
              source: nodeMap.get(parentPath)!,
              target: nodeMap.get(path)!,
              strength: 0.5,
            });
          }
        }
      });
    } else if (mode === "types") {
      // Group by file type
      const typeMap = new Map<string, any>();

      files.forEach((file: any) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "no-ext";

        if (!typeMap.has(ext)) {
          const typeNode: NetworkNode = {
            id: ext,
            name: `.${ext}`,
            size: 0,
            fileCount: 0,
            type: "filetype",
            x: Math.random() * 800,
            y: Math.random() * 600,
            vx: 0,
            vy: 0,
          };
          typeMap.set(ext, typeNode);
          newNodes.push(typeNode);
          nodeMap.set(ext, typeNode);
        }

        const type = typeMap.get(ext);
        type.size += file.size || 0;
        type.fileCount = (type.fileCount || 0) + 1;
      });
    } else if (mode === "duplicates") {
      // Show duplicate relationships
      const dupGroups = files.filter((f: any) => f.isDuplicate) || [];

      dupGroups.forEach((group: any, idx: number) => {
        const groupId = `group-${idx}`;
        const groupNode: NetworkNode = {
          id: groupId,
          name: `Duplicate ${idx + 1}`,
          size: group.size || 0,
          fileCount: group.files?.length || 0,
          type: "duplicate",
          x: Math.random() * 800,
          y: Math.random() * 600,
          vx: 0,
          vy: 0,
        };
        newNodes.push(groupNode);
        nodeMap.set(groupId, groupNode);

        // Link files to their duplicate group
        (group.files || []).forEach((file: any) => {
          const fileId = `file-${file.path}`;
          const fileNode: NetworkNode = {
            id: fileId,
            name: file.name,
            size: file.size || 0,
            type: "file",
            x: Math.random() * 800,
            y: Math.random() * 600,
            vx: 0,
            vy: 0,
          };
          newNodes.push(fileNode);
          nodeMap.set(fileId, fileNode);

          newLinks.push({
            source: fileNode,
            target: groupNode,
            strength: 1.0,
          });
        });
      });
    }

    return { nodes: newNodes, links: newLinks };
  };

  // Force simulation
  const updateForces = () => {
    if (nodes.value.length === 0 || !settings.value.enablePhysics) return;

    const currentNodes = [...nodes.value];
    const currentLinks = [...links.value];

    // Repulsion between nodes
    for (let i = 0; i < currentNodes.length; i++) {
      for (let j = i + 1; j < currentNodes.length; j++) {
        const dx = currentNodes[j]!.x - currentNodes[i]!.x;
        const dy = currentNodes[j]!.y - currentNodes[i]!.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (3000 * settings.value.forceStrength) / (dist * dist);

        if (!currentNodes[i]!.vx) currentNodes[i]!.vx = 0;
        if (!currentNodes[i]!.vy) currentNodes[i]!.vy = 0;
        if (!currentNodes[j]!.vx) currentNodes[j]!.vx = 0;
        if (!currentNodes[j]!.vy) currentNodes[j]!.vy = 0;

        currentNodes[i]!.vx -= (dx / dist) * force;
        currentNodes[i]!.vy -= (dy / dist) * force;
        currentNodes[j]!.vx += (dx / dist) * force;
        currentNodes[j]!.vy += (dy / dist) * force;
      }
    }

    // Attraction along links
    currentLinks.forEach((link) => {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDistance = settings.value.linkDistance;
      const force = (dist - idealDistance) * 0.01 * link.strength;

      link.source.vx += (dx / dist) * force;
      link.source.vy += (dy / dist) * force;
      link.target.vx -= (dx / dist) * force;
      link.target.vy -= (dy / dist) * force;
    });

    // Center gravity
    currentNodes.forEach((node) => {
      node.vx += (400 - node.x) * 0.001;
      node.vy += (300 - node.y) * 0.001;

      // Damping
      node.vx *= 0.85;
      node.vy *= 0.85;

      // Update position
      node.x += node.vx * (settings.value.animationSpeed / 50);
      node.y += node.vy * (settings.value.animationSpeed / 50);
    });

    // Update the reactive nodes
    nodes.value = currentNodes;
  };

  // Node color mapping
  const getNodeColor = (type: string): string => {
    const colors = {
      folder: "#3b82f6",
      filetype: "#10b981",
      duplicate: "#ef4444",
      file: "#f59e0b",
    };
    return colors[type as keyof typeof colors] || "#64748b";
  };

  // Utility functions
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const selectNode = (node: NetworkNode | null) => {
    selectedNode.value = node;
  };

  const clearSelection = () => {
    selectedNode.value = null;
    hoveredNode.value = null;
  };

  const resetGraph = () => {
    nodes.value = [];
    links.value = [];
    selectedNode.value = null;
    hoveredNode.value = null;
  };

  const exportNetwork = () => {
    const data = {
      nodes: nodes.value,
      links: links.value.map((link) => ({
        source: link.source.id,
        target: link.target.id,
        strength: link.strength,
      })),
      settings: settings.value,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `network-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Computed properties
  const networkStats = computed(() => {
    const nodeCount = nodes.value.length;
    const linkCount = links.value.length;

    // Calculate connections per node
    const connectionCounts = new Map<string, number>();
    links.value.forEach((link) => {
      connectionCounts.set(link.source.id, (connectionCounts.get(link.source.id) || 0) + 1);
      connectionCounts.set(link.target.id, (connectionCounts.get(link.target.id) || 0) + 1);
    });

    // Most connected node
    let mostConnected = null;
    let maxConnections = 0;
    connectionCounts.forEach((connections, nodeId) => {
      if (connections > maxConnections) {
        maxConnections = connections;
        mostConnected = nodes.value.find((n) => n.id === nodeId) || null;
      }
    });

    // Largest node
    let largestNode = { name: "None", size: 0 };
    if (nodes.value.length > 0) {
      largestNode = nodes.value.reduce(
        (largest, node) => (node.size > largest.size ? node : largest),
        { name: "None", size: 0 }
      );
    }

    return {
      totalNodes: nodeCount,
      totalLinks: linkCount,
      averageConnections: nodeCount > 0 ? (linkCount * 2) / nodeCount : 0,
      mostConnectedNode: mostConnected || { name: "None", connections: 0 },
      largestNode: largestNode,
    };
  });

  return {
    // State
    nodes,
    links,
    selectedNode,
    hoveredNode,
    isLoading,
    viewMode,
    settings,

    // Computed
    networkStats,

    // Methods
    generateNetworkData,
    updateForces,
    getNodeColor,
    formatSize,
    selectNode,
    clearSelection,
    resetGraph,
    exportNetwork,
  };
}
