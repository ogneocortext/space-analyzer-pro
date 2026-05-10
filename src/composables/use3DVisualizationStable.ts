import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { ResourceManager } from '@/core/ResourceManager'
import { GracefulDegradation, DegradationLevel } from '@/core/GracefulDegradation'
import { RetryHandler } from '@/utils/RetryHandler'

export interface VisualizationConfig {
  maxObjects: number
  memoryThreshold: number
  lodLevels: number
  frustumCulling: boolean
  autoCleanup: boolean
  fallbackTo2D: boolean
}

export interface VisualizationStats {
  objectCount: number
  drawCalls: number
  memoryUsage: number
  frameRate: number
  renderTime: number
}

export function use3DVisualizationStable(canvas: HTMLCanvasElement, config: Partial<VisualizationConfig> = {}) {
  const scene = ref<THREE.Scene | null>(null)
  const renderer = ref<THREE.WebGLRenderer | null>(null)
  const camera = ref<THREE.PerspectiveCamera | null>(null)
  const animationId = ref<number | null>(null)
  const isDestroyed = ref(false)
  const isInitialized = ref(false)
  const stats = ref<VisualizationStats>({
    objectCount: 0,
    drawCalls: 0,
    memoryUsage: 0,
    frameRate: 0,
    renderTime: 0
  })

  const finalConfig: VisualizationConfig = {
    maxObjects: 10000,
    memoryThreshold: 512 * 1024 * 1024, // 512MB
    lodLevels: 3,
    frustumCulling: true,
    autoCleanup: true,
    fallbackTo2D: true,
    ...config
  }

  const resourceManager = ResourceManager.getInstance()
  const degradations = GracefulDegradation.getInstance()
  const visualizationId = `3d-viz-${Math.random().toString(36).substr(2, 9)}`

  // Initialize 3D visualization with error handling
  const initialize = async () => {
    try {
      await degradations.executeFeature('3d-visualization', async () => {
        return await createThreeJSContext()
      }, () => {
        console.warn('3D visualization unavailable, falling back to 2D')
        return createFallbackRenderer()
      })
      
      isInitialized.value = true
      setupEventListeners()
      startRenderLoop()
    } catch (error) {
      console.error('Failed to initialize 3D visualization:', error)
      throw error
    }
  }

  const createThreeJSContext = async (): Promise<void> => {
    if (!canvas) throw new Error('Canvas element required')

    // Create scene
    scene.value = new THREE.Scene()
    scene.value.fog = new THREE.Fog(0x000000, 1, 1000)

    // Create renderer with memory optimization
    renderer.value = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      logarithmicDepthBuffer: true
    })

    renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.value.setSize(canvas.clientWidth, canvas.clientHeight)
    renderer.value.shadowMap.enabled = true
    renderer.value.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.value.info.autoReset = false

    // Create camera
    const aspect = canvas.clientWidth / canvas.clientHeight
    camera.value = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    camera.value.position.set(10, 10, 10)
    camera.value.lookAt(0, 0, 0)

    // Register WebGL resources for cleanup
    resourceManager.register(`${visualizationId}-renderer`, renderer.value, {
      name: 'WebGL Renderer',
      type: 'webgl',
      priority: 'high',
      cleanup: (resource) => {
        resource.dispose()
        resource.forceContextLoss()
      }
    })

    resourceManager.register(`${visualizationId}-scene`, scene.value, {
      name: 'Three.js Scene',
      type: 'memory',
      priority: 'high',
      cleanup: (resource) => {
        // Clear all objects from scene
        while (resource.children.length > 0) {
          const child = resource.children[0]
          resource.remove(child)
          disposeObject(child)
        }
      }
    })

    // Check for memory issues
    checkMemoryUsage()
  }

  const createFallbackRenderer = (): void => {
    console.log('Creating 2D fallback renderer')
    // Implementation for 2D fallback
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Basic 2D rendering setup
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '16px Arial'
      ctx.fillText('3D visualization unavailable - using 2D mode', 10, 30)
    }
  }

  const disposeObject = (obj: any): void => {
    if (!obj) return

    // Dispose geometries
    if (obj.geometry) {
      obj.geometry.dispose()
    }

    // Dispose materials
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(material => material.dispose())
      } else {
        obj.material.dispose()
      }
    }

    // Dispose textures
    if (obj.texture) {
      obj.texture.dispose()
    }

    // Remove from parent
    if (obj.parent) {
      obj.parent.remove(obj)
    }
  }

  const checkMemoryUsage = (): void => {
    if (!renderer.value) return

    const info = renderer.value.info
    const memory = info.memory?.geometries || 0
    stats.value.memoryUsage = memory

    if (memory > finalConfig.memoryThreshold) {
      console.warn('3D memory usage high, performing cleanup')
      performMemoryCleanup()
    }
  }

  const performMemoryCleanup = (): void => {
    if (!scene.value) return

    const objectsToRemove: THREE.Object3D[] = []
    const lodObjects: THREE.Object3D[] = []

    scene.value.traverse((child) => {
      // Implement LOD (Level of Detail) logic
      if (child.userData.distance && child.userData.lodLevel) {
        lodObjects.push(child)
      }

      // Remove objects that are too far or not visible
      if (child.userData.canRemove) {
        objectsToRemove.push(child)
      }
    })

    // Remove distant objects
    objectsToRemove.forEach(obj => {
      scene.value!.remove(obj)
      disposeObject(obj)
    })

    // Update LOD levels
    lodObjects.forEach(obj => {
      updateLODLevel(obj)
    })

    // Force garbage collection
    if (window.gc) {
      window.gc()
    }

    console.log(`Cleaned up ${objectsToRemove.length} objects, updated ${lodObjects.length} LOD levels`)
  }

  const updateLODLevel = (obj: THREE.Object3D): void => {
    if (!camera.value) return

    const distance = camera.value.position.distanceTo(obj.position)
    const lodLevel = Math.floor(distance / 50) // Adjust distance threshold as needed

    if (lodLevel !== obj.userData.currentLOD) {
      obj.userData.currentLOD = lodLevel
      
      // Update geometry/material based on LOD level
      if (lodLevel >= finalConfig.lodLevels) {
        obj.visible = false
      } else {
        obj.visible = true
        // Update to lower detail geometry/material
        updateLODMesh(obj, lodLevel)
      }
    }
  }

  const updateLODMesh = (obj: THREE.Object3D, level: number): void => {
    // Implementation for LOD mesh updates
    // This would swap to lower-poly geometries/materials
  }

  const startRenderLoop = (): void => {
    if (isDestroyed.value || !renderer.value || !scene.value || !camera.value) return

    const render = (time: number) => {
      if (isDestroyed.value) return

      const startTime = performance.now()

      // Frustum culling
      if (finalConfig.frustumCulling) {
        performFrustumCulling()
      }

      // Render scene
      renderer.value!.render(scene.value!, camera.value!)

      // Update stats
      const renderTime = performance.now() - startTime
      stats.value.renderTime = renderTime
      stats.value.frameRate = 1000 / renderTime
      stats.value.drawCalls = renderer.value!.info.render.calls

      animationId.value = requestAnimationFrame(render)
    }

    animationId.value = requestAnimationFrame(render)
  }

  const performFrustumCulling = (): void => {
    if (!camera.value || !scene.value) return

    const frustum = new THREE.Frustum()
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      camera.value.projectionMatrix,
      camera.value.matrixWorldInverse
    )
    frustum.setFromProjectionMatrix(cameraMatrix)

    scene.value.traverse((child) => {
      if (child.isMesh) {
        child.visible = frustum.intersectsObject(child)
      }
    })
  }

  const setupEventListeners = (): void => {
    if (!canvas) return

    const handleResize = () => {
      if (!camera.value || !renderer.value) return

      const width = canvas.clientWidth
      const height = canvas.clientHeight

      camera.value.aspect = width / height
      camera.value.updateProjectionMatrix()
      renderer.value.setSize(width, height)
    }

    const handleClick = (event: MouseEvent) => {
      // Handle 3D object selection
      performRaycast(event)
    }

    window.addEventListener('resize', handleResize)
    canvas.addEventListener('click', handleClick)

    // Register event listeners for cleanup
    resourceManager.register(`${visualizationId}-resize-listener`, () => {
      window.removeEventListener('resize', handleResize)
    }, {
      name: 'Resize Listener',
      type: 'event',
      priority: 'medium'
    })

    resourceManager.register(`${visualizationId}-click-listener`, () => {
      canvas.removeEventListener('click', handleClick)
    }, {
      name: 'Click Listener',
      type: 'event',
      priority: 'medium'
    })
  }

  const performRaycast = (event: MouseEvent): void => {
    if (!camera.value || !scene.value || !renderer.value) return

    const rect = canvas.getBoundingClientRect()
    const mouse = new THREE.Vector2()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera.value)

    const intersects = raycaster.intersectObjects(scene.value.children, true)
    
    if (intersects.length > 0) {
      console.log('Selected object:', intersects[0].object)
      // Handle object selection
    }
  }

  // Public methods
  const addObject = (obj: THREE.Object3D): void => {
    if (!scene.value) return

    if (scene.value.children.length >= finalConfig.maxObjects) {
      console.warn('Maximum object limit reached')
      performMemoryCleanup()
    }

    scene.value.add(obj)
    stats.value.objectCount = scene.value.children.length
  }

  const removeObject = (obj: THREE.Object3D): void => {
    if (!scene.value) return

    scene.value.remove(obj)
    disposeObject(obj)
    stats.value.objectCount = scene.value.children.length
  }

  const resetCamera = (): void => {
    if (!camera.value) return

    camera.value.position.set(10, 10, 10)
    camera.value.lookAt(0, 0, 0)
  }

  const destroy = (): void => {
    if (isDestroyed.value) return

    isDestroyed.value = true

    // Stop animation loop
    if (animationId.value) {
      cancelAnimationFrame(animationId.value)
      animationId.value = null
    }

    // Clean up all resources
    resourceManager.unregister(`${visualizationId}-renderer`)
    resourceManager.unregister(`${visualizationId}-scene`)
    resourceManager.unregister(`${visualizationId}-resize-listener`)
    resourceManager.unregister(`${visualizationId}-click-listener`)

    // Clear references
    scene.value = null
    renderer.value = null
    camera.value = null

    console.log('3D visualization destroyed')
  }

  // Auto-cleanup on component unmount
  onUnmounted(() => {
    destroy()
  })

  // Initialize on mount
  onMounted(async () => {
    await RetryHandler.execute(initialize, {
      maxRetries: 3,
      baseDelay: 1000,
      retryCondition: (error) => {
        return error.message?.includes('WebGL') || 
               error.message?.includes('context') ||
               error.message?.includes('GPU')
      }
    })
  })

  return {
    // Reactive refs
    scene,
    renderer,
    camera,
    stats,
    isInitialized,
    isDestroyed,

    // Methods
    initialize,
    addObject,
    removeObject,
    resetCamera,
    destroy,

    // Utility methods
    checkMemoryUsage,
    performMemoryCleanup
  }
}