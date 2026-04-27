/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Layer Calculator
// Calculates hierarchical layers for dependency visualization

import { DependencyNode, DependencyLink } from "./interfaces";

export class LayerCalculator {
  calculateLayers(nodes: DependencyNode[], links: DependencyLink[]): void {
    console.warn("📊 Calculating dependency layers...");

    // Find root nodes (no dependencies)
    const rootNodes = nodes.filter((node) => node.dependencies.length === 0);

    // BFS to assign layers
    const queue: { node: DependencyNode; layer: number }[] = rootNodes.map((node) => ({
      node,
      layer: 0,
    }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, layer } = queue.shift()!;

      if (visited.has(node.id)) continue;
      visited.add(node.id);

      node.layer = layer;

      // Add dependents to queue
      for (const depId of node.dependents) {
        const depNode = nodes.find((n) => n.id === depId);
        if (depNode && !visited.has(depId)) {
          queue.push({ node: depNode, layer: layer + 1 });
        }
      }
    }

    // Handle remaining nodes
    nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        node.layer =
          Math.max(
            ...node.dependencies.map((depId) => {
              const depNode = nodes.find((n) => n.id === depId);
              return depNode ? depNode.layer : 0;
            })
          ) + 1;
      }
    });
  }

  getMaxLayer(nodes: DependencyNode[]): number {
    return Math.max(...nodes.map((node) => node.layer));
  }

  getNodesByLayer(nodes: DependencyNode[]): Map<number, DependencyNode[]> {
    const layers = new Map<number, DependencyNode[]>();

    nodes.forEach((node) => {
      if (!layers.has(node.layer)) {
        layers.set(node.layer, []);
      }
      layers.get(node.layer)!.push(node);
    });

    return layers;
  }

  getLayerName(layer: number): string {
    const layerNames = ["Presentation", "Business", "Data", "Infrastructure"];
    return layerNames[layer] || `Layer ${layer}`;
  }
}
