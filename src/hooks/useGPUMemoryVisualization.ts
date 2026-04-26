import { useMemo, useCallback, useState, useEffect } from 'react';

interface ModelData {
  name: string;
  path: string;
  size: number;
  type: string;
  framework: string;
  accuracy: number;
  parameters: number;
  gpuMemory: number;
  inferenceTime: number;
  status: string;
  lastUsed: Date;
}

interface MemoryStats {
  totalUsed: number;
  available: number;
  totalCapacity: number;
  utilizationPercentage: number;
}

interface MemoryTrend {
  time: string;
  used: number;
  cached: number;
  free: number;
}

interface ModelPerformance {
  name: string;
  gpuMemory: number;
  inferenceTime: number;
  accuracy: number;
  efficiency: number;
}

interface OptimizationSuggestion {
  type: 'memory' | 'performance' | 'efficiency';
  title: string;
  description: string;
  impact: string;
  priority: 'low' | 'medium' | 'high';
}

interface GPUMemoryStats {
  totalUsed: number;
  available: number;
  totalCapacity: number;
  utilizationPercentage: number;
  modelBreakdown: Record<string, number>;
}

export const useGPUMemoryVisualization = (models: ModelData[]) => {
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    totalUsed: 0,
    available: 16384, // 16GB default
    totalCapacity: 16384,
    utilizationPercentage: 0
  });

  const [memoryTrends, setMemoryTrends] = useState<MemoryTrend[]>([]);

  // Calculate GPU memory statistics
  const gpuMemoryStats = useMemo<GPUMemoryStats>(() => {
    const totalUsed = models
      .filter(model => model.status === 'loaded')
      .reduce((sum, model) => sum + (model.gpuMemory * 1024 * 1024), 0);

    const totalCapacity = 16 * 1024 * 1024 * 1024; // 16GB in bytes
    const available = totalCapacity - totalUsed;
    const utilizationPercentage = (totalUsed / totalCapacity) * 100;

    const modelBreakdown = models.reduce((acc, model) => {
      if (model.status === 'loaded') {
        acc[model.name] = model.gpuMemory * 1024 * 1024;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsed,
      available,
      totalCapacity,
      utilizationPercentage,
      modelBreakdown
    };
  }, [models]);

  // Calculate memory efficiency score
  const memoryEfficiencyScore = useMemo(() => {
    const loadedModels = models.filter(model => model.status === 'loaded');
    if (loadedModels.length === 0) return 100;

    const totalEfficiency = loadedModels.reduce((sum, model) => {
      const efficiency = (model.accuracy / 100) * (1 / (model.inferenceTime / 1000));
      return sum + efficiency;
    }, 0);

    return Math.min(100, Math.round((totalEfficiency / loadedModels.length) * 100));
  }, [models]);

  // Get memory usage for specific model
  const getMemoryUsageForModel = useCallback((model: ModelData) => {
    const memoryUsage = model.gpuMemory * 1024 * 1024; // Convert MB to bytes
    const efficiency = (model.accuracy / 100) * (1 / (model.inferenceTime / 1000));
    
    return {
      memoryUsage,
      efficiency: Math.round(efficiency * 100),
      utilizationPercentage: (memoryUsage / gpuMemoryStats.totalCapacity) * 100,
      recommendation: memoryUsage > 4 * 1024 * 1024 * 1024 ? 'Consider model quantization' : 'Memory usage optimal'
    };
  }, [gpuMemoryStats.totalCapacity]);

  // Generate memory trends data
  const getMemoryTrends = useCallback((timeRange: '1h' | '24h' | '7d') => {
    const now = new Date();
    const trends: MemoryTrend[] = [];
    
    let dataPoints = 24;
    let timeInterval = 60 * 60 * 1000; // 1 hour in ms
    
    if (timeRange === '1h') {
      dataPoints = 12;
      timeInterval = 5 * 60 * 1000; // 5 minutes
    } else if (timeRange === '7d') {
      dataPoints = 7;
      timeInterval = 24 * 60 * 60 * 1000; // 1 day
    }

    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * timeInterval);
      const used = gpuMemoryStats.totalUsed * (0.8 + Math.random() * 0.4); // Simulate variation
      const cached = gpuMemoryStats.totalCapacity * 0.1 * Math.random();
      const free = gpuMemoryStats.totalCapacity - used - cached;
      
      trends.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        used: used / (1024 * 1024 * 1024), // Convert to GB
        cached: cached / (1024 * 1024 * 1024),
        free: free / (1024 * 1024 * 1024)
      });
    }
    
    return trends;
  }, [gpuMemoryStats]);

  // Get model performance comparison
  const getModelPerformanceComparison = useCallback((): ModelPerformance[] => {
    return models.map(model => ({
      name: model.name,
      gpuMemory: model.gpuMemory,
      inferenceTime: model.inferenceTime,
      accuracy: model.accuracy,
      efficiency: (model.accuracy / 100) * (1 / (model.inferenceTime / 1000))
    })).sort((a, b) => b.efficiency - a.efficiency).slice(0, 10); // Top 10 models
  }, [models]);

  // Generate optimization suggestions
  const optimizationSuggestions = useMemo<OptimizationSuggestion[]>(() => {
    const suggestions: OptimizationSuggestion[] = [];
    
    // Memory optimization suggestions
    const largeModels = models.filter(model => model.gpuMemory > 4096); // > 4GB
    if (largeModels.length > 0) {
      suggestions.push({
        type: 'memory',
        title: 'Large Model Optimization',
        description: `${largeModels.length} models use more than 4GB of GPU memory`,
        impact: `Potential ${largeModels.length * 30}% memory reduction`,
        priority: 'high'
      });
    }

    // Performance optimization suggestions
    const slowModels = models.filter(model => model.inferenceTime > 1000); // > 1 second
    if (slowModels.length > 0) {
      suggestions.push({
        type: 'performance',
        title: 'Inference Time Optimization',
        description: `${slowModels.length} models have inference times over 1 second`,
        impact: `Potential ${slowModels.length * 25}% speed improvement`,
        priority: 'medium'
      });
    }

    // Efficiency optimization suggestions
    const inefficientModels = models.filter(model => {
      const efficiency = (model.accuracy / 100) * (1 / (model.inferenceTime / 1000));
      return efficiency < 0.5;
    });
    
    if (inefficientModels.length > 0) {
      suggestions.push({
        type: 'efficiency',
        title: 'Model Efficiency Improvement',
        description: `${inefficientModels.length} models have low accuracy-to-speed ratios`,
        impact: `Potential ${inefficientModels.length * 40}% efficiency gain`,
        priority: 'medium'
      });
    }

    // General suggestions
    if (gpuMemoryStats.utilizationPercentage > 80) {
      suggestions.push({
        type: 'memory',
        title: 'GPU Memory Pressure',
        description: 'GPU memory utilization is above 80%',
        impact: 'Improved system stability and performance',
        priority: 'high'
      });
    }

    if (models.filter(m => m.status === 'loaded').length > models.length * 0.7) {
      suggestions.push({
        type: 'memory',
        title: 'Model Unloading Opportunities',
        description: 'Many models are loaded but may not be actively used',
        impact: `Potential ${(models.length * 0.3 * 2048).toFixed(0)}MB memory savings`,
        priority: 'low'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [models, gpuMemoryStats.utilizationPercentage]);

  // Simulate real-time memory updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMemoryStats(prev => ({
        ...prev,
        totalUsed: gpuMemoryStats.totalUsed * (0.95 + Math.random() * 0.1),
        utilizationPercentage: gpuMemoryStats.utilizationPercentage * (0.95 + Math.random() * 0.1)
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [gpuMemoryStats]);

  return {
    gpuMemoryStats,
    memoryEfficiencyScore,
    optimizationSuggestions,
    getMemoryUsageForModel,
    getMemoryTrends,
    getModelPerformanceComparison,
    memoryStats,
    memoryTrends
  };
};