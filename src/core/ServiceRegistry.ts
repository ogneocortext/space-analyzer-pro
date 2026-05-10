/**
 * Centralized Service Registry for Space Analyzer
 * Provides dependency injection, lifecycle management, and service discovery
 */

export interface ServiceConfig {
  name: string;
  version: string;
  dependencies?: string[];
  singleton?: boolean;
  lazy?: boolean;
  priority?: number;
}

export interface ServiceInstance {
  config: ServiceConfig;
  instance: any;
  initialized: boolean;
  error?: Error;
}

export type ServiceFactory<T> = () => T | Promise<T>;

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, ServiceInstance>();
  private factories = new Map<string, ServiceFactory<any>>();
  private initializationOrder: string[] = [];

  private constructor() {
    if (ServiceRegistry.instance) {
      throw new Error("ServiceRegistry is a singleton. Use ServiceRegistry.getInstance()");
    }
    ServiceRegistry.instance = this;
  }

  static getInstance(): ServiceRegistry {
    return ServiceRegistry.instance;
  }

  /**
   * Register a service factory
   */
  register<T>(config: ServiceConfig, factory: ServiceFactory<T>): void {
    if (this.factories.has(config.name)) {
      console.warn(`Service ${config.name} is already registered`);
      return;
    }

    this.factories.set(config.name, factory);

    // Calculate initialization order based on priority
    this.updateInitializationOrder();

    console.log(`Registered service: ${config.name} v${config.version}`);
  }

  /**
   * Register a service instance directly
   */
  registerInstance<T>(config: ServiceConfig, instance: T): void {
    if (this.services.has(config.name)) {
      console.warn(`Service instance ${config.name} is already registered`);
      return;
    }

    const serviceInstance: ServiceInstance = {
      config,
      instance,
      initialized: false,
    };
    this.services.set(config.name, serviceInstance);

    this.updateInitializationOrder();
    console.log(`Registered service instance: ${config.name}`);
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T | null {
    const service = this.services.get(name);
    if (!service) {
      console.warn(`Service ${name} not found`);
      return null;
    }

    if (!service.initialized && service.config.lazy) {
      // Initialize lazy service
      this.initializeService(name);
    }

    return service.instance;
  }

  /**
   * Get all services
   */
  getAll(): Map<string, ServiceInstance> {
    return new Map(this.services);
  }

  /**
   * Get services by priority
   */
  getByPriority(): ServiceInstance[] {
    return Array.from(this.services.values())
      .filter((service) => service.initialized)
      .sort((a, b) => (a.config.priority || 999) - (b.config.priority || 999));
  }

  /**
   * Initialize all registered services
   */
  async initializeAll(): Promise<void> {
    console.log("Initializing all services...");

    for (const serviceName of this.initializationOrder) {
      await this.initializeService(serviceName);
    }

    console.log(`All services initialized. Total: ${this.services.size}`);
  }

  /**
   * Initialize a specific service
   */
  async initializeService(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }

    if (service.initialized) {
      return;
    }

    try {
      // Check dependencies
      if (service.config.dependencies) {
        for (const dep of service.config.dependencies) {
          const depService = this.services.get(dep);
          if (!depService || !depService.initialized) {
            await this.initializeService(dep);
          }
        }
      }

      // Initialize if factory exists
      if (this.factories.has(name)) {
        const factory = this.factories.get(name)!;
        service.instance = await factory();
      }

      service.initialized = true;
      delete service.error;

      console.log(`✅ Service ${name} initialized successfully`);
    } catch (error) {
      service.error = error instanceof Error ? error : new Error("Unknown error");
      console.error(`❌ Service ${name} initialization failed:`, service.error);
    }
  }

  /**
   * Check if service is healthy
   */
  isHealthy(name: string): boolean {
    const service = this.services.get(name);
    return service?.initialized === true && !service.error;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): Record<
    string,
    { status: "healthy" | "unhealthy" | "uninitialized"; error?: string }
  > {
    const status: Record<string, any> = {};

    for (const [name, service] of this.services) {
      if (!service.initialized) {
        status[name] = { status: "uninitialized" };
      } else if (service.error) {
        status[name] = { status: "unhealthy", error: service.error.message };
      } else {
        status[name] = { status: "healthy" };
      }
    }

    return status;
  }

  /**
   * Shutdown a service
   */
  async shutdown(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service) {
      return;
    }

    try {
      // Call cleanup if available
      if (service.instance && typeof service.instance.destroy === "function") {
        await service.instance.destroy();
      }

      service.initialized = false;
      console.log(`Service ${name} shutdown successfully`);
    } catch (error) {
      console.error(`Error shutting down service ${name}:`, error);
    }
  }

  /**
   * Shutdown all services
   */
  async shutdownAll(): Promise<void> {
    console.log("Shutting down all services...");

    // Shutdown in reverse priority order
    const services = this.getByPriority().reverse();

    for (const service of services) {
      await this.shutdown(service.config.name);
    }

    console.log("All services shutdown");
  }

  /**
   * Update initialization order based on dependencies and priority
   */
  private updateInitializationOrder(): void {
    const services = Array.from(this.factories.entries()).map(([name, config]) => ({
      name,
      config,
    }));

    const serviceEntries = Array.from(this.services.entries()).map(([name, service]) => ({
      name,
      config: (service as any).config,
    }));

    const allServices = services.concat(serviceEntries);

    // Sort by dependencies first, then priority
    allServices.sort((a, b) => {
      // A depends on B
      if ((a.config as any).dependencies?.includes(b.name)) return -1;
      // B depends on A
      if ((b.config as any).dependencies?.includes(a.name)) return 1;
      // Sort by priority (lower number = higher priority)
      return ((a.config as any).priority || 999) - ((b.config as any).priority || 999);
    });

    this.initializationOrder = allServices.map((s) => s.name);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    total: number;
    initialized: number;
    unhealthy: number;
    services: Array<{ name: string; version: string; status: string }>;
  } {
    const services = Array.from(this.services.values());

    return {
      total: services.length,
      initialized: services.filter((s) => s.initialized).length,
      unhealthy: services.filter((s) => !!s.error).length,
      services: services.map((s) => ({
        name: s.config.name,
        version: s.config.version,
        status: s.initialized ? "initialized" : s.error ? "error" : "registered",
      })),
    };
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.initializationOrder = [];
    console.log("Service registry cleared");
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();
