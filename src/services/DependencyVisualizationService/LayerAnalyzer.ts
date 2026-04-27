/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Layer Analyzer
// Analyzes layer violations and provides layer-based insights

import { DependencyNode, DependencyLink, DependencyGraph, LayerAnalysis } from "./interfaces";

export class LayerAnalyzer {
  getLayerAnalysis(graph: DependencyGraph): LayerAnalysis {
    if (!graph) {
      throw new Error("Dependency graph not built");
    }

    const layers: { [key: number]: string[] } = {};

    graph.nodes.forEach((node) => {
      if (!layers[node.layer]) {
        layers[node.layer] = [];
      }
      layers[node.layer].push(node.id);
    });

    const layerArray = Object.entries(layers).map(([layer, nodes]) => ({
      layer: parseInt(layer),
      name: this.getLayerName(parseInt(layer)),
      nodes,
      violations: [],
    }));

    const violations = graph.links
      .filter((link) => {
        const sourceNode = graph.nodes.find((n) => n.id === link.source);
        const targetNode = graph.nodes.find((n) => n.id === link.target);
        return sourceNode && targetNode && sourceNode.layer > targetNode.layer;
      })
      .map((link) => {
        const sourceNode = graph.nodes.find((n) => n.id === link.source)!;
        const targetNode = graph.nodes.find((n) => n.id === link.target)!;

        return {
          source: link.source,
          target: link.target,
          sourceLayer: sourceNode.layer,
          targetLayer: targetNode.layer,
          violation:
            sourceNode.layer > targetNode.layer ? ("downward" as const) : ("upward" as const),
        };
      });

    return {
      layers: layerArray,
      violations,
    };
  }

  getLayerName(layer: number): string {
    const layerNames = ["Presentation", "Business", "Data", "Infrastructure"];
    return layerNames[layer] || `Layer ${layer}`;
  }

  getLayerStatistics(layerAnalysis: LayerAnalysis): {
    totalLayers: number;
    totalViolations: number;
    violationsByType: { [key: string]: number };
    nodesPerLayer: { [key: number]: number };
  } {
    return {
      totalLayers: layerAnalysis.layers.length,
      totalViolations: layerAnalysis.violations.length,
      violationsByType: layerAnalysis.violations.reduce(
        (acc, v) => {
          acc[v.violation] = (acc[v.violation] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number }
      ),
      nodesPerLayer: layerAnalysis.layers.reduce(
        (acc, l) => {
          acc[l.layer] = l.nodes.length;
          return acc;
        },
        {} as { [key: number]: number }
      ),
    };
  }

  getLayerHealthScore(layerAnalysis: LayerAnalysis): number {
    const totalNodes = layerAnalysis.layers.reduce((sum, l) => sum + l.nodes.length, 0);
    const totalViolations = layerAnalysis.violations.length;

    // Health score decreases with violations
    const violationPenalty = (totalViolations / totalNodes) * 100;
    return Math.max(0, 100 - violationPenalty);
  }

  getMostProblematicLayer(layerAnalysis: LayerAnalysis): {
    layer: number;
    name: string;
    violations: number;
    violationRate: number;
  } | null {
    if (layerAnalysis.violations.length === 0) return null;

    const violationCounts = new Map<number, number>();

    layerAnalysis.violations.forEach((violation) => {
      violationCounts.set(
        violation.sourceLayer,
        (violationCounts.get(violation.sourceLayer) || 0) + 1
      );
    });

    let maxViolations = 0;
    let problematicLayer = 0;

    violationCounts.forEach((count, layer) => {
      if (count > maxViolations) {
        maxViolations = count;
        problematicLayer = layer;
      }
    });

    const layerInfo = layerAnalysis.layers.find((l) => l.layer === problematicLayer);

    return {
      layer: problematicLayer,
      name: layerInfo?.name || `Layer ${problematicLayer}`,
      violations: maxViolations,
      violationRate: (maxViolations / (layerInfo?.nodes.length || 1)) * 100,
    };
  }
}
