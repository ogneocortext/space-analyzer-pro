/**
 * 3D Memory Manager for File System Browser
 * Handles object pooling, memory optimization, and cleanup
 */

import * as THREE from 'three'

// Object Pool Configuration
interface PoolConfig {
  maxSize: number
  initialSize: number
  growthFactor: number
}

// Pool Types
type PoolType = 'geometry' | 'material' | 'mesh' | 'texture' | 'light'

// Memory Manager Class
export class ThreeDMemoryManager {
  private pools: Map<PoolType, ObjectPool>
  private memoryUsage: Map<string, number>
  private disposedObjects: Set<string>
  private cleanupInterval: number
  private maxMemoryUsage: number
  private currentMemoryUsage: number

  constructor(maxMemoryMB: number = 512) {
    this.pools = new Map()
    this.memoryUsage = new Map()
    this.disposedObjects = new Set()
    this.maxMemoryUsage = maxMemoryMB * 1024 * 1024 // Convert to bytes
    this.currentMemoryUsage = 0
    this.cleanupInterval = 30000 // 30 seconds
    
    this.initializePools()
    this.startMemoryMonitoring()
  }

  // Initialize Object Pools
  private initializePools(): void {
    const poolConfigs: Record<PoolType, PoolConfig> = {
      geometry: { maxSize: 1000, initialSize: 100, growthFactor: 1.5 },
      material: { maxSize: 500, initialSize: 50, growthFactor: 1.3 },
      mesh: { maxSize: 2000, initialSize: 200, growthFactor: 1.5 },
      texture: { maxSize: 100, initialSize: 10, growthFactor: 1.2 },
      light: { maxSize: 50, initialSize: 5, growthFactor: 1.1 }
    }

    Object.entries(poolConfigs).forEach(([type, config]) => {
      this.pools.set(type as PoolType, new ObjectPool(type as PoolType, config))
    })
  }

  // Get Object from Pool
  public getFromPool<T extends THREE.Object3D | THREE.Material | THREE.BufferGeometry>(
    type: PoolType,
    createFn: () => T
  ): T {
    const pool = this.pools.get(type)
    if (!pool) {
      console.warn(`Pool for type ${type} not found`)
      return createFn()
    }

    const obj = pool.get(createFn) as T
    this.trackMemoryUsage(obj, 'acquire')
    return obj
  }

  // Return Object to Pool
  public returnToPool<T extends THREE.Object3D | THREE.Material | THREE.BufferGeometry>(
    type: PoolType,
    obj: T
  ): void {
    const pool = this.pools.get(type)
    if (!pool) {
      console.warn(`Pool for type ${type} not found`)
      this.disposeObject(obj)
      return
    }

    this.trackMemoryUsage(obj, 'release')
    this.resetObject(obj)
    pool.return(obj)
  }

  // Dispose Object
  public disposeObject(obj: any): void {
    if (!obj) return

    const objId = this.getObjectId(obj)
    if (this.disposedObjects.has(objId)) {
      return // Already disposed
    }

    this.trackMemoryUsage(obj, 'dispose')

    if (obj instanceof THREE.BufferGeometry) {
      obj.dispose()
    } else if (obj instanceof THREE.Material) {
      obj.dispose()
    } else if (obj instanceof THREE.Texture) {
      obj.dispose()
    } else if (obj instanceof THREE.Mesh) {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose())
        } else {
          obj.material.dispose()
        }
      }
    } else if (obj instanceof THREE.Light) {
      // Lights don't need explicit disposal
    }

    this.disposedObjects.add(objId)
  }

  // Reset Object for Pooling
  private resetObject(obj: any): void {
    if (obj instanceof THREE.Mesh) {
      obj.position.set(0, 0, 0)
      obj.rotation.set(0, 0, 0)
      obj.scale.set(1, 1, 1)
      obj.visible = true
      obj.castShadow = true
      obj.receiveShadow = true
    } else if (obj instanceof THREE.Material) {
      obj.color.setHex(0xffffff)
      obj.opacity = 1
      obj.transparent = false
      obj.emissive.setHex(0x000000)
      obj.emissiveIntensity = 0
      obj.wireframe = false
    }
  }

  // Track Memory Usage
  private trackMemoryUsage(obj: any, action: 'acquire' | 'release' | 'dispose'): void {
    const size = this.estimateObjectSize(obj)
    const objId = this.getObjectId(obj)

    switch (action) {
      case 'acquire':
        this.currentMemoryUsage += size
        this.memoryUsage.set(objId, size)
        break
      case 'release':
        this.currentMemoryUsage -= size
        this.memoryUsage.delete(objId)
        break
      case 'dispose':
        if (this.memoryUsage.has(objId)) {
          this.currentMemoryUsage -= size
          this.memoryUsage.delete(objId)
        }
        break
    }

    // Check memory limit
    if (this.currentMemoryUsage > this.maxMemoryUsage) {
      this.performEmergencyCleanup()
    }
  }

  // Estimate Object Size
  private estimateObjectSize(obj: any): number {
    if (obj instanceof THREE.BufferGeometry) {
      // Estimate based on attributes
      let size = 1024 // Base size
      if (obj.attributes.position) {
        size += obj.attributes.position.count * 4 * 3 // 3 floats per vertex
      }
      if (obj.attributes.normal) {
        size += obj.attributes.normal.count * 4 * 3
      }
      if (obj.attributes.uv) {
        size += obj.attributes.uv.count * 4 * 2
      }
      return size
    } else if (obj instanceof THREE.Material) {
      return 2048 // Rough estimate for materials
    } else if (obj instanceof THREE.Texture) {
      if (obj.image) {
        return obj.image.width * obj.image.height * 4 // RGBA
      }
      return 1024
    } else if (obj instanceof THREE.Mesh) {
      let size = 512 // Base mesh size
      if (obj.geometry) size += this.estimateObjectSize(obj.geometry)
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          size += obj.material.length * this.estimateObjectSize(obj.material[0])
        } else {
          size += this.estimateObjectSize(obj.material)
        }
      }
      return size
    }
    return 512 // Default size
  }

  // Get Object ID
  private getObjectId(obj: any): string {
    if (obj.uuid) return obj.uuid
    if (obj.id !== undefined) return `id_${obj.id}`
    return `hash_${Math.random().toString(36).substr(2, 9)}`
  }

  // Emergency Cleanup
  private performEmergencyCleanup(): void {
    console.warn('Memory limit exceeded, performing emergency cleanup')
    
    // Clear least recently used objects from pools
    this.pools.forEach(pool => {
      pool.clearExcess()
    })

    // Force garbage collection hint
    if (window.gc) {
      window.gc()
    }
  }

  // Start Memory Monitoring
  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.checkMemoryUsage()
    }, this.cleanupInterval)
  }

  // Check Memory Usage
  private checkMemoryUsage(): void {
    const usagePercent = (this.currentMemoryUsage / this.maxMemoryUsage) * 100
    
    if (usagePercent > 80) {
      console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`)
      this.optimizeMemory()
    }

    // Log memory statistics
    console.log(`Memory usage: ${this.formatBytes(this.currentMemoryUsage)} / ${this.formatBytes(this.maxMemoryUsage)}`)
  }

  // Optimize Memory
  public optimizeMemory(): void {
    // Clear unused objects from pools
    this.pools.forEach(pool => {
      pool.optimize()
    })

    // Clear disposed objects tracking
    if (this.disposedObjects.size > 1000) {
      this.disposedObjects.clear()
    }
  }

  // Get Memory Statistics
  public getMemoryStats(): {
    currentUsage: number
    maxUsage: number
    usagePercent: number
    poolStats: Record<PoolType, any>
  } {
    const poolStats: Record<PoolType, any> = {}
    
    this.pools.forEach((pool, type) => {
      poolStats[type] = pool.getStats()
    })

    return {
      currentUsage: this.currentMemoryUsage,
      maxUsage: this.maxMemoryUsage,
      usagePercent: (this.currentMemoryUsage / this.maxMemoryUsage) * 100,
      poolStats
    }
  }

  // Format Bytes
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Cleanup
  public cleanup(): void {
    // Dispose all pools
    this.pools.forEach(pool => {
      pool.dispose()
    })

    // Clear tracking
    this.memoryUsage.clear()
    this.disposedObjects.clear()
    this.currentMemoryUsage = 0
  }
}

// Object Pool Implementation
class ObjectPool {
  private pool: any[]
  private config: PoolConfig
  private type: PoolType
  private createCount: number
  private acquireCount: number
  private returnCount: number

  constructor(type: PoolType, config: PoolConfig) {
    this.type = type
    this.config = config
    this.pool = []
    this.createCount = 0
    this.acquireCount = 0
    this.returnCount = 0

    // Pre-populate pool
    for (let i = 0; i < config.initialSize; i++) {
      this.pool.push(this.createObject())
    }
  }

  // Get Object from Pool
  public get(createFn: () => any): any {
    this.acquireCount++

    if (this.pool.length > 0) {
      return this.pool.pop()
    }

    // Create new object if pool is empty
    if (this.createCount < this.config.maxSize) {
      return createFn ? createFn() : this.createObject()
    }

    // Pool is full, reuse existing object
    console.warn(`Pool ${this.type} is full, reusing object`)
    return this.pool[0] ? this.pool.pop() : createFn()
  }

  // Return Object to Pool
  public return(obj: any): void {
    this.returnCount++

    if (this.pool.length < this.config.maxSize) {
      this.pool.push(obj)
    } else {
      // Pool is full, dispose the object
      if (this.type === 'geometry' || this.type === 'material' || this.type === 'texture') {
        obj.dispose?.()
      }
    }
  }

  // Create Object (placeholder)
  private createObject(): any {
    this.createCount++
    // This would be overridden by specific implementations
    return null
  }

  // Clear Excess Objects
  public clearExcess(): void {
    const targetSize = Math.floor(this.config.maxSize * 0.7)
    
    while (this.pool.length > targetSize) {
      const obj = this.pool.pop()
      if (obj && this.type === 'geometry' || this.type === 'material' || this.type === 'texture') {
        obj.dispose?.()
      }
    }
  }

  // Optimize Pool
  public optimize(): void {
    const targetSize = Math.floor(this.config.initialSize * 1.5)
    
    while (this.pool.length > targetSize) {
      const obj = this.pool.pop()
      if (obj && (this.type === 'geometry' || this.type === 'material' || this.type === 'texture')) {
        obj.dispose?.()
      }
    }
  }

  // Get Pool Statistics
  public getStats(): any {
    return {
      type: this.type,
      poolSize: this.pool.length,
      maxSize: this.config.maxSize,
      initialSize: this.config.initialSize,
      createCount: this.createCount,
      acquireCount: this.acquireCount,
      returnCount: this.returnCount,
      hitRate: this.acquireCount > 0 ? (this.acquireCount - this.createCount) / this.acquireCount : 0
    }
  }

  // Dispose Pool
  public dispose(): void {
    // Dispose all objects in pool
    this.pool.forEach(obj => {
      if (obj && (this.type === 'geometry' || this.type === 'material' || this.type === 'texture')) {
        obj.dispose?.()
      }
    })
    
    this.pool.length = 0
  }
}

// Geometry Pool Manager
export class GeometryPoolManager {
  private static sphereGeometries: Map<string, THREE.SphereGeometry[]> = new Map()
  private static boxGeometries: Map<string, THREE.BoxGeometry[]> = new Map()
  private static cylinderGeometries: Map<string, THREE.CylinderGeometry[]> = new Map()

  // Get Sphere Geometry
  public static getSphereGeometry(radius: number, widthSegments: number, heightSegments: number): THREE.SphereGeometry {
    const key = `${radius}_${widthSegments}_${heightSegments}`
    const pool = this.sphereGeometries.get(key) || []

    if (pool.length > 0) {
      return pool.pop()!
    }

    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
    this.sphereGeometries.set(key, pool)
    return geometry
  }

  // Return Sphere Geometry
  public static returnSphereGeometry(geometry: THREE.SphereGeometry, radius: number, widthSegments: number, heightSegments: number): void {
    const key = `${radius}_${widthSegments}_${heightSegments}`
    const pool = this.sphereGeometries.get(key) || []

    if (pool.length < 100) { // Limit pool size
      geometry.dispose()
      return
    }

    pool.push(geometry)
    this.sphereGeometries.set(key, pool)
  }

  // Get Box Geometry
  public static getBoxGeometry(width: number, height: number, depth: number): THREE.BoxGeometry {
    const key = `${width}_${height}_${depth}`
    const pool = this.boxGeometries.get(key) || []

    if (pool.length > 0) {
      return pool.pop()!
    }

    const geometry = new THREE.BoxGeometry(width, height, depth)
    this.boxGeometries.set(key, pool)
    return geometry
  }

  // Return Box Geometry
  public static returnBoxGeometry(geometry: THREE.BoxGeometry, width: number, height: number, depth: number): void {
    const key = `${width}_${height}_${depth}`
    const pool = this.boxGeometries.get(key) || []

    if (pool.length < 100) {
      geometry.dispose()
      return
    }

    pool.push(geometry)
    this.boxGeometries.set(key, pool)
  }

  // Clear All Pools
  public static clearAll(): void {
    this.sphereGeometries.forEach(pool => {
      pool.forEach(geometry => geometry.dispose())
    })
    this.sphereGeometries.clear()

    this.boxGeometries.forEach(pool => {
      pool.forEach(geometry => geometry.dispose())
    })
    this.boxGeometries.clear()

    this.cylinderGeometries.forEach(pool => {
      pool.forEach(geometry => geometry.dispose())
    })
    this.cylinderGeometries.clear()
  }
}

// Material Pool Manager
export class MaterialPoolManager {
  private static standardMaterials: THREE.MeshStandardMaterial[] = []
  private static basicMaterials: THREE.MeshBasicMaterial[] = []

  // Get Standard Material
  public static getStandardMaterial(): THREE.MeshStandardMaterial {
    if (this.standardMaterials.length > 0) {
      const material = this.standardMaterials.pop()!
      this.resetStandardMaterial(material)
      return material
    }

    return new THREE.MeshStandardMaterial()
  }

  // Return Standard Material
  public static returnStandardMaterial(material: THREE.MeshStandardMaterial): void {
    if (this.standardMaterials.length < 200) {
      this.standardMaterials.push(material)
    } else {
      material.dispose()
    }
  }

  // Get Basic Material
  public static getBasicMaterial(): THREE.MeshBasicMaterial {
    if (this.basicMaterials.length > 0) {
      const material = this.basicMaterials.pop()!
      this.resetBasicMaterial(material)
      return material
    }

    return new THREE.MeshBasicMaterial()
  }

  // Return Basic Material
  public static returnBasicMaterial(material: THREE.MeshBasicMaterial): void {
    if (this.basicMaterials.length < 200) {
      this.basicMaterials.push(material)
    } else {
      material.dispose()
    }
  }

  // Reset Standard Material
  private static resetStandardMaterial(material: THREE.MeshStandardMaterial): void {
    material.color.setHex(0xffffff)
    material.metalness = 0
    material.roughness = 1
    material.opacity = 1
    material.transparent = false
    material.emissive.setHex(0x000000)
    material.emissiveIntensity = 0
    material.wireframe = false
  }

  // Reset Basic Material
  private static resetBasicMaterial(material: THREE.MeshBasicMaterial): void {
    material.color.setHex(0xffffff)
    material.opacity = 1
    material.transparent = false
    material.wireframe = false
  }

  // Clear All Pools
  public static clearAll(): void {
    this.standardMaterials.forEach(material => material.dispose())
    this.standardMaterials = []

    this.basicMaterials.forEach(material => material.dispose())
    this.basicMaterials = []
  }
}

// Global Memory Manager Instance
export const globalMemoryManager = new ThreeDMemoryManager()

// Memory Monitor Utility
export class MemoryMonitor {
  private static callbacks: ((stats: any) => void)[] = []
  private static monitoringInterval: number | null = null

  // Start Monitoring
  public static startMonitoring(interval: number = 5000): void {
    if (this.monitoringInterval) return

    this.monitoringInterval = window.setInterval(() => {
      const stats = globalMemoryManager.getMemoryStats()
      this.callbacks.forEach(callback => callback(stats))
    }, interval)
  }

  // Stop Monitoring
  public static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  // Add Callback
  public static addCallback(callback: (stats: any) => void): void {
    this.callbacks.push(callback)
  }

  // Remove Callback
  public static removeCallback(callback: (stats: any) => void): void {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }
}
