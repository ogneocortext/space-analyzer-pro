/**
 * Web Worker for 3D File System Layout Calculations
 * Offloads heavy layout calculations from the main thread
 */

// Layout algorithms
const layoutAlgorithms = {
  tree: (nodes, options) => calculateTreeLayout(nodes, options),
  sphere: (nodes, options) => calculateSphereLayout(nodes, options),
  cylinder: (nodes, options) => calculateCylinderLayout(nodes, options),
  spiral: (nodes, options) => calculateSpiralLayout(nodes, options)
}

// Tree Layout Algorithm
function calculateTreeLayout(nodes, options) {
  const { nodeSize = 1, maxDepth = 5 } = options
  const layoutData = []
  
  const processNode = (node, depth = 0, angle = 0, radius = 0, parent = null) => {
    const size = calculateNodeSize(node, nodeSize)
    const position = {
      x: radius * Math.cos(angle),
      y: -depth * 4,
      z: radius * Math.sin(angle),
      size,
      depth,
      parent
    }
    
    layoutData.push({
      id: node.id,
      position,
      node
    })
    
    if (node.children && depth < maxDepth) {
      const childAngleStep = (Math.PI * 2) / node.children.length
      const childRadius = depth === 0 ? 0 : radius + 4
      
      node.children.forEach((child, index) => {
        const childAngle = angle + (index - node.children.length / 2) * childAngleStep
        processNode(child, depth + 1, childAngle, childRadius, node.id)
      })
    }
  }
  
  if (nodes.length > 0) {
    processNode(nodes[0])
  }
  
  return layoutData
}

// Sphere Layout Algorithm
function calculateSphereLayout(nodes, options) {
  const { nodeSize = 1 } = options
  const layoutData = []
  const sphereRadius = Math.max(10, nodes.length * 0.5)
  
  nodes.forEach((node, index) => {
    const phi = Math.acos(1 - (2 * index) / nodes.length)
    const theta = Math.sqrt(nodes.length * Math.PI) * phi
    
    const position = {
      x: sphereRadius * Math.cos(theta) * Math.sin(phi),
      y: sphereRadius * Math.cos(phi),
      z: sphereRadius * Math.sin(theta) * Math.sin(phi),
      size: calculateNodeSize(node, nodeSize),
      depth: 0
    }
    
    layoutData.push({
      id: node.id,
      position,
      node
    })
  })
  
  return layoutData
}

// Cylinder Layout Algorithm
function calculateCylinderLayout(nodes, options) {
  const { nodeSize = 1 } = options
  const layoutData = []
  const levels = groupByDepth(nodes[0])
  const cylinderHeight = levels.length * 3
  const cylinderRadius = Math.max(10, nodes.length * 0.3)
  
  levels.forEach((levelNodes, depth) => {
    const angleStep = (Math.PI * 2) / levelNodes.length
    const y = -depth * 3
    
    levelNodes.forEach((node, index) => {
      const angle = index * angleStep
      const position = {
        x: cylinderRadius * Math.cos(angle),
        y,
        z: cylinderRadius * Math.sin(angle),
        size: calculateNodeSize(node, nodeSize),
        depth
      }
      
      layoutData.push({
        id: node.id,
        position,
        node
      })
    })
  })
  
  return layoutData
}

// Spiral Layout Algorithm
function calculateSpiralLayout(nodes, options) {
  const { nodeSize = 1 } = options
  const layoutData = []
  
  nodes.forEach((node, index) => {
    const t = index * 0.5
    const radius = 5 + t * 0.3
    const angle = t * 2
    
    const position = {
      x: radius * Math.cos(angle),
      y: -index * 0.5,
      z: radius * Math.sin(angle),
      size: calculateNodeSize(node, nodeSize),
      depth: 0
    }
    
    layoutData.push({
      id: node.id,
      position,
      node
    })
  })
  
  return layoutData
}

// Helper Functions
function calculateNodeSize(node, baseSize) {
  const sizeMultiplier = Math.log(node.size + 1) / Math.log(1024)
  const depthMultiplier = node.path.split('/').length / 10
  return baseSize * (0.5 + sizeMultiplier * 0.5) * (1 + depthMultiplier * 0.2)
}

function groupByDepth(root) {
  const levels = []
  
  const traverse = (node, depth = 0) => {
    if (!levels[depth]) levels[depth] = []
    levels[depth].push(node)
    
    if (node.children) {
      node.children.forEach(child => traverse(child, depth + 1))
    }
  }
  
  traverse(root)
  return levels
}

function flattenFileSystem(root) {
  const nodes = []
  
  const traverse = (node) => {
    nodes.push(node)
    if (node.children) {
      node.children.forEach(traverse)
    }
  }
  
  traverse(root)
  return nodes
}

// Message Handler
self.onmessage = function(e) {
  const { type, data } = e.data
  
  switch (type) {
    case 'calculateLayout':
      try {
        const { layoutType, nodes, options } = data
        const algorithm = layoutAlgorithms[layoutType]
        
        if (!algorithm) {
          throw new Error(`Unknown layout type: ${layoutType}`)
        }
        
        const startTime = performance.now()
        const layoutData = algorithm(nodes, options || {})
        const endTime = performance.now()
        
        self.postMessage({
          type: 'layoutComplete',
          data: {
            layoutData,
            processingTime: endTime - startTime,
            nodeCount: nodes.length
          }
        })
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message
        })
      }
      break
      
    case 'calculateOptimalLayout':
      try {
        const { nodes, constraints } = data
        const bestLayout = findOptimalLayout(nodes, constraints)
        
        self.postMessage({
          type: 'optimalLayoutComplete',
          data: bestLayout
        })
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message
        })
      }
      break
      
    case 'analyzePerformance':
      try {
        const { layoutData, cameraPosition } = data
        const analysis = analyzeLayoutPerformance(layoutData, cameraPosition)
        
        self.postMessage({
          type: 'performanceAnalysisComplete',
          data: analysis
        })
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message
        })
      }
      break
      
    default:
      self.postMessage({
        type: 'error',
        error: `Unknown message type: ${type}`
      })
  }
}

// Find Optimal Layout
function findOptimalLayout(nodes, constraints) {
  const layouts = ['tree', 'sphere', 'cylinder', 'spiral']
  const results = []
  
  layouts.forEach(layoutType => {
    try {
      const startTime = performance.now()
      const layoutData = layoutAlgorithms[layoutType](nodes, constraints)
      const endTime = performance.now()
      
      const score = calculateLayoutScore(layoutData, constraints)
      
      results.push({
        layoutType,
        score,
        processingTime: endTime - startTime,
        layoutData
      })
    } catch (error) {
      console.warn(`Failed to calculate ${layoutType} layout:`, error)
    }
  })
  
  // Sort by score (higher is better)
  results.sort((a, b) => b.score - a.score)
  
  return results[0] || null
}

// Calculate Layout Score
function calculateLayoutScore(layoutData, constraints) {
  let score = 0
  
  // Node distribution score
  const positions = layoutData.map(item => item.position)
  const distributionScore = calculateDistributionScore(positions)
  score += distributionScore * 0.3
  
  // Overlap penalty
  const overlapPenalty = calculateOverlapPenalty(layoutData)
  score -= overlapPenalty * 0.4
  
  // Depth utilization score
  const depthScore = calculateDepthScore(layoutData)
  score += depthScore * 0.2
  
  // Performance score
  const performanceScore = calculatePerformanceScore(layoutData, constraints)
  score += performanceScore * 0.1
  
  return Math.max(0, score)
}

// Calculate Distribution Score
function calculateDistributionScore(positions) {
  if (positions.length < 2) return 1
  
  let totalDistance = 0
  let minDistance = Infinity
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const distance = calculateDistance(positions[i], positions[j])
      totalDistance += distance
      minDistance = Math.min(minDistance, distance)
    }
  }
  
  const avgDistance = totalDistance / (positions.length * (positions.length - 1) / 2)
  const normalizedScore = Math.min(1, avgDistance / 10)
  const minDistanceScore = Math.min(1, minDistance / 2)
  
  return (normalizedScore + minDistanceScore) / 2
}

// Calculate Overlap Penalty
function calculateOverlapPenalty(layoutData) {
  let overlapCount = 0
  
  for (let i = 0; i < layoutData.length; i++) {
    for (let j = i + 1; j < layoutData.length; j++) {
      const node1 = layoutData[i]
      const node2 = layoutData[j]
      
      const distance = calculateDistance(node1.position, node2.position)
      const minDistance = (node1.size + node2.size) * 1.5
      
      if (distance < minDistance) {
        overlapCount++
      }
    }
  }
  
  return overlapCount / layoutData.length
}

// Calculate Depth Score
function calculateDepthScore(layoutData) {
  const depths = layoutData.map(item => item.depth || 0)
  const uniqueDepths = new Set(depths).size
  const maxDepth = Math.max(...depths)
  
  return uniqueDepths / (maxDepth + 1)
}

// Calculate Performance Score
function calculatePerformanceScore(layoutData, constraints) {
  const nodeCount = layoutData.length
  const maxNodes = constraints.maxNodes || 1000
  
  if (nodeCount <= maxNodes) {
    return 1
  } else {
    return Math.max(0, 1 - (nodeCount - maxNodes) / maxNodes)
  }
}

// Analyze Layout Performance
function analyzeLayoutPerformance(layoutData, cameraPosition) {
  const analysis = {
    totalNodes: layoutData.length,
    visibleNodes: 0,
    culledNodes: 0,
    averageDistance: 0,
    minDistance: Infinity,
    maxDistance: 0,
    memoryUsage: 0,
    renderTime: 0
  }
  
  // Calculate distances from camera
  const distances = layoutData.map(item => {
    const distance = calculateDistance(item.position, cameraPosition)
    return distance
  })
  
  analysis.minDistance = Math.min(...distances)
  analysis.maxDistance = Math.max(...distances)
  analysis.averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
  
  // Estimate visible nodes (frustum culling simulation)
  const viewDistance = 100 // Approximate view distance
  analysis.visibleNodes = distances.filter(d => d <= viewDistance).length
  analysis.culledNodes = analysis.totalNodes - analysis.visibleNodes
  
  // Estimate memory usage
  analysis.memoryUsage = analysis.totalNodes * 1024 // Rough estimate in bytes
  
  return analysis
}

// Helper function to calculate distance
function calculateDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x
  const dy = pos1.y - pos2.y
  const dz = pos1.z - pos2.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
