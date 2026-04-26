/**
 * Comprehensive TypeScript Types for AI Integration
 * Defines all interfaces and types for enhanced type safety
 */

// Core AI Provider Types
export interface AIProvider {
  name: string;
  type: 'local' | 'cloud' | 'hybrid';
  endpoint: string;
  priority: number;
  limits: ProviderLimits;
  features: AIFeature[];
  status: ProviderStatus;
  healthCheck: () => Promise<boolean>;
}

export interface ProviderLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrentRequests: number;
  maxTokensPerRequest: number;
  dailyRequests?: number;
  monthlyTokens?: number;
}

export type AIFeature = 'chat' | 'embeddings' | 'vision' | 'audio' | 'multimodal' | 'tool-calling';

export interface ProviderStatus {
  healthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorCount: number;
  uptime: number;
}

// Message and Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  tokens?: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  provider: string;
  processingTime: number;
  confidence?: number;
  workflowStage?: string;
  reasoning?: string;
  tools?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: 'pending' | 'completed' | 'failed';
}

// Request and Response Types
export interface AIRequest {
  type: 'chat' | 'embeddings' | 'vision' | 'audio';
  payload: ChatRequest | EmbeddingsRequest | VisionRequest | AudioRequest;
  options: RequestOptions;
  context?: RequestContext;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface EmbeddingsRequest {
  input: string | string[];
  model?: string;
}

export interface VisionRequest {
  image: string | Buffer;
  prompt?: string;
  model?: string;
}

export interface AudioRequest {
  audio: string | Buffer;
  model?: string;
  language?: string;
}

export interface RequestOptions {
  provider?: string;
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high';
  cache?: boolean;
  stream?: boolean;
}

export interface RequestContext {
  analysisData?: AnalysisData;
  files?: FileInfo[];
  categories?: Record<string, CategoryInfo>;
  sessionId?: string;
  userId?: string;
}

export interface AnalysisData {
  totalFiles: number;
  totalSize: string;
  categories: Record<string, number>;
  largestFile: string;
  analysisTime: string;
}

export interface FileInfo {
  name: string;
  size: string;
  path: string;
  type: string;
  modified: Date;
}

export interface CategoryInfo {
  count: number;
  size: string;
}

// Response Types
export interface AIResponse {
  id: string;
  provider: string;
  type: 'chat' | 'embeddings' | 'vision' | 'audio';
  success: boolean;
  data: ChatResponse | EmbeddingsResponse | VisionResponse | AudioResponse;
  metadata: ResponseMetadata;
  usage: UsageInfo;
}

export interface ChatResponse {
  message: ChatMessage;
  summary?: string;
  recommendations?: string[];
  confidence: number;
  workflowStage: string;
  reasoning?: string;
  tools?: ToolCall[];
}

export interface EmbeddingsResponse {
  embeddings: number[][];
  dimensions: number;
  model: string;
}

export interface VisionResponse {
  description: string;
  objects?: DetectedObject[];
  confidence: number;
}

export interface AudioResponse {
  transcription: string;
  language: string;
  confidence: number;
}

export interface DetectedObject {
  name: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface ResponseMetadata {
  model: string;
  provider: string;
  processingTime: number;
  timestamp: Date;
  requestId: string;
  cached: boolean;
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// Streaming Types
export interface StreamChunk {
  id: string;
  type: 'content' | 'reasoning' | 'tool_call' | 'end' | 'error';
  content?: string;
  reasoning?: string;
  toolCall?: ToolCall;
  error?: string;
  metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
  provider: string;
  model: string;
  timestamp: Date;
  chunkIndex: number;
  totalChunks?: number;
}

// Usage Tracking Types
export interface UsageTracker {
  provider: string;
  requestType: string;
  timestamp: Date;
  tokens: number;
  duration: number;
  success: boolean;
  cost?: number;
}

export interface UsageStats {
  total: number;
  successful: number;
  failed: number;
  byProvider: Record<string, number>;
  byType: Record<string, number>;
  recent: UsageTracker[];
  costs: Record<string, number>;
}

// Error Types
export interface AIError extends Error {
  code: ErrorCode;
  provider?: string;
  requestId?: string;
  retryable: boolean;
  suggestedAction?: string;
}

export type ErrorCode = 
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PARSING_ERROR'
  | 'UNKNOWN_ERROR';

// Configuration Types
export interface AIConfig {
  providers: ProviderConfig[];
  defaultProvider: string;
  fallbackChain: string[];
  usageTracking: UsageTrackingConfig;
  rateLimiting: RateLimitConfig;
  caching: CachingConfig;
}

export interface ProviderConfig {
  name: string;
  type: 'local' | 'cloud' | 'hybrid';
  endpoint: string;
  apiKey?: string;
  models: ModelConfig[];
  limits: ProviderLimits;
  enabled: boolean;
}

export interface ModelConfig {
  name: string;
  displayName: string;
  features: AIFeature[];
  maxTokens: number;
  contextWindow: number;
  pricing?: ModelPricing;
}

export interface ModelPricing {
  inputTokenPrice: number;
  outputTokenPrice: number;
  currency: string;
}

export interface UsageTrackingConfig {
  enabled: boolean;
  retentionDays: number;
  anonymize: boolean;
  exportFormat: 'json' | 'csv' | 'prometheus';
}

export interface RateLimitConfig {
  enabled: boolean;
  defaultLimits: ProviderLimits;
  customLimits: Record<string, ProviderLimits>;
  burstAllowance: number;
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
}

// Event Types
export interface AIEvent {
  type: EventType;
  timestamp: Date;
  data: any;
  provider?: string;
  requestId?: string;
}

export type EventType = 
  | 'provider_switch'
  | 'request_start'
  | 'request_complete'
  | 'request_failed'
  | 'stream_start'
  | 'stream_chunk'
  | 'stream_end'
  | 'usage_limit_reached'
  | 'error';

// Hook Types for React
export interface UseAIChatOptions {
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  onError?: (error: AIError) => void;
  onSuccess?: (response: AIResponse) => void;
}

export interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: AIError | null;
  sendMessage: (message: string, options?: RequestOptions) => Promise<void>;
  clearMessages: () => void;
  retry: () => Promise<void>;
  provider: string;
  switchProvider: (provider: string) => void;
}

// Context Types
export interface AIContextValue {
  providers: AIProvider[];
  currentProvider: string;
  usage: UsageStats;
  config: AIConfig;
  switchProvider: (provider: string) => void;
  getProviderStatus: () => ProviderStatus;
  updateConfig: (config: Partial<AIConfig>) => void;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Export all types
// Removed broken exports
