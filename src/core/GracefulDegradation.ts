export enum DegradationLevel {
  FULL = 'full',
  DEGRADED = 'degraded',
  OFFLINE = 'offline'
}

export interface DegradationConfig {
  level: DegradationLevel;
  features: Record<string, boolean>;
  fallbacks: Record<string, () => any>;
  triggers: string[];
}

export interface FeatureConfig {
  name: string;
  essential: boolean;
  fallback?: () => any;
  dependencies: string[];
  timeout?: number;
}

export class GracefulDegradation {
  private static instance: GracefulDegradation;
  private currentLevel: DegradationLevel = DegradationLevel.FULL;
  private features = new Map<string, FeatureConfig>();
  private activeFallbacks = new Map<string, any>();
  private healthStatus = new Map<string, boolean>();
  private listeners: Array<(level: DegradationLevel) => void> = [];

  static getInstance(): GracefulDegradation {
    if (!GracefulDegradation.instance) {
      GracefulDegradation.instance = new GracefulDegradation();
    }
    return GracefulDegradation.instance;
  }

  registerFeature(config: FeatureConfig): void {
    this.features.set(config.name, config);
  }

  async executeFeature<T>(
    featureName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const feature = this.features.get(featureName);
    if (!feature) {
      return await operation();
    }

    // Check if feature is available at current degradation level
    if (!this.isFeatureAvailable(featureName)) {
      if (feature.fallback) {
        return await feature.fallback();
      }
      if (fallback) {
        return await fallback();
      }
      throw new Error(`Feature ${featureName} is not available at ${this.currentLevel} level`);
    }

    try {
      // Add timeout if specified
      if (feature.timeout) {
        return await this.withTimeout(operation(), feature.timeout);
      }
      return await operation();
    } catch (error) {
      console.warn(`Feature ${featureName} failed, attempting fallback:`, error);
      
      if (feature.fallback) {
        const result = await feature.fallback();
        this.activeFallbacks.set(featureName, result);
        return result;
      }
      
      if (fallback) {
        const result = await fallback();
        this.activeFallbacks.set(featureName, result);
        return result;
      }
      
      throw error;
    }
  }

  setDegradationLevel(level: DegradationLevel, reason?: string): void {
    if (this.currentLevel === level) return;
    
    const oldLevel = this.currentLevel;
    this.currentLevel = level;
    
    console.log(`Degradation level changed: ${oldLevel} -> ${level}${reason ? ` (${reason})` : ''}`);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(level));
    
    // Clear fallbacks if moving to full mode
    if (level === DegradationLevel.FULL) {
      this.activeFallbacks.clear();
    }
  }

  updateHealthStatus(service: string, isHealthy: boolean): void {
    const wasHealthy = this.healthStatus.get(service) ?? true;
    this.healthStatus.set(service, isHealthy);
    
    if (!wasHealthy && isHealthy) {
      console.log(`Service ${service} recovered`);
      this.evaluateDegradationLevel();
    } else if (wasHealthy && !isHealthy) {
      console.warn(`Service ${service} degraded`);
      this.evaluateDegradationLevel();
    }
  }

  private evaluateDegradationLevel(): void {
    const unhealthyServices = Array.from(this.healthStatus.entries())
      .filter(([, healthy]) => !healthy)
      .map(([service]) => service);

    if (unhealthyServices.length === 0) {
      this.setDegradationLevel(DegradationLevel.FULL, 'All services healthy');
      return;
    }

    // Check if essential services are down
    const essentialServices = Array.from(this.features.values())
      .filter(feature => feature.essential)
      .flatMap(feature => feature.dependencies);

    const essentialUnhealthy = unhealthyServices.filter(service => 
      essentialServices.includes(service)
    );

    if (essentialUnhealthy.length > 0) {
      this.setDegradationLevel(
        DegradationLevel.OFFLINE, 
        `Essential services down: ${essentialUnhealthy.join(', ')}`
      );
    } else {
      this.setDegradationLevel(
        DegradationLevel.DEGRADED,
        `Non-essential services down: ${unhealthyServices.join(', ')}`
      );
    }
  }

  private isFeatureAvailable(featureName: string): boolean {
    const feature = this.features.get(featureName);
    if (!feature) return true;

    switch (this.currentLevel) {
      case DegradationLevel.FULL:
        return true;
      
      case DegradationLevel.DEGRADED:
        return feature.essential;
      
      case DegradationLevel.OFFLINE:
        return false;
      
      default:
        return false;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
      )
    ]);
  }

  onLevelChange(listener: (level: DegradationLevel) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  getActiveFallbacks(): Record<string, any> {
    return Object.fromEntries(this.activeFallbacks);
  }

  getFeatureStatus(): Record<string, { available: boolean; essential: boolean }> {
    const status: Record<string, { available: boolean; essential: boolean }> = {};
    
    for (const [name, feature] of this.features) {
      status[name] = {
        available: this.isFeatureAvailable(name),
        essential: feature.essential
      };
    }
    
    return status;
  }

  // Predefined feature configurations
  static readonly features = {
    aiAnalysis: {
      name: 'ai-analysis',
      essential: false,
      dependencies: ['ollama', 'google-ai', 'python-ml'],
      timeout: 30000,
      fallback: () => ({
        type: 'basic-analysis',
        message: 'AI services unavailable, using basic analysis'
      })
    },

    realTimeUpdates: {
      name: 'real-time-updates',
      essential: false,
      dependencies: ['websocket'],
      timeout: 5000,
      fallback: () => ({
        type: 'polling',
        interval: 5000,
        message: 'Real-time updates unavailable, using polling'
      })
    },

    threeDVisualization: {
      name: '3d-visualization',
      essential: false,
      dependencies: ['webgl', 'threejs'],
      timeout: 10000,
      fallback: () => ({
        type: '2d-charts',
        message: '3D visualization unavailable, using 2D charts'
      })
    },

    fileOperations: {
      name: 'file-operations',
      essential: true,
      dependencies: ['filesystem'],
      timeout: 15000
    },

    databaseAccess: {
      name: 'database-access',
      essential: true,
      dependencies: ['database'],
      timeout: 5000
    },

    apiCommunication: {
      name: 'api-communication',
      essential: true,
      dependencies: ['http'],
      timeout: 10000
    }
  };

  initialize(): void {
    // Register all predefined features
    Object.values(GracefulDegradation.features).forEach(config => {
      this.registerFeature(config);
    });

    // Set up periodic health checks
    setInterval(() => {
      this.performHealthChecks();
    }, 30000);
  }

  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkService('ollama', 'http://localhost:11434/api/tags'),
      this.checkService('database', '/api/health/database'),
      this.checkService('websocket', '/api/health/websocket'),
      this.checkService('filesystem', '/api/health/filesystem')
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      const serviceNames = ['ollama', 'database', 'websocket', 'filesystem'];
      const serviceName = serviceNames[index];
      const isHealthy = result.status === 'fulfilled' && result.value;
      
      this.updateHealthStatus(serviceName, isHealthy);
    });
  }

  private async checkService(name: string, endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}