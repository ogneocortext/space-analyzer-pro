/**
 * Zod Validation Schemas for Ollama Integration
 * Optimized for Ollama 0.23.0 localhost operation
 */

import { z } from 'zod';

// ============================================================================
// Ollama Model Schemas
// ============================================================================

export const OllamaModelDetailsSchema = z.object({
  parent_model: z.string().optional(),
  format: z.string(),
  family: z.string(),
  families: z.array(z.string()),
  parameter_size: z.string(),
  quantization_level: z.string(),
});

export const OllamaModelSchema = z.object({
  name: z.string().min(1, "Model name is required"),
  model: z.string().min(1, "Model identifier is required"),
  modified_at: z.string().datetime(),
  size: z.number().int().positive("Model size must be positive"),
  digest: z.string().length(64, "SHA256 digest must be 64 characters"),
  details: OllamaModelDetailsSchema,
  vision_capable: z.boolean().optional(),
});

// ============================================================================
// Chat & Message Schemas
// ============================================================================

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, "Message content is required"),
  timestamp: z.date().or(z.string().datetime()),
  model: z.string().optional(),
  images: z.array(z.string()).optional(), // Base64 encoded images
});

export const ChatRequestSchema = z.object({
  model: z.string().min(1, "Model name is required"),
  messages: z.array(ChatMessageSchema).min(1, "At least one message required"),
  stream: z.boolean().optional().default(false),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().positive().optional(),
    num_ctx: z.number().int().positive().optional(),
    num_predict: z.number().int().optional(),
    stop: z.array(z.string()).optional(),
    seed: z.number().int().optional(),
  }).optional(),
  tools: z.array(z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.any()),
    }),
  })).optional(), // Ollama 0.23.0 tool calling support
});

// ============================================================================
// Response Schemas
// ============================================================================

export const OllamaResponseSchema = z.object({
  model: z.string(),
  created_at: z.string().datetime(),
  response: z.string(),
  done: z.boolean(),
  total_duration: z.number().int().positive().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  eval_count: z.number().int().nonnegative().optional(),
  context: z.array(z.number()).optional(),
  used_model: z.string().optional(),
  // Tool calling (Ollama 0.23.0+)
  tool_calls: z.array(z.object({
    function: z.object({
      name: z.string(),
      arguments: z.record(z.any()),
    }),
  })).optional(),
});

// ============================================================================
// Generation Request/Response Schemas
// ============================================================================

export const GenerateRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1, "Prompt is required"),
  suffix: z.string().optional(),
  images: z.array(z.string()).optional(),
  format: z.enum(['json']).optional(),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().positive().optional(),
    num_ctx: z.number().int().positive().optional(),
    num_predict: z.number().int().optional(),
    seed: z.number().int().optional(),
  }).optional(),
  system: z.string().optional(),
  template: z.string().optional(),
  context: z.array(z.number()).optional(),
  stream: z.boolean().optional().default(false),
  raw: z.boolean().optional(),
  keep_alive: z.union([z.string(), z.number()]).optional(),
});

export const GenerateResponseSchema = z.object({
  model: z.string(),
  created_at: z.string().datetime(),
  response: z.string(),
  done: z.boolean(),
  context: z.array(z.number()).optional(),
  total_duration: z.number().int().positive().optional(),
  load_duration: z.number().int().positive().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  prompt_eval_duration: z.number().int().positive().optional(),
  eval_count: z.number().int().nonnegative().optional(),
  eval_duration: z.number().int().positive().optional(),
});

// ============================================================================
// Embedding Schemas
// ============================================================================

export const EmbeddingRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  options: z.record(z.any()).optional(),
  keep_alive: z.union([z.string(), z.number()]).optional(),
});

export const EmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()),
});

// ============================================================================
// Vision Analysis Schemas
// ============================================================================

export const VisionObjectSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export const VisionColorsSchema = z.object({
  dominant: z.array(z.string()),
  palette: z.array(z.string()),
});

export const VisionTechnicalDetailsSchema = z.object({
  resolution: z.string(),
  aspect_ratio: z.string(),
  estimated_quality: z.string(),
});

export const VisionFileAnalysisSchema = z.object({
  type: z.string(),
  relevance_score: z.number().min(0).max(1),
  insights: z.array(z.string()),
});

export const VisionAnalysisResultSchema = z.object({
  description: z.string(),
  objects: z.array(VisionObjectSchema),
  text_detected: z.array(z.string()).optional(),
  scene_type: z.string().optional(),
  colors: VisionColorsSchema,
  technical_details: VisionTechnicalDetailsSchema.optional(),
  file_analysis: VisionFileAnalysisSchema.optional(),
});

// ============================================================================
// Ollama 0.23.0 New Features
// ============================================================================

// OpenClaw Web Search (Ollama 0.23.0+)
export const OpenClawSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  source: z.string(),
});

export const OpenClawSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(OpenClawSearchResultSchema),
  total_results: z.number().int().nonnegative(),
});

// Featured Models (Ollama 0.23.0+)
export const FeaturedModelSchema = z.object({
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  recommended: z.boolean().optional(),
});

export const FeaturedModelsResponseSchema = z.object({
  models: z.array(FeaturedModelSchema),
  last_updated: z.string().datetime(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const OllamaConfigSchema = z.object({
  baseUrl: z.string().url().default('http://localhost:11434'),
  defaultModel: z.string().min(1).default('qwen2.5-coder:7b-instruct'),
  defaultNumCtx: z.number().int().positive().min(1024).max(32768).default(4096),
  timeout: z.number().int().positive().default(30000),
  retries: z.number().int().nonnegative().default(3),
  enableTools: z.boolean().default(true), // Ollama 0.23.0 tool calling
  enableWebSearch: z.boolean().default(false), // OpenClaw feature
});

// ============================================================================
// Type Exports (for TypeScript compatibility)
// ============================================================================

export type OllamaModelDetails = z.infer<typeof OllamaModelDetailsSchema>;
export type OllamaModel = z.infer<typeof OllamaModelSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type OllamaResponse = z.infer<typeof OllamaResponseSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;
export type VisionAnalysisResult = z.infer<typeof VisionAnalysisResultSchema>;
export type OpenClawSearchResult = z.infer<typeof OpenClawSearchResultSchema>;
export type OpenClawSearchResponse = z.infer<typeof OpenClawSearchResponseSchema>;
export type FeaturedModel = z.infer<typeof FeaturedModelSchema>;
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;
