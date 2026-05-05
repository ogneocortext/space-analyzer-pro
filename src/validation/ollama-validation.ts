/**
 * Validation Utilities for Ollama API
 * Runtime type guards and safe parsers for Ollama 0.23.0
 */

import { z } from 'zod';
import {
  OllamaModelSchema,
  OllamaResponseSchema,
  ChatRequestSchema,
  GenerateRequestSchema,
  GenerateResponseSchema,
  EmbeddingResponseSchema,
  VisionAnalysisResultSchema,
  OpenClawSearchResponseSchema,
  FeaturedModelsResponseSchema,
  OllamaConfigSchema,
  type OllamaModel,
  type OllamaResponse,
  type ChatRequest,
  type GenerateRequest,
  type GenerateResponse,
  type EmbeddingResponse,
  type VisionAnalysisResult,
  type OpenClawSearchResponse,
  type FeaturedModelsResponse,
  type OllamaConfig,
} from './ollama-schemas';

// ============================================================================
// Validation Result Type
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: z.ZodError;
  message?: string;
}

// ============================================================================
// Safe Validators (return ValidationResult)
// ============================================================================

/**
 * Safely validate Ollama model response
 */
export function validateOllamaModel(data: unknown): ValidationResult<OllamaModel> {
  const result = OllamaModelSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'OllamaModel'),
  };
}

/**
 * Safely validate array of Ollama models
 */
export function validateOllamaModels(data: unknown): ValidationResult<OllamaModel[]> {
  const schema = z.array(OllamaModelSchema);
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'OllamaModel[]'),
  };
}

/**
 * Safely validate chat response
 */
export function validateOllamaResponse(data: unknown): ValidationResult<OllamaResponse> {
  const result = OllamaResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'OllamaResponse'),
  };
}

/**
 * Safely validate chat request before sending
 */
export function validateChatRequest(data: unknown): ValidationResult<ChatRequest> {
  const result = ChatRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'ChatRequest'),
  };
}

/**
 * Safely validate generate request
 */
export function validateGenerateRequest(data: unknown): ValidationResult<GenerateRequest> {
  const result = GenerateRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'GenerateRequest'),
  };
}

/**
 * Safely validate generate response
 */
export function validateGenerateResponse(data: unknown): ValidationResult<GenerateResponse> {
  const result = GenerateResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'GenerateResponse'),
  };
}

/**
 * Safely validate embedding response
 */
export function validateEmbeddingResponse(data: unknown): ValidationResult<EmbeddingResponse> {
  const result = EmbeddingResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'EmbeddingResponse'),
  };
}

/**
 * Safely validate vision analysis result
 */
export function validateVisionAnalysis(data: unknown): ValidationResult<VisionAnalysisResult> {
  const result = VisionAnalysisResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'VisionAnalysisResult'),
  };
}

/**
 * Safely validate OpenClaw search response (Ollama 0.23.0+)
 */
export function validateOpenClawSearch(data: unknown): ValidationResult<OpenClawSearchResponse> {
  const result = OpenClawSearchResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'OpenClawSearchResponse'),
  };
}

/**
 * Safely validate featured models response (Ollama 0.23.0+)
 */
export function validateFeaturedModels(data: unknown): ValidationResult<FeaturedModelsResponse> {
  const result = FeaturedModelsResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'FeaturedModelsResponse'),
  };
}

/**
 * Validate Ollama configuration for localhost
 */
export function validateOllamaConfig(data: unknown): ValidationResult<OllamaConfig> {
  const result = OllamaConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error,
    message: formatZodError(result.error, 'OllamaConfig'),
  };
}

// ============================================================================
// Strict Validators (throw on failure)
// ============================================================================

/**
 * Parse and validate Ollama model (throws on failure)
 */
export function parseOllamaModel(data: unknown): OllamaModel {
  return OllamaModelSchema.parse(data);
}

/**
 * Parse and validate chat response (throws on failure)
 */
export function parseOllamaResponse(data: unknown): OllamaResponse {
  return OllamaResponseSchema.parse(data);
}

/**
 * Parse and validate chat request (throws on failure)
 */
export function parseChatRequest(data: unknown): ChatRequest {
  return ChatRequestSchema.parse(data);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Zod error into human-readable message
 */
function formatZodError(error: z.ZodError, context: string): string {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `  - ${path}: ${issue.message}`;
  });
  
  return `Validation failed for ${context}:\n${issues.join('\n')}`;
}

/**
 * Check if data appears to be a valid Ollama response (quick check)
 */
export function isOllamaResponse(data: unknown): data is Record<string, unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'model' in data &&
    'response' in data &&
    'done' in data
  );
}

/**
 * Check if response indicates streaming is complete
 */
export function isStreamComplete(data: unknown): boolean {
  if (!isOllamaResponse(data)) return false;
  return data.done === true;
}

/**
 * Extract error message from Ollama error response
 */
export function extractOllamaError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return formatZodError(error, 'Ollama API Response');
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    if ('error' in errorObj && typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    if ('message' in errorObj && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
  }
  
  return 'Unknown Ollama error';
}

// ============================================================================
// Localhost-Specific Validators
// ============================================================================

/**
 * Validate that URL is localhost Ollama endpoint
 */
export function isLocalhostOllama(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    const isOllamaPort = parsed.port === '11434' || parsed.port === '';
    return isLocalhost && isOllamaPort;
  } catch {
    return false;
  }
}

/**
 * Get safe default config for localhost Ollama
 */
export function getLocalhostOllamaConfig(): OllamaConfig {
  return {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2.5-coder:7b-instruct',
    defaultNumCtx: 4096,
    timeout: 30000,
    retries: 3,
    enableTools: true,
    enableWebSearch: false,
  };
}
