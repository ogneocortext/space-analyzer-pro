/**
 * 3D Selection Manager for File System Browser
 * Handles multi-selection, area selection, and bulk operations
 */

import * as THREE from "three";

// Selection Types
export type SelectionMode = "single" | "multiple" | "area";

// Selection Event Types
export interface SelectionEvent {
  type: "select" | "deselect" | "clear" | "area-select";
  nodes: FileNode[];
  added?: FileNode[];
  removed?: FileNode[];
}

// File Node Interface
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: Date;
  children?: FileNode[];
  position?: THREE.Vector3;
  mesh?: THREE.Mesh;
  label?: THREE.Mesh;
  visible?: boolean;
  selected?: boolean;
}

// Selection Manager Class
export class SelectionManager {
  private selectedNodes: Set<FileNode>;
  private selectionMode: SelectionMode;
  private selectionHistory: FileNode[][];
  private maxHistorySize: number;
  private eventListeners: Map<string, ((event: SelectionEvent) => void)[]>;
  private areaSelection: AreaSelection | null;
  private raycaster: THREE.Raycaster;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.selectedNodes = new Set();
    this.selectionMode = "multiple";
    this.selectionHistory = [];
    this.maxHistorySize = 50;
    this.eventListeners = new Map();
    this.areaSelection = null;
    this.raycaster = new THREE.Raycaster();
    this.camera = camera;
    this.scene = scene;
  }

  // Set Selection Mode
  public setSelectionMode(mode: SelectionMode): void {
    this.selectionMode = mode;
    if (mode === "single" && this.selectedNodes.size > 1) {
      this.clearSelection();
    }
  }

  // Get Selection Mode
  public getSelectionMode(): SelectionMode {
    return this.selectionMode;
  }

  // Select Node
  public selectNode(node: FileNode, addToSelection: boolean = false): void {
    const wasSelected = this.selectedNodes.has(node);

    if (!addToSelection && this.selectionMode === "single") {
      this.clearSelection();
    }

    if (!wasSelected) {
      this.selectedNodes.add(node);
      node.selected = true;
      this.updateNodeVisual(node, true);

      this.emitEvent({
        type: "select",
        nodes: [node],
        added: [node],
        removed: [],
      });
    }
  }

  // Deselect Node
  public deselectNode(node: FileNode): void {
    if (this.selectedNodes.has(node)) {
      this.selectedNodes.delete(node);
      node.selected = false;
      this.updateNodeVisual(node, false);

      this.emitEvent({
        type: "deselect",
        nodes: [node],
        added: [],
        removed: [node],
      });
    }
  }

  // Toggle Node Selection
  public toggleNodeSelection(node: FileNode): void {
    if (this.selectedNodes.has(node)) {
      this.deselectNode(node);
    } else {
      this.selectNode(node, true);
    }
  }

  // Select All Nodes
  public selectAllNodes(nodes: FileNode[]): void {
    const added: FileNode[] = [];

    nodes.forEach((node) => {
      if (!this.selectedNodes.has(node)) {
        this.selectedNodes.add(node);
        node.selected = true;
        this.updateNodeVisual(node, true);
        added.push(node);
      }
    });

    if (added.length > 0) {
      this.emitEvent({
        type: "select",
        nodes: Array.from(this.selectedNodes),
        added,
        removed: [],
      });
    }
  }

  // Clear Selection
  public clearSelection(): void {
    const removed = Array.from(this.selectedNodes);

    this.selectedNodes.forEach((node) => {
      node.selected = false;
      this.updateNodeVisual(node, false);
    });

    this.selectedNodes.clear();

    if (removed.length > 0) {
      this.emitEvent({
        type: "clear",
        nodes: [],
        added: [],
        removed,
      });
    }
  }

  // Get Selected Nodes
  public getSelectedNodes(): FileNode[] {
    return Array.from(this.selectedNodes);
  }

  // Get Selected Count
  public getSelectedCount(): number {
    return this.selectedNodes.size;
  }

  // Is Node Selected
  public isNodeSelected(node: FileNode): boolean {
    return this.selectedNodes.has(node);
  }

  // Select Nodes in Area
  public selectNodesInArea(
    startPoint: THREE.Vector2,
    endPoint: THREE.Vector2,
    nodes: FileNode[]
  ): void {
    if (!this.areaSelection) {
      this.areaSelection = new AreaSelection(startPoint, endPoint);
    } else {
      this.areaSelection.update(startPoint, endPoint);
    }

    const selectedInArea: FileNode[] = [];
    const added: FileNode[] = [];
    const removed: FileNode[] = [];

    nodes.forEach((node) => {
      if (!node.position || !node.mesh) return;

      const screenPosition = this.worldToScreen(node.position);
      const isInArea = this.areaSelection!.containsPoint(screenPosition);
      const wasSelected = this.selectedNodes.has(node);

      if (isInArea && !wasSelected) {
        this.selectedNodes.add(node);
        node.selected = true;
        this.updateNodeVisual(node, true);
        selectedInArea.push(node);
        added.push(node);
      } else if (!isInArea && wasSelected) {
        this.selectedNodes.delete(node);
        node.selected = false;
        this.updateNodeVisual(node, false);
        removed.push(node);
      }
    });

    if (added.length > 0 || removed.length > 0) {
      this.emitEvent({
        type: "area-select",
        nodes: selectedInArea,
        added,
        removed,
      });
    }
  }

  // Start Area Selection
  public startAreaSelection(startPoint: THREE.Vector2): void {
    this.areaSelection = new AreaSelection(startPoint, startPoint);
  }

  // Update Area Selection
  public updateAreaSelection(endPoint: THREE.Vector2): void {
    if (this.areaSelection) {
      this.areaSelection.update(this.areaSelection.startPoint, endPoint);
    }
  }

  // End Area Selection
  public endAreaSelection(): void {
    this.areaSelection = null;
  }

  // Select by Raycast
  public selectByRaycast(
    mousePosition: THREE.Vector2,
    nodes: FileNode[],
    addToSelection: boolean = false
  ): FileNode | null {
    this.raycaster.setFromCamera(mousePosition, this.camera);

    const meshes = nodes
      .filter((node) => node.mesh && node.visible !== false)
      .map((node) => node.mesh!);

    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const clickedNode = nodes.find((node) => node.mesh === clickedMesh);

      if (clickedNode) {
        if (addToSelection) {
          this.toggleNodeSelection(clickedNode);
        } else {
          this.selectNode(clickedNode, false);
        }
        return clickedNode;
      }
    }

    return null;
  }

  // Select by Frustum
  public selectByFrustum(frustum: THREE.Frustum, nodes: FileNode[]): void {
    const added: FileNode[] = [];

    nodes.forEach((node) => {
      if (!node.mesh) return;

      const wasSelected = this.selectedNodes.has(node);
      const isInFrustum = frustum.intersectsObject(node.mesh);

      if (isInFrustum && !wasSelected) {
        this.selectedNodes.add(node);
        node.selected = true;
        this.updateNodeVisual(node, true);
        added.push(node);
      } else if (!isInFrustum && wasSelected) {
        this.selectedNodes.delete(node);
        node.selected = false;
        this.updateNodeVisual(node, false);
      }
    });

    if (added.length > 0) {
      this.emitEvent({
        type: "select",
        nodes: Array.from(this.selectedNodes),
        added,
        removed: [],
      });
    }
  }

  // Invert Selection
  public invertSelection(nodes: FileNode[]): void {
    const added: FileNode[] = [];
    const removed: FileNode[] = [];

    nodes.forEach((node) => {
      if (this.selectedNodes.has(node)) {
        this.selectedNodes.delete(node);
        node.selected = false;
        this.updateNodeVisual(node, false);
        removed.push(node);
      } else {
        this.selectedNodes.add(node);
        node.selected = true;
        this.updateNodeVisual(node, true);
        added.push(node);
      }
    });

    if (added.length > 0 || removed.length > 0) {
      this.emitEvent({
        type: "select",
        nodes: Array.from(this.selectedNodes),
        added,
        removed,
      });
    }
  }

  // Select by Type
  public selectByType(nodes: FileNode[], type: "file" | "directory"): void {
    const nodesOfType = nodes.filter((node) => node.type === type);
    this.selectAllNodes(nodesOfType);
  }

  // Select by Size Range
  public selectBySizeRange(nodes: FileNode[], minSize: number, maxSize: number): void {
    const nodesInRange = nodes.filter((node) => node.size >= minSize && node.size <= maxSize);
    this.selectAllNodes(nodesInRange);
  }

  // Select by Name Pattern
  public selectByNamePattern(nodes: FileNode[], pattern: string, useRegex: boolean = false): void {
    let regex: RegExp;

    try {
      regex = useRegex
        ? new RegExp(pattern, "i")
        : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    } catch (error) {
      console.error("Invalid regex pattern:", error);
      return;
    }

    const matchingNodes = nodes.filter((node) => regex.test(node.name));
    this.selectAllNodes(matchingNodes);
  }

  // Get Selection Statistics
  public getSelectionStats(): {
    total: number;
    files: number;
    directories: number;
    totalSize: number;
    averageSize: number;
    largestFile: FileNode | null;
    smallestFile: FileNode | null;
  } {
    const selected = Array.from(this.selectedNodes);

    if (selected.length === 0) {
      return {
        total: 0,
        files: 0,
        directories: 0,
        totalSize: 0,
        averageSize: 0,
        largestFile: null,
        smallestFile: null,
      };
    }

    const files = selected.filter((node) => node.type === "file");
    const directories = selected.filter((node) => node.type === "directory");
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const averageSize = files.length > 0 ? totalSize / files.length : 0;

    const sortedFiles = files.sort((a, b) => b.size - a.size);
    const largestFile = sortedFiles[0] || null;
    const smallestFile = sortedFiles[sortedFiles.length - 1] || null;

    return {
      total: selected.length,
      files: files.length,
      directories: directories.length,
      totalSize,
      averageSize,
      largestFile,
      smallestFile,
    };
  }

  // Save Selection State
  public saveSelectionState(): void {
    const currentState = Array.from(this.selectedNodes);
    this.selectionHistory.push(currentState);

    // Limit history size
    if (this.selectionHistory.length > this.maxHistorySize) {
      this.selectionHistory.shift();
    }
  }

  // Restore Selection State
  public restoreSelectionState(index: number = -1): void {
    if (this.selectionHistory.length === 0) return;

    const stateIndex = index === -1 ? this.selectionHistory.length - 1 : index;
    const state = this.selectionHistory[stateIndex];

    if (state) {
      this.clearSelection();
      this.selectAllNodes(state);
    }
  }

  // Add Event Listener
  public addEventListener(event: string, callback: (event: SelectionEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  // Remove Event Listener
  public removeEventListener(event: string, callback: (event: SelectionEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Emit Event
  private emitEvent(event: SelectionEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }

  // Update Node Visual
  private updateNodeVisual(node: FileNode, selected: boolean): void {
    if (!node.mesh) return;

    const material = node.mesh.material as THREE.MeshStandardMaterial;

    if (selected) {
      material.emissive = new THREE.Color(0x222222);
      material.emissiveIntensity = 0.5;
    } else {
      material.emissive = new THREE.Color(0x000000);
      material.emissiveIntensity = 0;
    }
  }

  // World to Screen Conversion
  private worldToScreen(worldPosition: THREE.Vector3): THREE.Vector2 {
    const vector = worldPosition.clone();
    vector.project(this.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    return new THREE.Vector2(x, y);
  }

  // Get Area Selection Bounds
  public getAreaSelectionBounds(): { start: THREE.Vector2; end: THREE.Vector2 } | null {
    if (!this.areaSelection) return null;

    return {
      start: this.areaSelection.startPoint.clone(),
      end: this.areaSelection.endPoint.clone(),
    };
  }

  // Dispose
  public dispose(): void {
    this.clearSelection();
    this.eventListeners.clear();
    this.selectionHistory = [];
    this.areaSelection = null;
  }
}

// Area Selection Class
class AreaSelection {
  public startPoint: THREE.Vector2;
  public endPoint: THREE.Vector2;
  private minBounds: THREE.Vector2;
  private maxBounds: THREE.Vector2;

  constructor(startPoint: THREE.Vector2, endPoint: THREE.Vector2) {
    this.startPoint = startPoint.clone();
    this.endPoint = endPoint.clone();
    this.updateBounds();
  }

  // Update Area
  public update(startPoint: THREE.Vector2, endPoint: THREE.Vector2): void {
    this.startPoint = startPoint.clone();
    this.endPoint = endPoint.clone();
    this.updateBounds();
  }

  // Update Bounds
  private updateBounds(): void {
    this.minBounds = new THREE.Vector2(
      Math.min(this.startPoint.x, this.endPoint.x),
      Math.min(this.startPoint.y, this.endPoint.y)
    );
    this.maxBounds = new THREE.Vector2(
      Math.max(this.startPoint.x, this.endPoint.x),
      Math.max(this.startPoint.y, this.endPoint.y)
    );
  }

  // Contains Point
  public containsPoint(point: THREE.Vector2): boolean {
    return (
      point.x >= this.minBounds.x &&
      point.x <= this.maxBounds.x &&
      point.y >= this.minBounds.y &&
      point.y <= this.maxBounds.y
    );
  }

  // Get Area
  public getArea(): number {
    const width = this.maxBounds.x - this.minBounds.x;
    const height = this.maxBounds.y - this.minBounds.y;
    return width * height;
  }

  // Get Center
  public getCenter(): THREE.Vector2 {
    return new THREE.Vector2(
      (this.minBounds.x + this.maxBounds.x) / 2,
      (this.minBounds.y + this.maxBounds.y) / 2
    );
  }
}

// Bulk Operations Manager
export class BulkOperationsManager {
  private selectionManager: SelectionManager;

  constructor(selectionManager: SelectionManager) {
    this.selectionManager = selectionManager;
  }

  // Delete Selected Files
  public async deleteSelected(): Promise<{
    success: boolean;
    deleted: FileNode[];
    errors: string[];
  }> {
    const selectedNodes = this.selectionManager.getSelectedNodes();
    const deleted: FileNode[] = [];
    const errors: string[] = [];

    for (const node of selectedNodes) {
      try {
        // Simulate file deletion
        await this.simulateFileOperation("delete", node);
        deleted.push(node);
      } catch (error) {
        errors.push(`Failed to delete ${node.name}: ${error}`);
      }
    }

    if (deleted.length > 0) {
      this.selectionManager.clearSelection();
    }

    return {
      success: deleted.length > 0,
      deleted,
      errors,
    };
  }

  // Move Selected Files
  public async moveSelected(targetPath: string): Promise<{
    success: boolean;
    moved: FileNode[];
    errors: string[];
  }> {
    const selectedNodes = this.selectionManager.getSelectedNodes();
    const moved: FileNode[] = [];
    const errors: string[] = [];

    for (const node of selectedNodes) {
      try {
        // Simulate file move
        await this.simulateFileOperation("move", node, targetPath);
        moved.push(node);
      } catch (error) {
        errors.push(`Failed to move ${node.name}: ${error}`);
      }
    }

    if (moved.length > 0) {
      this.selectionManager.clearSelection();
    }

    return {
      success: moved.length > 0,
      moved,
      errors,
    };
  }

  // Copy Selected Files
  public async copySelected(targetPath: string): Promise<{
    success: boolean;
    copied: FileNode[];
    errors: string[];
  }> {
    const selectedNodes = this.selectionManager.getSelectedNodes();
    const copied: FileNode[] = [];
    const errors: string[] = [];

    for (const node of selectedNodes) {
      try {
        // Simulate file copy
        await this.simulateFileOperation("copy", node, targetPath);
        copied.push(node);
      } catch (error) {
        errors.push(`Failed to copy ${node.name}: ${error}`);
      }
    }

    return {
      success: copied.length > 0,
      copied,
      errors,
    };
  }

  // Compress Selected Files
  public async compressSelected(archiveName: string): Promise<{
    success: boolean;
    compressed: FileNode[];
    archivePath: string;
    errors: string[];
  }> {
    const selectedNodes = this.selectionManager.getSelectedNodes();
    const compressed: FileNode[] = [];
    const errors: string[] = [];

    try {
      // Simulate compression
      await this.simulateCompression(selectedNodes, archiveName);
      compressed.push(...selectedNodes);
    } catch (error) {
      errors.push(`Failed to compress files: ${error}`);
    }

    return {
      success: compressed.length > 0,
      compressed,
      archivePath: `${targetPath || "./"}/${archiveName}.zip`,
      errors,
    };
  }

  // Get Selected Files Info
  public getSelectedFilesInfo(): {
    count: number;
    totalSize: number;
    files: FileNode[];
    directories: FileNode[];
    sizeDistribution: Record<string, number>;
  } {
    const selectedNodes = this.selectionManager.getSelectedNodes();
    const files = selectedNodes.filter((node) => node.type === "file");
    const directories = selectedNodes.filter((node) => node.type === "directory");
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    const sizeDistribution: Record<string, number> = {
      small: 0, // < 1MB
      medium: 0, // 1MB - 10MB
      large: 0, // 10MB - 100MB
      xlarge: 0, // > 100MB
    };

    files.forEach((file) => {
      if (file.size < 1024 * 1024) {
        sizeDistribution.small++;
      } else if (file.size < 10 * 1024 * 1024) {
        sizeDistribution.medium++;
      } else if (file.size < 100 * 1024 * 1024) {
        sizeDistribution.large++;
      } else {
        sizeDistribution.xlarge++;
      }
    });

    return {
      count: selectedNodes.length,
      totalSize,
      files,
      directories,
      sizeDistribution,
    };
  }

  // Simulate File Operation
  private async simulateFileOperation(
    operation: "delete" | "move" | "copy",
    node: FileNode,
    targetPath?: string
  ): Promise<void> {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    // Simulate potential errors (10% chance)
    if (Math.random() < 0.1) {
      throw new Error("Simulated operation error");
    }

    console.log(`${operation} ${node.name}${targetPath ? ` to ${targetPath}` : ""}`);
  }

  // Simulate Compression
  private async simulateCompression(nodes: FileNode[], archiveName: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, nodes.length * 50));

    if (Math.random() < 0.1) {
      throw new Error("Compression failed");
    }

    console.log(`Compressed ${nodes.length} files to ${archiveName}.zip`);
  }
}

// Selection Utilities
export class SelectionUtils {
  // Calculate Selection Bounds
  public static calculateSelectionBounds(nodes: FileNode[]): {
    min: THREE.Vector3;
    max: THREE.Vector3;
    center: THREE.Vector3;
    size: THREE.Vector3;
  } | null {
    const positions = nodes.filter((node) => node.position).map((node) => node.position!);

    if (positions.length === 0) return null;

    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    positions.forEach((pos) => {
      min.min(pos);
      max.max(pos);
    });

    const center = new THREE.Vector3();
    center.addVectors(min, max).multiplyScalar(0.5);

    const size = new THREE.Vector3();
    size.subVectors(max, min);

    return { min, max, center, size };
  }

  // Filter Selection by Type
  public static filterByType(nodes: FileNode[], type: "file" | "directory"): FileNode[] {
    return nodes.filter((node) => node.type === type);
  }

  // Filter Selection by Size
  public static filterBySize(nodes: FileNode[], minSize: number, maxSize: number): FileNode[] {
    return nodes.filter((node) => node.size >= minSize && node.size <= maxSize);
  }

  // Sort Selection by Name
  public static sortByName(nodes: FileNode[], ascending: boolean = true): FileNode[] {
    return [...nodes].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return ascending ? comparison : -comparison;
    });
  }

  // Sort Selection by Size
  public static sortBySize(nodes: FileNode[], ascending: boolean = false): FileNode[] {
    return [...nodes].sort((a, b) => {
      const comparison = a.size - b.size;
      return ascending ? comparison : -comparison;
    });
  }

  // Sort Selection by Date
  public static sortByDate(nodes: FileNode[], ascending: boolean = false): FileNode[] {
    return [...nodes].sort((a, b) => {
      const comparison = a.modified.getTime() - b.modified.getTime();
      return ascending ? comparison : -comparison;
    });
  }
}
