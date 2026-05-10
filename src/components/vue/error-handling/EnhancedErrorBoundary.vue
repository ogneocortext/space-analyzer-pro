<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-container" :class="[errorLevel, { 'minimal': minimalMode }]">
      <!-- Minimal Error Display -->
      <div v-if="minimalMode" class="minimal-error">
        <Icon name="AlertTriangle" class="error-icon" />
        <span class="error-message">{{ minimalErrorMessage }}</span>
        <button @click="retry" class="retry-btn" v-if="canRetry">
          <Icon name="RefreshCw" />
        </button>
      </div>

      <!-- Full Error Display -->
      <div v-else class="full-error">
        <div class="error-header">
          <Icon :name="errorIcon" class="error-icon" />
          <h3>{{ errorTitle }}</h3>
          <button @click="dismiss" class="dismiss-btn">
            <Icon name="X" />
          </button>
        </div>

        <div class="error-content">
          <p class="error-description">{{ errorDescription }}</p>
          
          <!-- Fallback Content -->
          <div v-if="fallbackComponent" class="fallback-content">
            <component :is="fallbackComponent" v-bind="fallbackProps" />
          </div>

          <!-- Error Details (Dev Mode) -->
          <details v-if="isDevelopment && showErrorDetails" class="error-details">
            <summary>Error Details</summary>
            <pre class="error-stack">{{ errorStack }}</pre>
          </details>

          <!-- Action Buttons -->
          <div class="error-actions">
            <button @click="retry" class="action-btn primary" v-if="canRetry">
              <Icon name="RefreshCw" />
              Retry
            </button>
            <button @click="reportError" class="action-btn secondary">
              <Icon name="Bug" />
              Report Issue
            </button>
            <button @click="dismiss" class="action-btn tertiary">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Normal Content (No Error) -->
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { Icon } from '@/components/ui/Icon'
import { GracefulDegradation, DegradationLevel } from '@/core/GracefulDegradation'
import { ResourceManager } from '@/core/ResourceManager'

interface Props {
  fallbackComponent?: any
  fallbackProps?: Record<string, any>
  minimalMode?: boolean
  showErrorDetails?: boolean
  maxRetries?: number
  retryDelay?: number
  onError?: (error: Error, errorInfo: any) => void
  customFallbacks?: Record<string, () => any>
}

const props = withDefaults(defineProps<Props>(), {
  minimalMode: false,
  showErrorDetails: false,
  maxRetries: 3,
  retryDelay: 1000
})

const emit = defineEmits<{
  error: [error: Error, errorInfo: any]
  retry: []
  dismiss: []
}>()

const hasError = ref(false)
const error = ref<Error | null>(null)
const errorInfo = ref<any>(null)
const retryCount = ref(0)
const errorBoundaryId = ref(`error-boundary-${Math.random().toString(36).substr(2, 9)}`)

const isDevelopment = computed(() => import.meta.env.DEV)

const errorLevel = computed(() => {
  if (!error.value) return 'info'
  
  // Determine error severity based on error type and current degradation level
  const degradations = GracefulDegradation.getInstance()
  const level = degradations.getCurrentLevel()
  
  if (level === DegradationLevel.OFFLINE) return 'warning'
  if (error.value.name === 'ChunkLoadError') return 'critical'
  if (error.value.message?.includes('timeout')) return 'warning'
  if (error.value.message?.includes('network')) return 'warning'
  
  return 'error'
})

const errorIcon = computed(() => {
  switch (errorLevel.value) {
    case 'critical': return 'AlertOctagon'
    case 'warning': return 'AlertTriangle'
    default: return 'AlertCircle'
  }
})

const errorTitle = computed(() => {
  switch (errorLevel.value) {
    case 'critical': return 'Critical Error'
    case 'warning': return 'Service Unavailable'
    default: return 'Something Went Wrong'
  }
})

const errorDescription = computed(() => {
  if (!error.value) return ''
  
  // Provide user-friendly error messages
  const message = error.value.message.toLowerCase()
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }
  
  if (message.includes('timeout')) {
    return 'The operation took too long to complete. Please try again.'
  }
  
  if (message.includes('chunk') || message.includes('loading')) {
    return 'Failed to load application resources. Please refresh the page.'
  }
  
  if (message.includes('permission') || message.includes('access')) {
    return 'You don\'t have permission to perform this action.'
  }
  
  return 'An unexpected error occurred. We\'re working to fix this issue.'
})

const minimalErrorMessage = computed(() => {
  return errorDescription.value.split('.')[0] + '.'
})

const errorStack = computed(() => {
  return error.value?.stack || 'No stack trace available'
})

const canRetry = computed(() => {
  return retryCount.value < props.maxRetries && 
         errorLevel.value !== 'critical' &&
         !error.value?.message?.includes('permission')
})

onErrorCaptured((err: Error, instance, info) => {
  console.error('ErrorBoundary caught error:', err, info)
  
  error.value = err
  errorInfo.value = { instance, info }
  hasError.value = true
  
  // Register error for cleanup
  ResourceManager.getInstance().register(
    `${errorBoundaryId.value}-error`,
    { error: err, info },
    {
      name: 'Error Boundary Error',
      type: 'memory',
      priority: 'low'
    }
  )
  
  // Call custom error handler
  if (props.onError) {
    props.onError(err, { instance, info })
  }
  
  // Emit error event
  emit('error', err, { instance, info })
  
  // Try to get custom fallback
  if (props.customFallbacks && error.value) {
    const errorType = getErrorType(err)
    const customFallback = props.customFallbacks[errorType]
    if (customFallback) {
      console.log(`Using custom fallback for ${errorType}`)
      return customFallback()
    }
  }
  
  // Prevent error propagation
  return false
})

const retry = async () => {
  if (!canRetry.value) return
  
  retryCount.value++
  hasError.value = false
  error.value = null
  errorInfo.value = null
  
  // Wait before retry
  await new Promise(resolve => setTimeout(resolve, props.retryDelay))
  
  emit('retry')
}

const dismiss = () => {
  hasError.value = false
  emit('dismiss')
}

const reportError = () => {
  if (!error.value) return
  
  // Create error report
  const report = {
    error: {
      name: error.value.name,
      message: error.value.message,
      stack: error.value.stack
    },
    errorInfo: errorInfo.value,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    retryCount: retryCount.value,
    degradationsLevel: GracefulDegradation.getInstance().getCurrentLevel()
  }
  
  // Send to error reporting service
  fetch('/api/errors/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  }).catch(err => {
    console.error('Failed to report error:', err)
  })
  
  // Also try to open GitHub issues page
  const title = encodeURIComponent(`Error: ${error.value.message}`)
  const body = encodeURIComponent(`
**Error:** ${error.value.message}

**Stack Trace:**
\`\`\`
${error.value.stack}
\`\`\`

**Context:**
- URL: ${window.location.href}
- User Agent: ${navigator.userAgent}
- Timestamp: ${new Date().toISOString()}
- Retry Count: ${retryCount.value}
  `)
  
  window.open(`https://github.com/ogneocortext/space-analyzer-pro/issues/new?title=${title}&body=${body}`)
}

const getErrorType = (error: Error): string => {
  const message = error.message.toLowerCase()
  
  if (message.includes('network') || message.includes('fetch')) return 'network'
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('chunk') || message.includes('loading')) return 'loading'
  if (message.includes('permission') || message.includes('access')) return 'permission'
  if (message.includes('ai') || message.includes('ollama')) return 'ai'
  if (message.includes('3d') || message.includes('webgl')) return '3d'
  if (message.includes('analysis') || message.includes('scan')) return 'analysis'
  
  return 'unknown'
}

onMounted(() => {
  // Register with graceful degradation
  const degradations = GracefulDegradation.getInstance()
  degradations.registerFeature({
    name: 'error-boundary',
    essential: true,
    dependencies: []
  })
})

onUnmounted(() => {
  // Clean up error resources
  const manager = ResourceManager.getInstance()
  manager.unregister(`${errorBoundaryId.value}-error`)
})
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 1rem;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}

.error-container.info {
  background: #f0f9ff;
  border: 1px solid #bae7ff;
  color: #0958d9;
}

.error-container.warning {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #d46b08;
}

.error-container.error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #cf1322;
}

.error-container.critical {
  background: #fff1f0;
  border: 1px solid #ffa39e;
  color: #a8071a;
}

.minimal-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.full-error {
  max-width: 500px;
  width: 100%;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.error-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.error-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.dismiss-btn {
  margin-left: auto;
  background: none;
  border: none;
  padding: 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.dismiss-btn:hover {
  opacity: 1;
}

.error-content {
  text-align: center;
}

.error-description {
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.fallback-content {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 0.375rem;
}

.error-details {
  margin: 1rem 0;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.error-stack {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.error-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #0958d9;
  color: white;
}

.action-btn.primary:hover {
  background: #0747a1;
}

.action-btn.secondary {
  background: #f5f5f5;
  color: #262626;
  border: 1px solid #d9d9d9;
}

.action-btn.secondary:hover {
  background: #e6f7ff;
  border-color: #91d5ff;
}

.action-btn.tertiary {
  background: transparent;
  color: #8c8c8c;
}

.action-btn.tertiary:hover {
  color: #262626;
  background: #f5f5f5;
}

.retry-btn {
  background: none;
  border: 1px solid currentColor;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: currentColor;
  color: white;
}

@media (max-width: 640px) {
  .error-actions {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>