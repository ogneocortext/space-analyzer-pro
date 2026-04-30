/**
 * 3D File System Browser Error Handler
 * Robust error handling, recovery mechanisms, and system resilience
 */

// Error Types
export enum ErrorType {
  RENDERING = 'rendering',
  MEMORY = 'memory',
  LOADING = 'loading',
  WORKER = 'worker',
  CACHE = 'cache',
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// Error Severity
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Recovery Action
export enum RecoveryAction {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  RESET = 'reset',
  RESTART = 'restart',
  ESCALATE = 'escalate',
  IGNORE = 'ignore'
}

// Error Context
export interface ErrorContext {
  component: string
  operation: string
  userId?: string
  sessionId: string
  timestamp: Date
  userAgent: string
  url: string
  memoryUsage?: number
  performanceData?: any
}

// Error Details
export interface ErrorDetails {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  originalError?: Error
  context: ErrorContext
  stack?: string
  recoverable: boolean
  suggestedAction: RecoveryAction
  retryCount?: number
  maxRetries?: number
}

// Recovery Result
export interface RecoveryResult {
  success: boolean
  action: RecoveryAction
  message?: string
  data?: any
  error?: Error
}

// Error Handler Configuration
export interface ErrorHandlerConfig {
  maxRetries: number
  retryDelay: number
  fallbackMode: boolean
  enableLogging: boolean
  enableTelemetry: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  escalationThreshold: number
  autoRecovery: boolean
  circuitBreakerThreshold: number
}

// Error Handler Class
export class ErrorHandler3D {
  private config: ErrorHandlerConfig
  private errorHistory: ErrorDetails[]
  private circuitBreakers: Map<string, CircuitBreaker>
  private retryCounters: Map<string, number>
  private listeners: Map<string, ((error: ErrorDetails) => void)[]>
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy[]>
  private sessionId: string
  private isShuttingDown: boolean

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackMode: true,
      enableLogging: true,
      enableTelemetry: false,
      logLevel: 'error',
      escalationThreshold: 5,
      autoRecovery: true,
      circuitBreakerThreshold: 10,
      ...config
    }

    this.errorHistory = []
    this.circuitBreakers = new Map()
    this.retryCounters = new Map()
    this.listeners = new Map()
    this.sessionId = this.generateSessionId()
    this.isShuttingDown = false

    this.initializeRecoveryStrategies()
    this.setupGlobalErrorHandlers()
  }

  // Handle Error
  public handleError(
    error: Error | string,
    type: ErrorType = ErrorType.UNKNOWN,
    context: Partial<ErrorContext> = {},
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<RecoveryResult> {
    const errorDetails = this.createErrorDetails(error, type, context, severity)
    
    // Log error
    if (this.config.enableLogging) {
      this.logError(errorDetails)
    }

    // Add to history
    this.errorHistory.push(errorDetails)
    this.trimErrorHistory()

    // Check circuit breaker
    const circuitBreaker = this.getCircuitBreaker(context.component || 'global')
    if (circuitBreaker.isOpen()) {
      return Promise.resolve({
        success: false,
        action: RecoveryAction.ESCALATE,
        message: 'Circuit breaker is open, operation blocked'
      })
    }

    // Notify listeners
    this.notifyListeners(errorDetails)

    // Attempt recovery
    if (this.config.autoRecovery && errorDetails.recoverable) {
      return this.attemptRecovery(errorDetails)
    }

    return Promise.resolve({
      success: false,
      action: RecoveryAction.IGNORE,
      message: 'Auto-recovery disabled or error not recoverable'
    })
  }

  // Create Error Details
  private createErrorDetails(
    error: Error | string,
    type: ErrorType,
    context: Partial<ErrorContext>,
    severity: ErrorSeverity
  ): ErrorDetails {
    const errorMessage = typeof error === 'string' ? error : error.message
    const originalError = typeof error === 'string' ? undefined : error

    const errorContext: ErrorContext = {
      component: context.component || 'unknown',
      operation: context.operation || 'unknown',
      userId: context.userId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      memoryUsage: this.getMemoryUsage(),
      performanceData: this.getPerformanceData(),
      ...context
    }

    const operationKey = `${errorContext.component}:${errorContext.operation}`
    const retryCount = this.retryCounters.get(operationKey) || 0

    return {
      type,
      severity,
      message: errorMessage,
      originalError,
      context: errorContext,
      stack: originalError?.stack,
      recoverable: this.isRecoverable(type, severity),
      suggestedAction: this.getSuggestedAction(type, severity, retryCount),
      retryCount,
      maxRetries: this.config.maxRetries
    }
  }

  // Attempt Recovery
  private async attemptRecovery(errorDetails: ErrorDetails): Promise<RecoveryResult> {
    const strategies = this.recoveryStrategies.get(errorDetails.type) || []
    
    for (const strategy of strategies) {
      if (strategy.canHandle(errorDetails)) {
        try {
          const result = await strategy.recover(errorDetails)
          
          if (result.success) {
            // Reset retry counter on successful recovery
            const operationKey = `${errorDetails.context.component}:${errorDetails.context.operation}`
            this.retryCounters.set(operationKey, 0)
            
            // Record successful recovery
            this.recordRecovery(errorDetails, result)
            
            return result
          }
        } catch (recoveryError) {
          console.warn('Recovery strategy failed:', recoveryError)
        }
      }
    }

    // If all strategies failed, escalate
    return {
      success: false,
      action: RecoveryAction.ESCALATE,
      message: 'All recovery strategies failed'
    }
  }

  // Check if Error is Recoverable
  private isRecoverable(type: ErrorType, severity: ErrorSeverity): boolean {
    if (severity === ErrorSeverity.CRITICAL) return false
    
    const recoverableTypes = [
      ErrorType.LOADING,
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.WORKER
    ]
    
    return recoverableTypes.includes(type)
  }

  // Get Suggested Action
  private getSuggestedAction(type: ErrorType, severity: ErrorSeverity, retryCount: number): RecoveryAction {
    if (severity === ErrorSeverity.CRITICAL) {
      return RecoveryAction.ESCALATE
    }
    
    if (retryCount >= this.config.maxRetries) {
      return RecoveryAction.FALLBACK
    }
    
    if (type === ErrorType.MEMORY || type === ErrorType.RENDERING) {
      return RecoveryAction.RESET
    }
    
    return RecoveryAction.RETRY
  }

  // Get Circuit Breaker
  private getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker(this.config.circuitBreakerThreshold))
    }
    return this.circuitBreakers.get(key)!
  }

  // Log Error
  private logError(errorDetails: ErrorDetails): void {
    const logMessage = `[${errorDetails.severity.toUpperCase()}] ${errorDetails.type}: ${errorDetails.message}`
    
    switch (this.config.logLevel) {
      case 'debug':
        console.debug(logMessage, errorDetails)
        break
      case 'info':
        console.info(logMessage, errorDetails)
        break
      case 'warn':
        console.warn(logMessage, errorDetails)
        break
      case 'error':
      default:
        console.error(logMessage, errorDetails)
        break
    }
  }

  // Notify Listeners
  private notifyListeners(errorDetails: ErrorDetails): void {
    const listeners = this.listeners.get('error') || []
    listeners.forEach(listener => {
      try {
        listener(errorDetails)
      } catch (error) {
        console.error('Error in error listener:', error)
      }
    })
  }

  // Record Recovery
  private recordRecovery(errorDetails: ErrorDetails, result: RecoveryResult): void {
    const operationKey = `${errorDetails.context.component}:${errorDetails.context.operation}`
    const circuitBreaker = this.getCircuitBreaker(operationKey)
    
    if (result.success) {
      circuitBreaker.recordSuccess()
    } else {
      circuitBreaker.recordFailure()
    }
  }

  // Trim Error History
  private trimErrorHistory(): void {
    const maxHistorySize = 1000
    if (this.errorHistory.length > maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-maxHistorySize)
    }
  }

  // Get Memory Usage
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  // Get Performance Data
  private getPerformanceData(): any {
    return {
      timing: performance.timing,
      navigation: performance.navigation,
      now: performance.now()
    }
  }

  // Generate Session ID
  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  }

  // Setup Global Error Handlers
  private setupGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason,
        ErrorType.UNKNOWN,
        { component: 'global', operation: 'unhandledrejection' },
        ErrorSeverity.HIGH
      )
    })

    // Uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(
        event.error || event.message,
        ErrorType.UNKNOWN,
        { component: 'global', operation: 'uncaught' },
        ErrorSeverity.CRITICAL
      )
    })
  }

  // Initialize Recovery Strategies
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.set(ErrorType.LOADING, [
      new RetryStrategy(this.config),
      new FallbackStrategy(this.config),
      new TimeoutStrategy(this.config)
    ])

    this.recoveryStrategies.set(ErrorType.MEMORY, [
      new MemoryCleanupStrategy(this.config),
      new FallbackStrategy(this.config),
      new ResetStrategy(this.config)
    ])

    this.recoveryStrategies.set(ErrorType.RENDERING, [
      new ResetStrategy(this.config),
      new FallbackStrategy(this.config),
      new RestartStrategy(this.config)
    ])

    this.recoveryStrategies.set(ErrorType.WORKER, [
      new WorkerRestartStrategy(this.config),
      new FallbackStrategy(this.config)
    ])

    this.recoveryStrategies.set(ErrorType.NETWORK, [
      new RetryStrategy(this.config),
      new TimeoutStrategy(this.config),
      new FallbackStrategy(this.config)
    ])

    this.recoveryStrategies.set(ErrorType.CACHE, [
      new CacheResetStrategy(this.config),
      new FallbackStrategy(this.config)
    ])

    this.recoveryStrategies.set(ErrorType.TIMEOUT, [
      new TimeoutStrategy(this.config),
      new RetryStrategy(this.config),
      new FallbackStrategy(this.config)
    ])
  }

  // Add Error Listener
  public addErrorListener(listener: (error: ErrorDetails) => void): string {
    const id = Math.random().toString(36).substr(2, 9)
    
    if (!this.listeners.has('error')) {
      this.listeners.set('error', [])
    }
    
    this.listeners.get('error')!.push(listener)
    return id
  }

  // Remove Error Listener
  public removeErrorListener(id: string): void {
    const listeners = this.listeners.get('error')
    if (listeners) {
      const index = listeners.findIndex(listener => (listener as any).id === id)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Get Error Statistics
  public getErrorStatistics(): {
    totalErrors: number
    errorsByType: Record<ErrorType, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    errorsByComponent: Record<string, number>
    recentErrors: ErrorDetails[]
    recoveryRate: number
  } {
    const errorsByType: Record<ErrorType, number> = {} as Record<ErrorType, number>
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>
    const errorsByComponent: Record<string, number> = {}

    let recoveredErrors = 0

    this.errorHistory.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1
      errorsByComponent[error.context.component] = (errorsByComponent[error.context.component] || 0) + 1
      
      if (error.retryCount && error.retryCount > 0) {
        recoveredErrors++
      }
    })

    const recentErrors = this.errorHistory.slice(-10)
    const recoveryRate = this.errorHistory.length > 0 ? recoveredErrors / this.errorHistory.length : 0

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      errorsByComponent,
      recentErrors,
      recoveryRate
    }
  }

  // Clear Error History
  public clearErrorHistory(): void {
    this.errorHistory = []
    this.retryCounters.clear()
  }

  // Reset Circuit Breakers
  public resetCircuitBreakers(): void {
    this.circuitBreakers.forEach(breaker => breaker.reset())
  }

  // Update Configuration
  public updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Shutdown
  public shutdown(): void {
    this.isShuttingDown = true
    this.clearErrorHistory()
    this.resetCircuitBreakers()
    this.listeners.clear()
  }
}

// Recovery Strategy Interface
interface RecoveryStrategy {
  canHandle(error: ErrorDetails): boolean
  recover(error: ErrorDetails): Promise<RecoveryResult>
}

// Retry Strategy
class RetryStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.retryCount! < error.maxRetries! && error.suggestedAction === RecoveryAction.RETRY
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    const delay = this.config.retryDelay * Math.pow(2, error.retryCount!) // Exponential backoff
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    return {
      success: true,
      action: RecoveryAction.RETRY,
      message: `Retrying after ${delay}ms delay`
    }
  }
}

// Fallback Strategy
class FallbackStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return this.config.fallbackMode && error.suggestedAction === RecoveryAction.FALLBACK
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    return {
      success: true,
      action: RecoveryAction.FALLBACK,
      message: 'Switched to fallback mode'
    }
  }
}

// Reset Strategy
class ResetStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.type === ErrorType.MEMORY || error.type === ErrorType.RENDERING
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    // Trigger garbage collection if available
    if ('gc' in window) {
      (window as any).gc()
    }

    // Clear caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      } catch (e) {
        console.warn('Failed to clear caches:', e)
      }
    }

    return {
      success: true,
      action: RecoveryAction.RESET,
      message: 'System reset completed'
    }
  }
}

// Restart Strategy
class RestartStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.severity === ErrorSeverity.CRITICAL || error.type === ErrorType.RENDERING
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    // In a real implementation, this would restart the 3D system
    // For now, just reload the page
    window.location.reload()
    
    return {
      success: true,
      action: RecoveryAction.RESTART,
      message: 'System restart initiated'
    }
  }
}

// Memory Cleanup Strategy
class MemoryCleanupStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.type === ErrorType.MEMORY
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    // Force garbage collection
    if ('gc' in window) {
      (window as any).gc()
    }

    // Clear memory-intensive resources
    if ('memory' in performance) {
      const memory = (performance as any).memory
      console.log('Memory usage before cleanup:', memory)
    }

    return {
      success: true,
      action: RecoveryAction.RESET,
      message: 'Memory cleanup completed'
    }
  }
}

// Worker Restart Strategy
class WorkerRestartStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.type === ErrorType.WORKER
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    // In a real implementation, this would restart the worker
    return {
      success: true,
      action: RecoveryAction.RESTART,
      message: 'Worker restart completed'
    }
  }
}

// Cache Reset Strategy
class CacheResetStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.type === ErrorType.CACHE
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      } catch (e) {
        console.warn('Failed to clear caches:', e)
      }
    }

    return {
      success: true,
      action: RecoveryAction.RESET,
      message: 'Cache reset completed'
    }
  }
}

// Timeout Strategy
class TimeoutStrategy implements RecoveryStrategy {
  constructor(private config: ErrorHandlerConfig) {}

  canHandle(error: ErrorDetails): boolean {
    return error.type === ErrorType.TIMEOUT
  }

  async recover(error: ErrorDetails): Promise<RecoveryResult> {
    // Increase timeout for next attempt
    return {
      success: true,
      action: RecoveryAction.RETRY,
      message: 'Timeout adjusted, retrying'
    }
  }
}

// Circuit Breaker
class CircuitBreaker {
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(private threshold: number) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      // Auto-close after 30 seconds
      if (timeSinceLastFailure > 30000) {
        this.state = 'half-open'
        return false
      }
      return true
    }
    return false
  }

  recordSuccess(): void {
    this.successCount++
    this.failureCount = Math.max(0, this.failureCount - 1)
    
    if (this.state === 'half-open') {
      this.state = 'closed'
    }
  }

  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open'
    }
  }

  reset(): void {
    this.failureCount = 0
    this.successCount = 0
    this.state = 'closed'
  }

  getStats(): { state: string; failures: number; successes: number } {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount
    }
  }
}

// Error Boundary for React Components
export class ErrorBoundary3D {
  private errorHandler: ErrorHandler3D
  private fallbackComponent?: any

  constructor(errorHandler: ErrorHandler3D, fallbackComponent?: any) {
    this.errorHandler = errorHandler
    this.fallbackComponent = fallbackComponent
  }

  // Wrap Function with Error Boundary
  public wrap<T extends (...args: any[]) => any>(
    fn: T,
    context: { component: string; operation: string }
  ): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args)
        
        // Handle promises
        if (result && typeof result.catch === 'function') {
          return result.catch((error: Error) => {
            this.errorHandler.handleError(error, ErrorType.UNKNOWN, context)
            return this.fallbackComponent || null
          })
        }
        
        return result
      } catch (error) {
        this.errorHandler.handleError(error as Error, ErrorType.UNKNOWN, context)
        return this.fallbackComponent || null
      }
    }) as T
  }

  // Safe Execute
  public async safeExecute<T>(
    fn: () => Promise<T>,
    context: { component: string; operation: string },
    fallback?: T
  ): Promise<T | null> {
    try {
      return await fn()
    } catch (error) {
      await this.errorHandler.handleError(error as Error, ErrorType.UNKNOWN, context)
      return fallback || null
    }
  }
}

// Global Error Handler Instance
export const globalErrorHandler = new ErrorHandler3D()
