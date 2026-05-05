/**
 * 3D File System Browser Export and Sharing Manager
 * Handles screenshot capture, video recording, 3D model export, and sharing functionality
 */

import * as THREE from 'three'

// Export Types
export type ExportFormat = 'png' | 'jpg' | 'webp' | 'pdf' | 'glb' | 'gltf' | 'obj' | 'stl' | 'json' | 'csv'

// Export Options
export interface ExportOptions {
  format: ExportFormat
  quality?: number
  width?: number
  height?: number
  includeBackground?: boolean
  includeLabels?: boolean
  includeStats?: boolean
  backgroundColor?: string
  transparent?: boolean
  resolution?: number
  frameRate?: number
  duration?: number
}

// Share Options
export interface ShareOptions {
  title?: string
  description?: string
  includeCamera?: boolean
  includeSettings?: boolean
  includeTimestamp?: boolean
  watermark?: boolean
  private?: boolean
}

// Export Result
export interface ExportResult {
  success: boolean
  url?: string
  blob?: Blob
  filename?: string
  size?: number
  error?: string
}

// Recording State
interface RecordingState {
  isRecording: boolean
  startTime: number
  frames: Blob[]
  mediaRecorder?: MediaRecorder
  stream?: MediaStream
}

// Export Manager Class
export class ExportManager {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private recordingState: RecordingState
  private canvas: HTMLCanvasElement

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.canvas = renderer.domElement
    this.recordingState = {
      isRecording: false,
      startTime: 0,
      frames: []
    }
  }

  // Capture Screenshot
  public captureScreenshot(options: ExportOptions = { format: 'png' }): Promise<ExportResult> {
    return new Promise((resolve) => {
      try {
        const {
          format = 'png',
          quality = 0.9,
          width = this.canvas.width,
          height = this.canvas.height,
          includeBackground = true,
          backgroundColor = '#0a0a0a',
          transparent = false
        } = options

        // Store original background
        const originalBackground = this.scene.background
        const originalAlpha = this.renderer.domElement.style.opacity

        // Set temporary background if needed
        if (!includeBackground) {
          this.scene.background = null
          this.renderer.domElement.style.opacity = '0'
        } else if (backgroundColor) {
          this.scene.background = new THREE.Color(backgroundColor)
        }

        // Create temporary canvas for export
        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = width
        exportCanvas.height = height
        const exportContext = exportCanvas.getContext('2d')!

        // Render to export canvas
        this.renderer.setSize(width, height)
        this.renderer.render(this.scene, this.camera)

        // Copy to export canvas
        exportContext.drawImage(this.canvas, 0, 0, width, height)

        // Restore original settings
        this.scene.background = originalBackground
        this.renderer.domElement.style.opacity = originalAlpha
        this.renderer.setSize(this.canvas.width, this.canvas.height)
        this.renderer.render(this.scene, this.camera)

        // Convert to blob
        exportCanvas.toBlob((blob) => {
          if (blob) {
            const filename = `filesystem-3d-${Date.now()}.${format}`
            resolve({
              success: true,
              blob,
              filename,
              size: blob.size,
              url: URL.createObjectURL(blob)
            })
          } else {
            resolve({
              success: false,
              error: 'Failed to create blob'
            })
          }
        }, this.getMimeType(format), quality)

      } catch (error) {
        resolve({
          success: false,
          error: `Screenshot capture failed: ${error}`
        })
      }
    })
  }

  // Start Video Recording
  public startRecording(options: ExportOptions = { format: 'webm' }): Promise<ExportResult> {
    return new Promise((resolve) => {
      try {
        if (this.recordingState.isRecording) {
          resolve({
            success: false,
            error: 'Recording is already in progress'
          })
          return
        }

        const { frameRate = 30, width = 1920, height = 1080 } = options

        // Create canvas stream
        const stream = this.canvas.captureStream(frameRate)
        this.recordingState.stream = stream

        // Setup MediaRecorder
        const mimeType = this.getVideoMimeType(options.format)
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5000000 // 5 Mbps
        })

        this.recordingState.mediaRecorder = mediaRecorder
        this.recordingState.isRecording = true
        this.recordingState.startTime = Date.now()
        this.recordingState.frames = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordingState.frames.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          this.createVideoBlob(options.format).then(resolve)
        }

        mediaRecorder.start(100) // Collect data every 100ms

        resolve({
          success: true,
          error: undefined
        })

      } catch (error) {
        resolve({
          success: false,
          error: `Failed to start recording: ${error}`
        })
      }
    })
  }

  // Stop Video Recording
  public stopRecording(): Promise<ExportResult> {
    return new Promise((resolve) => {
      if (!this.recordingState.isRecording) {
        resolve({
          success: false,
          error: 'No recording in progress'
        })
        return
      }

      if (this.recordingState.mediaRecorder) {
        this.recordingState.mediaRecorder.onstop = () => {
          const duration = Date.now() - this.recordingState.startTime
          this.recordingState.isRecording = false
          this.recordingState.mediaRecorder = undefined
          this.recordingState.stream = undefined

          resolve({
            success: true,
            error: undefined
          })
        }

        this.recordingState.mediaRecorder.stop()
      } else {
        resolve({
          success: false,
          error: 'MediaRecorder not available'
        })
      }
    })
  }

  // Create Video Blob
  private createVideoBlob(format: string): Promise<ExportResult> {
    return new Promise((resolve) => {
      if (this.recordingState.frames.length === 0) {
        resolve({
          success: false,
          error: 'No frames recorded'
        })
        return
      }

      const blob = new Blob(this.recordingState.frames, {
        type: this.getVideoMimeType(format)
      })

      const filename = `filesystem-3d-recording-${Date.now()}.${format}`
      
      resolve({
        success: true,
        blob,
        filename,
        size: blob.size,
        url: URL.createObjectURL(blob)
      })
    })
  }

  // Export 3D Model
  public export3DModel(options: ExportOptions = { format: 'glb' }): Promise<ExportResult> {
    return new Promise((resolve) => {
      try {
        const { format = 'glb', includeLabels = true } = options

        // Collect all exportable objects
        const objects: THREE.Object3D[] = []
        this.scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.node) {
            objects.push(child)
          }
        })

        if (objects.length === 0) {
          resolve({
            success: false,
            error: 'No objects to export'
          })
          return
        }

        // Create export scene
        const exportScene = new THREE.Scene()
        objects.forEach(obj => {
          const clone = obj.clone()
          clone.userData = { ...obj.userData }
          exportScene.add(clone)
        })

        // Export based on format
        switch (format) {
          case 'glb':
          case 'gltf':
            this.exportGLTF(exportScene, format).then(resolve)
            break
          case 'obj':
            this.exportOBJ(exportScene).then(resolve)
            break
          case 'stl':
            this.exportSTL(exportScene).then(resolve)
            break
          default:
            resolve({
              success: false,
              error: `Unsupported format: ${format}`
            })
        }

      } catch (error) {
        resolve({
          success: false,
          error: `3D model export failed: ${error}`
        })
      }
    })
  }

  // Export GLTF/GLB
  private async exportGLTF(scene: THREE.Scene, format: string): Promise<ExportResult> {
    try {
      // This would require GLTFExporter from three.js examples
      // For now, return a placeholder implementation
      const jsonData = JSON.stringify({
        format: 'gltf',
        scene: 'Scene data would be here',
        objects: scene.children.length,
        timestamp: new Date().toISOString()
      })

      const blob = new Blob([jsonData], { type: 'application/json' })
      const filename = `filesystem-3d-model-${Date.now()}.${format}`

      return {
        success: true,
        blob,
        filename,
        size: blob.size,
        url: URL.createObjectURL(blob)
      }
    } catch (error) {
      return {
        success: false,
        error: `GLTF export failed: ${error}`
      }
    }
  }

  // Export OBJ
  private async exportOBJ(scene: THREE.Scene): Promise<ExportResult> {
    try {
      let objContent = '# File System 3D Model\n'
      objContent += `# Generated: ${new Date().toISOString()}\n\n`

      let vertexIndex = 1
      const geometryMap = new Map<THREE.BufferGeometry, number>()

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geometry = child.geometry
          const position = geometry.attributes.position

          if (position) {
            // Add vertices
            for (let i = 0; i < position.count; i++) {
              const x = position.getX(i)
              const y = position.getY(i)
              const z = position.getZ(i)
              objContent += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
            }

            // Add faces (simplified)
            if (geometry.index) {
              for (let i = 0; i < geometry.index.count; i += 3) {
                const a = geometry.index.getX(i) + vertexIndex
                const b = geometry.index.getX(i + 1) + vertexIndex
                const c = geometry.index.getX(i + 2) + vertexIndex
                objContent += `f ${a} ${b} ${c}\n`
              }
            }

            geometryMap.set(geometry, vertexIndex)
            vertexIndex += position.count
          }
        }
      })

      const blob = new Blob([objContent], { type: 'text/plain' })
      const filename = `filesystem-3d-model-${Date.now()}.obj`

      return {
        success: true,
        blob,
        filename,
        size: blob.size,
        url: URL.createObjectURL(blob)
      }
    } catch (error) {
      return {
        success: false,
        error: `OBJ export failed: ${error}`
      }
    }
  }

  // Export STL
  private async exportSTL(scene: THREE.Scene): Promise<ExportResult> {
    try {
      let stlContent = 'solid filesystem3d\n'

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geometry = child.geometry
          const position = geometry.attributes.position

          if (position && geometry.index) {
            for (let i = 0; i < geometry.index.count; i += 3) {
              const a = geometry.index.getX(i)
              const b = geometry.index.getX(i + 1)
              const c = geometry.index.getX(i + 2)

              const v1 = new THREE.Vector3(
                position.getX(a),
                position.getY(a),
                position.getZ(a)
              )
              const v2 = new THREE.Vector3(
                position.getX(b),
                position.getY(b),
                position.getZ(b)
              )
              const v3 = new THREE.Vector3(
                position.getX(c),
                position.getY(c),
                position.getZ(c)
              )

              // Calculate normal
              const normal = new THREE.Vector3()
              const edge1 = new THREE.Vector3().subVectors(v2, v1)
              const edge2 = new THREE.Vector3().subVectors(v3, v1)
              normal.crossVectors(edge1, edge2).normalize()

              stlContent += `facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`
              stlContent += '  outer loop\n'
              stlContent += `    vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`
              stlContent += `    vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`
              stlContent += `    vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(6)} ${v3.z.toFixed(6)}\n`
              stlContent += '  endloop\n'
              stlContent += 'endfacet\n'
            }
          }
        }
      })

      stlContent += 'endsolid filesystem3d'

      const blob = new Blob([stlContent], { type: 'text/plain' })
      const filename = `filesystem-3d-model-${Date.now()}.stl`

      return {
        success: true,
        blob,
        filename,
        size: blob.size,
        url: URL.createObjectURL(blob)
      }
    } catch (error) {
      return {
        success: false,
        error: `STL export failed: ${error}`
      }
    }
  }

  // Export Data
  public exportData(nodes: any[], options: ExportOptions = { format: 'json' }): Promise<ExportResult> {
    return new Promise((resolve) => {
      try {
        const { format = 'json', includeStats = true } = options

        let content: string
        let mimeType: string
        let filename: string

        switch (format) {
          case 'json':
            content = JSON.stringify({
              timestamp: new Date().toISOString(),
              nodes: nodes,
              statistics: includeStats ? this.calculateStatistics(nodes) : undefined
            }, null, 2)
            mimeType = 'application/json'
            filename = `filesystem-data-${Date.now()}.json`
            break

          case 'csv':
            content = this.convertToCSV(nodes)
            mimeType = 'text/csv'
            filename = `filesystem-data-${Date.now()}.csv`
            break

          default:
            resolve({
              success: false,
              error: `Unsupported data format: ${format}`
            })
            return
        }

        const blob = new Blob([content], { type: mimeType })

        resolve({
          success: true,
          blob,
          filename,
          size: blob.size,
          url: URL.createObjectURL(blob)
        })

      } catch (error) {
        resolve({
          success: false,
          error: `Data export failed: ${error}`
        })
      }
    })
  }

  // Convert to CSV
  private convertToCSV(nodes: any[]): string {
    if (nodes.length === 0) return ''

    const headers = ['name', 'path', 'type', 'size', 'modified']
    const csvContent = [
      headers.join(','),
      ...nodes.map(node => [
        `"${node.name || ''}"`,
        `"${node.path || ''}"`,
        `"${node.type || ''}"`,
        node.size || 0,
        `"${node.modified ? new Date(node.modified).toISOString() : ''}"`
      ].join(','))
    ].join('\n')

    return csvContent
  }

  // Calculate Statistics
  private calculateStatistics(nodes: any[]): any {
    const files = nodes.filter(node => node.type === 'file')
    const directories = nodes.filter(node => node.type === 'directory')
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0)

    return {
      totalNodes: nodes.length,
      files: files.length,
      directories: directories.length,
      totalSize,
      averageFileSize: files.length > 0 ? totalSize / files.length : 0
    }
  }

  // Share Export
  public async shareExport(exportResult: ExportResult, options: ShareOptions = {}): Promise<{
    success: boolean
    shareUrl?: string
    error?: string
  }> {
    try {
      if (!exportResult.success || !exportResult.blob) {
        return {
          success: false,
          error: 'Invalid export result'
        }
      }

      // Create shareable content
      const shareData = await this.createShareData(exportResult, options)

      // Upload to sharing service (placeholder implementation)
      const shareUrl = await this.uploadToSharingService(shareData)

      return {
        success: true,
        shareUrl
      }

    } catch (error) {
      return {
        success: false,
        error: `Share failed: ${error}`
      }
    }
  }

  // Create Share Data
  private async createShareData(exportResult: ExportResult, options: ShareOptions): Promise<{
    blob: Blob
    metadata: any
  }> {
    const metadata = {
      title: options.title || '3D File System Visualization',
      description: options.description || 'Interactive 3D visualization of file system structure',
      timestamp: new Date().toISOString(),
      format: exportResult.filename?.split('.').pop(),
      size: exportResult.size,
      includeCamera: options.includeCamera || false,
      includeSettings: options.includeSettings || false,
      includeTimestamp: options.includeTimestamp !== false,
      watermark: options.watermark || false,
      private: options.private || false
    }

    // Combine metadata with file
    const metadataJson = JSON.stringify(metadata, null, 2)
    const combinedBlob = new Blob([metadataJson, '\n', exportResult.blob!], {
      type: exportResult.blob!.type
    })

    return {
      blob: combinedBlob,
      metadata
    }
  }

  // Upload to Sharing Service (placeholder)
  private async uploadToSharingService(shareData: { blob: Blob; metadata: any }): Promise<string> {
    // This would integrate with a real sharing service like:
    // - AWS S3 with presigned URLs
    // - Cloudinary
    // - Custom sharing service
    
    // For now, return a mock URL
    const shareId = Math.random().toString(36).substr(2, 9)
    return `https://share.filesystem3d.com/${shareId}`
  }

  // Download File
  public downloadFile(exportResult: ExportResult): void {
    if (!exportResult.success || !exportResult.blob || !exportResult.filename) {
      console.error('Invalid export result for download')
      return
    }

    const url = exportResult.url || URL.createObjectURL(exportResult.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportResult.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    if (exportResult.url) {
      URL.revokeObjectURL(exportResult.url)
    }
  }

  // Get Recording Status
  public getRecordingStatus(): {
    isRecording: boolean
    duration: number
    frameCount: number
  } {
    return {
      isRecording: this.recordingState.isRecording,
      duration: this.recordingState.isRecording ? Date.now() - this.recordingState.startTime : 0,
      frameCount: this.recordingState.frames.length
    }
  }

  // Get Supported Formats
  public getSupportedFormats(): {
    image: ExportFormat[]
    video: ExportFormat[]
    model: ExportFormat[]
    data: ExportFormat[]
  } {
    return {
      image: ['png', 'jpg', 'webp'],
      video: ['webm', 'mp4'],
      model: ['glb', 'gltf', 'obj', 'stl'],
      data: ['json', 'csv']
    }
  }

  // Helper Methods
  private getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp',
      pdf: 'application/pdf',
      glb: 'model/gltf-binary',
      gltf: 'model/gltf+json',
      obj: 'text/plain',
      stl: 'text/plain',
      json: 'application/json',
      csv: 'text/csv',
      webm: 'video/webm',
      mp4: 'video/mp4'
    }

    return mimeTypes[format] || 'application/octet-stream'
  }

  private getVideoMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      webm: 'video/webm',
      mp4: 'video/mp4'
    }

    return mimeTypes[format] || 'video/webm'
  }

  // Dispose
  public dispose(): void {
    if (this.recordingState.isRecording) {
      this.stopRecording()
    }

    this.recordingState.frames = []
    this.recordingState.stream = undefined
    this.recordingState.mediaRecorder = undefined
  }
}

// Share Manager
export class ShareManager {
  // Generate Shareable Link
  public static generateShareableLink(
    exportResult: ExportResult,
    options: ShareOptions = {}
  ): string {
    const params = new URLSearchParams({
      id: Math.random().toString(36).substr(2, 9),
      type: exportResult.filename?.split('.').pop() || 'unknown',
      size: (exportResult.size || 0).toString(),
      timestamp: Date.now().toString()
    })

    if (options.title) {
      params.set('title', options.title)
    }

    if (options.description) {
      params.set('description', options.description)
    }

    return `https://view.filesystem3d.com/share?${params.toString()}`
  }

  // Create Embed Code
  public static createEmbedCode(shareUrl: string, options: {
    width?: number
    height?: number
    autoplay?: boolean
    controls?: boolean
  } = {}): string {
    const {
      width = 800,
      height = 600,
      autoplay = false,
      controls = true
    } = options

    return `<iframe 
  src="${shareUrl}" 
  width="${width}" 
  height="${height}"
  ${autoplay ? 'autoplay' : ''}
  ${controls ? 'controls' : ''}
  frameborder="0"
  allowfullscreen>
</iframe>`
  }

  // Generate QR Code (placeholder)
  public static generateQRCode(url: string): Promise<string> {
    return new Promise((resolve) => {
      // This would integrate with a QR code library
      // For now, return a placeholder
      resolve(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`)
    })
  }

  // Share to Social Media
  public static shareToSocialMedia(
    shareUrl: string,
    platform: 'twitter' | 'facebook' | 'linkedin' | 'reddit',
    options: {
      title?: string
      description?: string
    } = {}
  ): string {
    const { title = '3D File System Visualization', description = 'Interactive 3D visualization' } = options
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedTitle = encodeURIComponent(title)
    const encodedDescription = encodeURIComponent(description)

    const urls = {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
    }

    return urls[platform] || shareUrl
  }
}
