export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
  jitter?: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDelay: number;
}

export class RetryHandler {
  private static defaultConfig: Partial<RetryConfig> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true,
    retryCondition: (error: any) => {
      // Retry on network errors, timeouts, and 5xx server errors
      return (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        (error.response && error.response.status >= 500) ||
        error.name === 'TimeoutError' ||
        error.message?.includes('timeout') ||
        error.message?.includes('network')
      );
    }
  };

  static async execute<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config } as RetryConfig;
    let lastError: any;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt === finalConfig.maxRetries) {
          break;
        }

        if (finalConfig.retryCondition && !finalConfig.retryCondition(error)) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, finalConfig);
        totalDelay += delay;

        // Call retry callback if provided
        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt + 1, error);
        }

        // Wait before retrying
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  static async executeWithResult<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    try {
      const result = await this.execute(operation, config);
      return {
        success: true,
        result,
        attempts: 1,
        totalDelay: 0
      };
    } catch (error) {
      // Count attempts by simulating the retry process
      const finalConfig = { ...this.defaultConfig, ...config } as RetryConfig;
      let attempts = 1;
      let totalDelay = 0;

      for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
        if (finalConfig.retryCondition && !finalConfig.retryCondition(error)) {
          break;
        }
        attempts++;
        totalDelay += this.calculateDelay(attempt, finalConfig);
      }

      return {
        success: false,
        error,
        attempts,
        totalDelay
      };
    }
  }

  private static calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Predefined retry configurations for different scenarios
  static readonly configs = {
    // For quick operations that should fail fast
    fast: {
      maxRetries: 2,
      baseDelay: 200,
      maxDelay: 1000,
      backoffFactor: 2
    },

    // For network operations
    network: {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    },

    // For AI operations that might take longer
    ai: {
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffFactor: 1.5,
      jitter: true
    },

    // For database operations
    database: {
      maxRetries: 4,
      baseDelay: 500,
      maxDelay: 5000,
      backoffFactor: 2,
      jitter: false
    },

    // For file system operations
    fileSystem: {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 2000,
      backoffFactor: 2,
      jitter: false
    }
  };

  // Utility method to create retry wrapper functions
  static wrap<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    config: Partial<RetryConfig> = {}
  ): (...args: T) => Promise<R> {
    return (...args: T) => this.execute(() => fn(...args), config);
  }

  // Batch retry for multiple operations
  static async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    config: Partial<RetryConfig> = {}
  ): Promise<Array<RetryResult<T>>> {
    const promises = operations.map(op => 
      this.executeWithResult(op, config)
    );
    
    return Promise.all(promises);
  }

  // Retry with fallback
  static async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    try {
      return await this.execute(operation, config);
    } catch (error) {
      console.warn('Operation failed after retries, using fallback:', error);
      return await fallback();
    }
  }
}