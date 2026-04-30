/**
 * 3D Directory Comparison Manager
 * Handles side-by-side directory comparison and analysis
 */

import * as THREE from 'three'

// Comparison Types
export type ComparisonMode = 'side-by-side' | 'overlay' | 'diff' | 'sync'

// Comparison Result Types
export interface ComparisonResult {
  identical: FileNode[]
  different: FileNode[]
  onlyInLeft: FileNode[]
  onlyInRight: FileNode[]
  statistics: ComparisonStatistics
}

// Comparison Statistics
export interface ComparisonStatistics {
  totalLeft: number
  totalRight: number
  identical: number
  different: number
  onlyInLeft: number
  onlyInRight: number
  similarity: number
  leftSize: number
  rightSize: number
  sizeDifference: number
}

// File Node Interface
export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: Date
  children?: FileNode[]
  position?: THREE.Vector3
  mesh?: THREE.Mesh
  label?: THREE.Mesh
  visible?: boolean
  comparisonStatus?: 'identical' | 'different' | 'only-left' | 'only-right'
}

// Comparison Manager Class
export class ComparisonManager {
  private leftDirectory: FileNode | null
  private rightDirectory: FileNode | null
  private comparisonMode: ComparisonMode
  private comparisonResult: ComparisonResult | null
  private eventListeners: Map<string, ((event: any) => void)[]>
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.leftDirectory = null
    this.rightDirectory = null
    this.comparisonMode = 'side-by-side'
    this.comparisonResult = null
    this.eventListeners = new Map()
    this.scene = scene
    this.camera = camera
  }

  // Set Directories for Comparison
  public setDirectories(left: FileNode, right: FileNode): void {
    this.leftDirectory = left
    this.rightDirectory = right
    this.performComparison()
  }

  // Get Directories
  public getDirectories(): { left: FileNode | null; right: FileNode | null } {
    return {
      left: this.leftDirectory,
      right: this.rightDirectory
    }
  }

  // Set Comparison Mode
  public setComparisonMode(mode: ComparisonMode): void {
    this.comparisonMode = mode
    this.updateVisualization()
  }

  // Get Comparison Mode
  public getComparisonMode(): ComparisonMode {
    return this.comparisonMode
  }

  // Get Comparison Result
  public getComparisonResult(): ComparisonResult | null {
    return this.comparisonResult
  }

  // Perform Comparison
  private performComparison(): void {
    if (!this.leftDirectory || !this.rightDirectory) return

    const leftNodes = this.flattenDirectory(this.leftDirectory)
    const rightNodes = this.flattenDirectory(this.rightDirectory)

    const result: ComparisonResult = {
      identical: [],
      different: [],
      onlyInLeft: [],
      onlyInRight: [],
      statistics: this.calculateStatistics(leftNodes, rightNodes)
    }

    // Compare nodes
    const leftMap = new Map(leftNodes.map(node => [node.path, node]))
    const rightMap = new Map(rightNodes.map(node => [node.path, node]))

    // Find identical and different files
    leftNodes.forEach(leftNode => {
      const rightNode = rightMap.get(leftNode.path)
      
      if (rightNode) {
        if (this.areNodesIdentical(leftNode, rightNode)) {
          result.identical.push(leftNode)
          leftNode.comparisonStatus = 'identical'
        } else {
          result.different.push(leftNode)
          leftNode.comparisonStatus = 'different'
        }
      } else {
        result.onlyInLeft.push(leftNode)
        leftNode.comparisonStatus = 'only-left'
      }
    })

    // Find files only in right directory
    rightNodes.forEach(rightNode => {
      if (!leftMap.has(rightNode.path)) {
        result.onlyInRight.push(rightNode)
        rightNode.comparisonStatus = 'only-right'
      }
    })

    this.comparisonResult = result
    this.emitEvent('comparisonComplete', result)
  }

  // Flatten Directory
  private flattenDirectory(root: FileNode): FileNode[] {
    const nodes: FileNode[] = []
    
    const traverse = (node: FileNode) => {
      nodes.push(node)
      if (node.children) {
        node.children.forEach(traverse)
      }
    }
    
    traverse(root)
    return nodes
  }

  // Check if Nodes are Identical
  private areNodesIdentical(left: FileNode, right: FileNode): boolean {
    if (left.type !== right.type) return false
    if (left.name !== right.name) return false
    if (left.size !== right.size) return false
    
    // For files, check modification time (with some tolerance)
    if (left.type === 'file') {
      const timeDiff = Math.abs(left.modified.getTime() - right.modified.getTime())
      return timeDiff < 1000 // 1 second tolerance
    }
    
    return true
  }

  // Calculate Statistics
  private calculateStatistics(leftNodes: FileNode[], rightNodes: FileNode[]): ComparisonStatistics {
    const totalLeft = leftNodes.length
    const totalRight = rightNodes.length
    const leftSize = leftNodes.reduce((sum, node) => sum + node.size, 0)
    const rightSize = rightNodes.reduce((sum, node) => sum + node.size, 0)

    // These will be calculated after comparison
    let identical = 0
    let different = 0
    let onlyInLeft = 0
    let onlyInRight = 0

    const leftMap = new Map(leftNodes.map(node => [node.path, node]))
    const rightMap = new Map(rightNodes.map(node => [node.path, node]))

    leftNodes.forEach(leftNode => {
      const rightNode = rightMap.get(leftNode.path)
      if (rightNode) {
        if (this.areNodesIdentical(leftNode, rightNode)) {
          identical++
        } else {
          different++
        }
      } else {
        onlyInLeft++
      }
    })

    rightNodes.forEach(rightNode => {
      if (!leftMap.has(rightNode.path)) {
        onlyInRight++
      }
    })

    const totalFiles = totalLeft + totalRight
    const similarity = totalFiles > 0 ? (identical * 2) / totalFiles : 0

    return {
      totalLeft,
      totalRight,
      identical,
      different,
      onlyInLeft,
      onlyInRight,
      similarity,
      leftSize,
      rightSize,
      sizeDifference: Math.abs(leftSize - rightSize)
    }
  }

  // Update Visualization
  private updateVisualization(): void {
    if (!this.comparisonResult) return

    switch (this.comparisonMode) {
      case 'side-by-side':
        this.createSideBySideView()
        break
      case 'overlay':
        this.createOverlayView()
        break
      case 'diff':
        this.createDiffView()
        break
      case 'sync':
        this.createSyncView()
        break
    }
  }

  // Create Side-by-Side View
  private createSideBySideView(): void {
    if (!this.leftDirectory || !this.rightDirectory) return

    // Clear existing comparison objects
    this.clearComparisonObjects()

    // Position directories side by side
    const leftPosition = new THREE.Vector3(-20, 0, 0)
    const rightPosition = new THREE.Vector3(20, 0, 0)

    // Create visual representations
    this.createDirectoryVisualization(this.leftDirectory, leftPosition, 'left')
    this.createDirectoryVisualization(this.rightDirectory, rightPosition, 'right')

    // Update camera to view both directories
    this.camera.position.set(0, 30, 50)
    this.camera.lookAt(0, 0, 0)
  }

  // Create Overlay View
  private createOverlayView(): void {
    if (!this.leftDirectory || !this.rightDirectory) return

    this.clearComparisonObjects()

    // Position directories at same location with transparency
    const position = new THREE.Vector3(0, 0, 0)

    this.createDirectoryVisualization(this.leftDirectory, position, 'left', 0.5)
    this.createDirectoryVisualization(this.rightDirectory, position, 'right', 0.5)
  }

  // Create Diff View
  private createDiffView(): void {
    if (!this.comparisonResult) return

    this.clearComparisonObjects()

    // Show only different files
    const differentNodes = [...this.comparisonResult.different, ...this.comparisonResult.onlyInLeft, ...this.comparisonResult.onlyInRight]
    
    differentNodes.forEach((node, index) => {
      const angle = (index / differentNodes.length) * Math.PI * 2
      const radius = 15
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = (index % 10) * 2 - 10

      this.createNodeVisualization(node, new THREE.Vector3(x, y, z), this.getStatusColor(node.comparisonStatus))
    })
  }

  // Create Sync View
  private createSyncView(): void {
    if (!this.comparisonResult) return

    this.clearComparisonObjects()

    // Show files that need synchronization
    const syncNodes = [...this.comparisonResult.different, ...this.comparisonResult.onlyInLeft, ...this.comparisonResult.onlyInRight]
    
    // Create sync visualization
    syncNodes.forEach((node, index) => {
      const row = Math.floor(index / 10)
      const col = index % 10
      const x = (col - 5) * 4
      const y = -row * 3
      const z = 0

      this.createNodeVisualization(node, new THREE.Vector3(x, y, z), this.getStatusColor(node.comparisonStatus))
    })
  }

  // Create Directory Visualization
  private createDirectoryVisualization(directory: FileNode, position: THREE.Vector3, side: 'left' | 'right', opacity: number = 1): void {
    // Create container group
    const group = new THREE.Group()
    group.position.copy(position)

    // Add directory visualization
    this.createNodeVisualization(directory, new THREE.Vector3(0, 0, 0), this.getSideColor(side), opacity)

    // Add children
    if (directory.children) {
      directory.children.forEach((child, index) => {
        const angle = (index / directory.children!.length) * Math.PI * 2
        const radius = 8
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = -2

        const childPosition = new THREE.Vector3(x, y, z)
        this.createNodeVisualization(child, childPosition, this.getStatusColor(child.comparisonStatus), opacity)
      })
    }

    this.scene.add(group)
  }

  // Create Node Visualization
  private createNodeVisualization(node: FileNode, position: THREE.Vector3, color: number, opacity: number = 1): void {
    const size = Math.max(0.5, Math.log(node.size + 1) / Math.log(1024))
    
    const geometry = node.type === 'directory' 
      ? new THREE.SphereGeometry(size * 1.5, 16, 16)
      : new THREE.BoxGeometry(size, size, size)

    const material = new THREE.MeshStandardMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      metalness: 0.1,
      roughness: 0.8
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = { node, comparisonNode: true }

    this.scene.add(mesh)
    node.mesh = mesh
  }

  // Get Side Color
  private getSideColor(side: 'left' | 'right'): number {
    return side === 'left' ? 0x4a90e2 : 0xe74c3c
  }

  // Get Status Color
  private getStatusColor(status?: string): number {
    switch (status) {
      case 'identical': return 0x2ecc71
      case 'different': return 0xf39c12
      case 'only-left': return 0x3498db
      case 'only-right': return 0xe74c3c
      default: return 0x95a5a6
    }
  }

  // Clear Comparison Objects
  private clearComparisonObjects(): void {
    const objectsToRemove: THREE.Object3D[] = []

    this.scene.traverse((object) => {
      if (object.userData.comparisonNode) {
        objectsToRemove.push(object)
      }
    })

    objectsToRemove.forEach(object => {
      this.scene.remove(object)
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (object.material instanceof THREE.Material) {
          object.material.dispose()
        }
      }
    })
  }

  // Get Detailed Comparison
  public getDetailedComparison(): {
    fileTypes: Record<string, { left: number; right: number; identical: number; different: number }>
    sizeDistribution: Record<string, { left: number; right: number }>
    modificationTimes: { left: Date[]; right: Date[] }
  } | null {
    if (!this.comparisonResult) return null

    const fileTypes: Record<string, { left: number; right: number; identical: number; different: number }> = {}
    const sizeDistribution: Record<string, { left: number; right: number }> = {
      small: { left: 0, right: 0 },
      medium: { left: 0, right: 0 },
      large: { left: 0, right: 0 },
      xlarge: { left: 0, right: 0 }
    }
    const modificationTimes = { left: [] as Date[], right: [] as Date[] }

    const processNode = (node: FileNode, side: 'left' | 'right', status?: string) => {
      // File type analysis
      const extension = node.name.split('.').pop()?.toLowerCase() || 'unknown'
      if (!fileTypes[extension]) {
        fileTypes[extension] = { left: 0, right: 0, identical: 0, different: 0 }
      }
      fileTypes[extension][side]++

      if (status === 'identical') {
        fileTypes[extension].identical++
      } else if (status === 'different') {
        fileTypes[extension].different++
      }

      // Size distribution
      const sizeCategory = this.getSizeCategory(node.size)
      sizeDistribution[sizeCategory][side]++

      // Modification times
      modificationTimes[side].push(node.modified)
    }

    // Process left directory
    if (this.leftDirectory) {
      this.flattenDirectory(this.leftDirectory).forEach(node => {
        const status = node.comparisonStatus
        processNode(node, 'left', status)
      })
    }

    // Process right directory
    if (this.rightDirectory) {
      this.flattenDirectory(this.rightDirectory).forEach(node => {
        const status = node.comparisonStatus
        processNode(node, 'right', status)
      })
    }

    return {
      fileTypes,
      sizeDistribution,
      modificationTimes
    }
  }

  // Get Size Category
  private getSizeCategory(size: number): string {
    if (size < 1024 * 1024) return 'small'
    if (size < 10 * 1024 * 1024) return 'medium'
    if (size < 100 * 1024 * 1024) return 'large'
    return 'xlarge'
  }

  // Export Comparison Results
  public exportComparisonResults(): string {
    if (!this.comparisonResult) return ''

    const results = {
      timestamp: new Date().toISOString(),
      comparisonMode: this.comparisonMode,
      leftDirectory: this.leftDirectory?.path,
      rightDirectory: this.rightDirectory?.path,
      statistics: this.comparisonResult.statistics,
      details: this.getDetailedComparison(),
      files: {
        identical: this.comparisonResult.identical.map(node => ({
          name: node.name,
          path: node.path,
          size: node.size,
          modified: node.modified
        })),
        different: this.comparisonResult.different.map(node => ({
          name: node.name,
          path: node.path,
          size: node.size,
          modified: node.modified
        })),
        onlyInLeft: this.comparisonResult.onlyInLeft.map(node => ({
          name: node.name,
          path: node.path,
          size: node.size,
          modified: node.modified
        })),
        onlyInRight: this.comparisonResult.onlyInRight.map(node => ({
          name: node.name,
          path: node.path,
          size: node.size,
          modified: node.modified
        }))
      }
    }

    return JSON.stringify(results, null, 2)
  }

  // Sync Directories
  public async syncDirectories(direction: 'left-to-right' | 'right-to-left' | 'bidirectional'): Promise<{
    success: boolean
    synced: FileNode[]
    errors: string[]
  }> {
    if (!this.comparisonResult) {
      return {
        success: false,
        synced: [],
        errors: ['No comparison result available']
      }
    }

    const synced: FileNode[] = []
    const errors: string[] = []

    try {
      switch (direction) {
        case 'left-to-right':
          await this.syncLeftToRight(synced, errors)
          break
        case 'right-to-left':
          await this.syncRightToLeft(synced, errors)
          break
        case 'bidirectional':
          await this.syncBidirectional(synced, errors)
          break
      }
    } catch (error) {
      errors.push(`Sync failed: ${error}`)
    }

    return {
      success: synced.length > 0 && errors.length === 0,
      synced,
      errors
    }
  }

  // Sync Left to Right
  private async syncLeftToRight(synced: FileNode[], errors: string[]): Promise<void> {
    const filesToSync = [...this.comparisonResult!.different, ...this.comparisonResult!.onlyInLeft]
    
    for (const file of filesToSync) {
      try {
        // Simulate sync operation
        await this.simulateSyncOperation(file, 'left-to-right')
        synced.push(file)
      } catch (error) {
        errors.push(`Failed to sync ${file.name}: ${error}`)
      }
    }
  }

  // Sync Right to Left
  private async syncRightToLeft(synced: FileNode[], errors: string[]): Promise<void> {
    const filesToSync = [...this.comparisonResult!.different, ...this.comparisonResult!.onlyInRight]
    
    for (const file of filesToSync) {
      try {
        await this.simulateSyncOperation(file, 'right-to-left')
        synced.push(file)
      } catch (error) {
        errors.push(`Failed to sync ${file.name}: ${error}`)
      }
    }
  }

  // Sync Bidirectional
  private async syncBidirectional(synced: FileNode[], errors: string[]): Promise<void> {
    // Sync different files (choose newest)
    const differentFiles = this.comparisonResult!.different
    
    for (const file of differentFiles) {
      try {
        await this.simulateSyncOperation(file, 'bidirectional')
        synced.push(file)
      } catch (error) {
        errors.push(`Failed to sync ${file.name}: ${error}`)
      }
    }

    // Sync unique files
    await this.syncLeftToRight(synced, errors)
    await this.syncRightToLeft(synced, errors)
  }

  // Simulate Sync Operation
  private async simulateSyncOperation(file: FileNode, direction: string): Promise<void> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
    
    // Simulate potential errors (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated sync error')
    }
    
    console.log(`Synced ${file.name} ${direction}`)
  }

  // Add Event Listener
  public addEventListener(event: string, callback: (event: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  // Remove Event Listener
  public removeEventListener(event: string, callback: (event: any) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Emit Event
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => callback(data))
    }
  }

  // Dispose
  public dispose(): void {
    this.clearComparisonObjects()
    this.eventListeners.clear()
    this.leftDirectory = null
    this.rightDirectory = null
    this.comparisonResult = null
  }
}

// Comparison Utilities
export class ComparisonUtils {
  // Calculate Directory Similarity
  public static calculateSimilarity(left: FileNode, right: FileNode): number {
    const leftNodes = this.flattenDirectory(left)
    const rightNodes = this.flattenDirectory(right)
    
    const leftMap = new Map(leftNodes.map(node => [node.path, node]))
    const rightMap = new Map(rightNodes.map(node => [node.path, node]))
    
    let identical = 0
    let total = 0
    
    leftNodes.forEach(leftNode => {
      const rightNode = rightMap.get(leftNode.path)
      if (rightNode) {
        total++
        if (this.areNodesIdentical(leftNode, rightNode)) {
          identical++
        }
      }
    })
    
    rightNodes.forEach(rightNode => {
      if (!leftMap.has(rightNode.path)) {
        total++
      }
    })
    
    return total > 0 ? (identical / total) : 0
  }

  // Find Differences
  public static findDifferences(left: FileNode, right: FileNode): {
    added: FileNode[]
    removed: FileNode[]
    modified: FileNode[]
  } {
    const leftNodes = this.flattenDirectory(left)
    const rightNodes = this.flattenDirectory(right)
    
    const leftMap = new Map(leftNodes.map(node => [node.path, node]))
    const rightMap = new Map(rightNodes.map(node => [node.path, node]))
    
    const added: FileNode[] = []
    const removed: FileNode[] = []
    const modified: FileNode[] = []
    
    // Find added files (in right but not in left)
    rightNodes.forEach(rightNode => {
      if (!leftMap.has(rightNode.path)) {
        added.push(rightNode)
      }
    })
    
    // Find removed files (in left but not in right)
    leftNodes.forEach(leftNode => {
      if (!rightMap.has(leftNode.path)) {
        removed.push(leftNode)
      }
    })
    
    // Find modified files
    leftNodes.forEach(leftNode => {
      const rightNode = rightMap.get(leftNode.path)
      if (rightNode && !this.areNodesIdentical(leftNode, rightNode)) {
        modified.push(leftNode)
      }
    })
    
    return { added, removed, modified }
  }

  // Flatten Directory
  private static flattenDirectory(root: FileNode): FileNode[] {
    const nodes: FileNode[] = []
    
    const traverse = (node: FileNode) => {
      nodes.push(node)
      if (node.children) {
        node.children.forEach(traverse)
      }
    }
    
    traverse(root)
    return nodes
  }

  // Check if Nodes are Identical
  private static areNodesIdentical(left: FileNode, right: FileNode): boolean {
    if (left.type !== right.type) return false
    if (left.name !== right.name) return false
    if (left.size !== right.size) return false
    
    if (left.type === 'file') {
      const timeDiff = Math.abs(left.modified.getTime() - right.modified.getTime())
      return timeDiff < 1000
    }
    
    return true
  }

  // Generate Comparison Report
  public static generateReport(comparisonResult: ComparisonResult): string {
    const { statistics, identical, different, onlyInLeft, onlyInRight } = comparisonResult
    
    let report = `# Directory Comparison Report\n\n`
    report += `Generated: ${new Date().toLocaleString()}\n\n`
    
    report += `## Statistics\n`
    report += `- Total files (left): ${statistics.totalLeft}\n`
    report += `- Total files (right): ${statistics.totalRight}\n`
    report += `- Identical files: ${statistics.identical}\n`
    report += `- Different files: ${statistics.different}\n`
    report += `- Only in left: ${statistics.onlyInLeft}\n`
    report += `- Only in right: ${statistics.onlyInRight}\n`
    report += `- Similarity: ${(statistics.similarity * 100).toFixed(1)}%\n`
    report += `- Size difference: ${this.formatBytes(statistics.sizeDifference)}\n\n`
    
    if (different.length > 0) {
      report += `## Different Files\n`
      different.forEach(file => {
        report += `- ${file.name} (${this.formatBytes(file.size)})\n`
      })
      report += `\n`
    }
    
    if (onlyInLeft.length > 0) {
      report += `## Only in Left Directory\n`
      onlyInLeft.forEach(file => {
        report += `- ${file.name} (${this.formatBytes(file.size)})\n`
      })
      report += `\n`
    }
    
    if (onlyInRight.length > 0) {
      report += `## Only in Right Directory\n`
      onlyInRight.forEach(file => {
        report += `- ${file.name} (${this.formatBytes(file.size)})\n`
      })
      report += `\n`
    }
    
    return report
  }

  // Format Bytes
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}
