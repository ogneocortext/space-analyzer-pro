/**
 * Web Worker for File System Operations
 * Handles file system scanning, filtering, and analysis
 */

// File system operations
const fileSystemOperations = {
  scanDirectory: scanDirectory,
  filterFiles: filterFiles,
  searchFiles: searchFiles,
  analyzeFileTypes: analyzeFileTypes,
  calculateStatistics: calculateStatistics,
  generateHeatMapData: generateHeatMapData
}

// Scan Directory
function scanDirectory(rootPath, options = {}) {
  const { maxDepth = 5, maxFiles = 10000, includeHidden = false } = options
  const results = {
    root: null,
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    scanTime: 0,
    errors: []
  }
  
  const startTime = performance.now()
  
  try {
    // Simulate directory scanning (in real implementation, use Node.js fs or browser APIs)
    const mockFileSystem = generateMockFileSystem(rootPath, maxDepth, maxFiles)
    results.root = mockFileSystem
    
    // Calculate statistics
    const stats = calculateFileSystemStats(mockFileSystem)
    results.totalFiles = stats.files
    results.totalDirectories = stats.directories
    results.totalSize = stats.size
    
  } catch (error) {
    results.errors.push(error.message)
  }
  
  results.scanTime = performance.now() - startTime
  return results
}

// Generate Mock File System
function generateMockFileSystem(rootPath, maxDepth, maxFiles) {
  const root = {
    id: 'root',
    name: rootPath.split('/').pop() || rootPath,
    path: rootPath,
    type: 'directory',
    size: 0,
    modified: new Date(),
    children: []
  }
  
  const directories = ['Documents', 'Downloads', 'Pictures', 'Videos', 'Music', 'Projects', 'Code', 'Games']
  const fileTypes = {
    document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
    code: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
    spreadsheet: ['xls', 'xlsx', 'csv', 'ods']
  }
  
  let fileCount = 0
  
  const createDirectory = (name, path, depth) => {
    if (depth >= maxDepth || fileCount >= maxFiles) return null
    
    const dir = {
      id: `dir-${Math.random().toString(36).substr(2, 9)}`,
      name,
      path: `${path}/${name}`,
      type: 'directory',
      size: 0,
      modified: new Date(Date.now() - Math.random() * 10000000000),
      children: []
    }
    
    // Add files to directory
    const fileCountInDir = Math.floor(Math.random() * 20) + 5
    
    for (let i = 0; i < fileCountInDir && fileCount < maxFiles; i++) {
      const fileType = Object.keys(fileTypes)[Math.floor(Math.random() * Object.keys(fileTypes).length)]
      const extensions = fileTypes[fileType]
      const extension = extensions[Math.floor(Math.random() * extensions.length)]
      const fileName = `file${i}.${extension}`
      
      const file = {
        id: `file-${Math.random().toString(36).substr(2, 9)}`,
        name: fileName,
        path: `${path}/${name}/${fileName}`,
        type: 'file',
        size: Math.floor(Math.random() * 10000000) + 1000,
        modified: new Date(Date.now() - Math.random() * 10000000000),
        fileType
      }
      
      dir.children.push(file)
      dir.size += file.size
      fileCount++
    }
    
    // Add subdirectories
    const subDirCount = Math.floor(Math.random() * 3)
    
    for (let i = 0; i < subDirCount; i++) {
      const subDirName = `subdir${i}`
      const subDir = createDirectory(subDirName, `${path}/${name}`, depth + 1)
      
      if (subDir) {
        dir.children.push(subDir)
        dir.size += subDir.size
      }
    }
    
    return dir
  }
  
  // Create main directories
  directories.forEach(dirName => {
    const dir = createDirectory(dirName, rootPath, 1)
    if (dir) {
      root.children.push(dir)
      root.size += dir.size
    }
  })
  
  return root
}

// Calculate File System Statistics
function calculateFileSystemStats(root) {
  const stats = {
    files: 0,
    directories: 0,
    size: 0,
    fileTypes: {},
    sizeDistribution: {
      small: 0,    // < 1MB
      medium: 0,   // 1MB - 10MB
      large: 0,    // 10MB - 100MB
      xlarge: 0    // > 100MB
    }
  }
  
  const traverse = (node) => {
    if (node.type === 'file') {
      stats.files++
      stats.size += node.size
      
      // File type statistics
      const extension = node.name.split('.').pop()?.toLowerCase()
      if (extension) {
        stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1
      }
      
      // Size distribution
      if (node.size < 1024 * 1024) {
        stats.sizeDistribution.small++
      } else if (node.size < 10 * 1024 * 1024) {
        stats.sizeDistribution.medium++
      } else if (node.size < 100 * 1024 * 1024) {
        stats.sizeDistribution.large++
      } else {
        stats.sizeDistribution.xlarge++
      }
    } else {
      stats.directories++
    }
    
    if (node.children) {
      node.children.forEach(traverse)
    }
  }
  
  traverse(root)
  return stats
}

// Filter Files
function filterFiles(files, filters) {
  const {
    fileTypes = [],
    sizeRange = { min: 0, max: Infinity },
    dateRange = { start: null, end: null },
    namePattern = null
  } = filters
  
  return files.filter(file => {
    // File type filter
    if (fileTypes.length > 0) {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !fileTypes.includes(extension)) {
        return false
      }
    }
    
    // Size filter
    if (file.size < sizeRange.min || file.size > sizeRange.max) {
      return false
    }
    
    // Date filter
    if (dateRange.start && file.modified < dateRange.start) {
      return false
    }
    if (dateRange.end && file.modified > dateRange.end) {
      return false
    }
    
    // Name pattern filter
    if (namePattern) {
      const regex = new RegExp(namePattern, 'i')
      if (!regex.test(file.name)) {
        return false
      }
    }
    
    return true
  })
}

// Search Files
function searchFiles(files, query, options = {}) {
  const { caseSensitive = false, fuzzy = false, maxResults = 100 } = options
  const results = []
  
  const searchQuery = caseSensitive ? query : query.toLowerCase()
  
  for (const file of files) {
    if (results.length >= maxResults) break
    
    const fileName = caseSensitive ? file.name : file.name.toLowerCase()
    
    if (fuzzy) {
      // Fuzzy search implementation
      const score = calculateFuzzyScore(fileName, searchQuery)
      if (score > 0.5) {
        results.push({
          file,
          score,
          match: fileName
        })
      }
    } else {
      // Exact match search
      if (fileName.includes(searchQuery)) {
        results.push({
          file,
          score: 1.0,
          match: fileName
        })
      }
    }
  }
  
  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score)
  
  return results
}

// Calculate Fuzzy Search Score
function calculateFuzzyScore(str, query) {
  if (query.length === 0) return 0
  if (str.length === 0) return 0
  
  let score = 0
  let queryIndex = 0
  let strIndex = 0
  
  while (queryIndex < query.length && strIndex < str.length) {
    if (str[strIndex] === query[queryIndex]) {
      score += 1
      queryIndex++
    }
    strIndex++
  }
  
  // Normalize score
  return score / query.length
}

// Analyze File Types
function analyzeFileTypes(files) {
  const analysis = {
    totalFiles: files.length,
    typeDistribution: {},
    sizeByType: {},
    averageSizeByType: {},
    mostCommonType: null,
    largestType: null
  }
  
  files.forEach(file => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown'
    
    // Count files by type
    analysis.typeDistribution[extension] = (analysis.typeDistribution[extension] || 0) + 1
    
    // Sum sizes by type
    analysis.sizeByType[extension] = (analysis.sizeByType[extension] || 0) + file.size
  })
  
  // Calculate average sizes
  Object.keys(analysis.typeDistribution).forEach(type => {
    analysis.averageSizeByType[type] = analysis.sizeByType[type] / analysis.typeDistribution[type]
  })
  
  // Find most common type
  const typeEntries = Object.entries(analysis.typeDistribution)
  if (typeEntries.length > 0) {
    analysis.mostCommonType = typeEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
  }
  
  // Find largest type by total size
  const sizeEntries = Object.entries(analysis.sizeByType)
  if (sizeEntries.length > 0) {
    analysis.largestType = sizeEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
  }
  
  return analysis
}

// Calculate Statistics
function calculateStatistics(files) {
  if (files.length === 0) {
    return {
      count: 0,
      totalSize: 0,
      averageSize: 0,
      medianSize: 0,
      minSize: 0,
      maxSize: 0,
      sizeDistribution: {}
    }
  }
  
  const sizes = files.map(file => file.size).sort((a, b) => a - b)
  const totalSize = sizes.reduce((sum, size) => sum + size, 0)
  
  const statistics = {
    count: files.length,
    totalSize,
    averageSize: totalSize / files.length,
    medianSize: sizes[Math.floor(sizes.length / 2)],
    minSize: sizes[0],
    maxSize: sizes[sizes.length - 1],
    sizeDistribution: {}
  }
  
  // Calculate size distribution
  const distribution = {
    small: 0,    // < 1MB
    medium: 0,   // 1MB - 10MB
    large: 0,    // 10MB - 100MB
    xlarge: 0    // > 100MB
  }
  
  files.forEach(file => {
    if (file.size < 1024 * 1024) {
      distribution.small++
    } else if (file.size < 10 * 1024 * 1024) {
      distribution.medium++
    } else if (file.size < 100 * 1024 * 1024) {
      distribution.large++
    } else {
      distribution.xlarge++
    }
  })
  
  statistics.sizeDistribution = distribution
  
  return statistics
}

// Generate Heat Map Data
function generateHeatMapData(files, options = {}) {
  const { timeRange = 30, resolution = 100 } = options // timeRange in days
  const now = Date.now()
  const heatMapData = []
  
  // Create time buckets
  const bucketSize = (timeRange * 24 * 60 * 60 * 1000) / resolution // milliseconds per bucket
  
  // Initialize heat map data
  for (let i = 0; i < resolution; i++) {
    heatMapData.push({
      time: now - (resolution - i) * bucketSize,
      activity: 0,
      files: []
    })
  }
  
  // Populate heat map data
  files.forEach(file => {
    const fileTime = file.modified.getTime()
    const age = now - fileTime
    
    if (age <= timeRange * 24 * 60 * 60 * 1000) {
      const bucketIndex = Math.floor((timeRange * 24 * 60 * 60 * 1000 - age) / bucketSize)
      
      if (bucketIndex >= 0 && bucketIndex < resolution) {
        heatMapData[bucketIndex].activity += Math.log(file.size + 1) / Math.log(1024) // Weight by file size
        heatMapData[bucketIndex].files.push(file)
      }
    }
  })
  
  // Normalize activity values
  const maxActivity = Math.max(...heatMapData.map(d => d.activity))
  if (maxActivity > 0) {
    heatMapData.forEach(bucket => {
      bucket.normalizedActivity = bucket.activity / maxActivity
    })
  }
  
  return heatMapData
}

// Flatten File System
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
  const { type, data, id } = e.data
  
  try {
    let result
    
    switch (type) {
      case 'scanDirectory':
        result = fileSystemOperations.scanDirectory(data.path, data.options)
        break
        
      case 'filterFiles':
        result = fileSystemOperations.filterFiles(data.files, data.filters)
        break
        
      case 'searchFiles':
        result = fileSystemOperations.searchFiles(data.files, data.query, data.options)
        break
        
      case 'analyzeFileTypes':
        result = fileSystemOperations.analyzeFileTypes(data.files)
        break
        
      case 'calculateStatistics':
        result = fileSystemOperations.calculateStatistics(data.files)
        break
        
      case 'generateHeatMapData':
        result = fileSystemOperations.generateHeatMapData(data.files, data.options)
        break
        
      case 'flattenFileSystem':
        result = fileSystemOperations.flattenFileSystem(data.root)
        break
        
      default:
        throw new Error(`Unknown operation type: ${type}`)
    }
    
    self.postMessage({
      type: 'success',
      id,
      data: result
    })
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error.message,
      stack: error.stack
    })
  }
}

// Utility Functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(date) {
  return new Date(date).toLocaleDateString()
}
