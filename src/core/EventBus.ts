/**
 * Unified Event System for Space Analyzer
 * Provides decoupled communication between components and services
 */

export type EventHandler<T = any> = (data: T) => void | Promise<void>;
export type EventSubscription = { id: string; handler: EventHandler; remove: () => void };

export interface EventBusConfig {
  maxListeners?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

export interface EventMetrics {
  totalEvents: number;
  totalListeners: number;
  eventTypes: Map<string, number>;
  errors: Array<{ event: string; error: string; timestamp: Date }>;
}

export class TypedEventBus<T = Record<string, any>> {
  private static instance: TypedEventBus;
  private listeners = new Map<string, Set<EventHandler<any>>>();
  private metrics: EventMetrics;
  private config: EventBusConfig;

  private constructor(config: EventBusConfig = {}) {
    if (TypedEventBus.instance) {
      throw new Error("TypedEventBus is a singleton. Use TypedEventBus.getInstance()");
    }

    TypedEventBus.instance = this as TypedEventBus<any>;
    this.config = {
      maxListeners: 100,
      enableLogging: true,
      enableMetrics: true,
      ...config,
    };

    this.metrics = {
      totalEvents: 0,
      totalListeners: 0,
      eventTypes: new Map(),
      errors: [],
    };
  }

  static getInstance<T = Record<string, any>>(config?: EventBusConfig): TypedEventBus<T> {
    return new TypedEventBus<T>(config);
  }

  /**
   * Subscribe to an event type
   */
  on<K extends keyof T>(eventType: K, handler: EventHandler<T[K]>): EventSubscription {
    const subscriptionId = `${String(eventType)}-${Date.now()}-${Math.random()}`;

    if (!this.listeners.has(String(eventType))) {
      this.listeners.set(String(eventType), new Set());
    }

    const eventListeners = this.listeners.get(String(eventType))!;

    // Check max listeners limit
    if (this.config.maxListeners && eventListeners.size >= this.config.maxListeners) {
      console.warn(
        `Max listeners (${this.config.maxListeners}) reached for event: ${String(eventType)}`
      );
      return { id: "", handler, remove: () => {} };
    }

    eventListeners.add(handler);
    this.metrics.totalListeners++;

    if (this.config.enableLogging) {
      console.log(`📡 Subscribed to event: ${String(eventType)} (ID: ${subscriptionId})`);
    }

    const remove = () => {
      this.off(eventType, handler);
    };

    return { id: subscriptionId, handler, remove };
  }

  /**
   * Unsubscribe from an event type
   */
  off<K extends keyof T>(eventType: K, handler?: EventHandler<T[K]>): void {
    const eventTypeStr = String(eventType);
    const eventListeners = this.listeners.get(eventTypeStr);

    if (!eventListeners) {
      return;
    }

    if (handler) {
      eventListeners.delete(handler);
      this.metrics.totalListeners--;
    } else {
      // Clear all listeners for this event type
      eventListeners.clear();
      this.metrics.totalListeners -= eventListeners.size;
    }

    if (this.config.enableLogging) {
      console.log(`📤 Unsubscribed from event: ${eventTypeStr}`);
    }

    if (eventListeners.size === 0) {
      this.listeners.delete(eventTypeStr);
    }
  }

  /**
   * Emit an event
   */
  async emit<K extends keyof T>(eventType: K, data: T[K]): Promise<void> {
    const eventTypeStr = String(eventType);

    if (this.config.enableLogging) {
      console.log(`📢 Emitting event: ${eventTypeStr}`, data);
    }

    // Update metrics
    this.metrics.totalEvents++;
    const currentCount = this.metrics.eventTypes.get(eventTypeStr) || 0;
    this.metrics.eventTypes.set(eventTypeStr, currentCount + 1);

    const eventListeners = this.listeners.get(eventTypeStr);
    if (!eventListeners || eventListeners.size === 0) {
      if (this.config.enableLogging) {
        console.log(`No listeners for event: ${eventTypeStr}`);
      }
      return;
    }

    // Execute all listeners
    const promises: Promise<void>[] = [];

    for (const handler of eventListeners) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        this.metrics.errors.push({
          event: eventTypeStr,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });

        if (this.config.enableLogging) {
          console.error(`Error in event handler for ${eventTypeStr}:`, error);
        }
      }
    }

    // Wait for all async handlers to complete
    if (promises.length > 0) {
      try {
        await Promise.allSettled(promises);
      } catch (error) {
        this.metrics.errors.push({
          event: eventTypeStr,
          error: `Promise.allSettled failed: ${error}`,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Emit event with error handling
   */
  async emitSafe<K extends keyof T>(eventType: K, data: T[K]): Promise<boolean> {
    try {
      await this.emit(eventType, data);
      return true;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Failed to emit event ${String(eventType)}:`, error);
      }
      return false;
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.metrics.totalListeners = 0;

    if (this.config.enableLogging) {
      console.log("🧹 Cleared all event listeners");
    }
  }

  /**
   * Clear all events and reset metrics
   */
  reset(): void {
    this.clear();
    this.metrics = {
      totalEvents: 0,
      totalListeners: 0,
      eventTypes: new Map(),
      errors: [],
    };

    if (this.config.enableLogging) {
      console.log("🔄 Event bus reset");
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get event type statistics
   */
  getEventTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [eventType, count] of this.metrics.eventTypes) {
      stats[eventType] = count;
    }
    return stats;
  }

  /**
   * Wait for an event to be emitted
   */
  waitFor<K extends keyof T>(eventType: K, timeout: number = 5000): Promise<T[K]> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.on(eventType, (data: T[K]) => {
        resolve(data);
      });

      // Set timeout
      setTimeout(() => {
        if (unsubscribe) unsubscribe();
        reject(new Error(`Timeout waiting for event: ${String(eventType)}`));
      }, timeout);
    });
  }

  /**
   * Create a scoped event bus for a specific context
   */
  static createScoped<T = Record<string, any>>(
    scope: string,
    config?: EventBusConfig
  ): TypedEventBus<T> {
    const scopedBus = new TypedEventBus<T>({
      ...config,
      enableLogging: config?.enableLogging ? true : false,
    });

    return scopedBus;
  }
}

// Export default instance
export const eventBus = TypedEventBus.getInstance({
  maxListeners: 50,
  enableLogging: true,
  enableMetrics: true,
});

// Export typed instances for different domains
export const analysisEventBus = TypedEventBus.getInstance<{
  analysis_started: { path: string; timestamp: Date };
  analysis_progress: { progress: number; currentFile: string };
  analysis_completed: { result: any; duration: number };
  analysis_error: { error: string; path: string };
}>();

export const aiEventBus = TypedEventBus.getInstance<{
  ai_analysis_started: { files: any[]; options: any };
  ai_analysis_completed: { insights: any[]; backend: string };
  ai_backend_changed: { backend: string; reason: string };
  ai_insight_generated: { insight: any; confidence: number };
}>();

export const uiEventBus = TypedEventBus.getInstance<{
  theme_changed: { theme: string };
  notification_show: { message: string; type: string };
  error_occurred: { error: string; context: string };
  performance_warning: { metric: string; value: number };
}>();

export const systemEventBus = TypedEventBus.getInstance<{
  service_registered: { name: string; version: string };
  service_shutdown: { name: string; reason: string };
  memory_warning: { usage: number; threshold: number };
}>();

// Convenience exports
export { TypedEventBus as EventBus };
