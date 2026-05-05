/**
 * Ollama Validation Test Suite
 * Tests Zod schemas, validation utilities, and OllamaService integration
 * Run with: npm test -- ollama-validation.test.ts
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  validateOllamaModels,
  validateOllamaResponse,
  validateChatRequest,
  validateGenerateResponse,
  validateOpenClawSearch,
  validateFeaturedModels,
  extractOllamaError,
  isLocalhostOllama,
  getLocalhostOllamaConfig,
} from "@/validation/ollama-validation";
import { ollamaRateLimiter } from "@/services/ai/OllamaRateLimiter";
import { localToolRegistry } from "@/services/ai/tools/LocalToolRegistry";
import { getOllamaConfig, isLocalhostOnly } from "@/config/env";

describe("Ollama Validation Tests", () => {
  // ============================================================================
  // Schema Validation Tests
  // ============================================================================
  
  describe("Schema Validation", () => {
    it("should validate correct Ollama model data", () => {
      const validModel = {
        name: "qwen2.5-coder:7b-instruct",
        model: "qwen2.5-coder:7b-instruct",
        modified_at: "2024-01-15T10:30:00Z",
        size: 4370000000,
        digest: "sha256:abc123...",
        details: {
          format: "gguf",
          family: "qwen2.5",
          families: ["qwen2.5"],
          parameter_size: "7B",
          quantization_level: "Q4_0",
        },
      };

      const result = validateOllamaModels([validModel]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].name).toBe("qwen2.5-coder:7b-instruct");
    });

    it("should reject invalid model data", () => {
      const invalidModel = {
        name: "", // Empty name - should fail
        modified_at: "invalid-date",
        size: -1, // Negative size
      };

      const result = validateOllamaModels([invalidModel]);
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it("should validate correct chat request", () => {
      const validRequest = {
        model: "qwen2.5-coder:7b-instruct",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      };

      const result = validateChatRequest(validRequest);
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe("qwen2.5-coder:7b-instruct");
    });

    it("should reject chat request with invalid role", () => {
      const invalidRequest = {
        model: "qwen2.5-coder:7b-instruct",
        messages: [
          { role: "invalid_role", content: "Hello" },
        ],
        stream: false,
      };

      const result = validateChatRequest(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should validate correct Ollama response", () => {
      const validResponse = {
        model: "qwen2.5-coder:7b-instruct",
        created_at: "2024-01-15T10:30:00Z",
        message: {
          role: "assistant",
          content: "Here's some code...",
        },
        done: true,
        total_duration: 1234567890,
        load_duration: 123456789,
        prompt_eval_count: 50,
        eval_count: 100,
      };

      const result = validateOllamaResponse(validResponse);
      expect(result.success).toBe(true);
      expect(result.data?.message.content).toBe("Here's some code...");
    });

    it("should validate OpenClaw search response", () => {
      const validSearchResponse = {
        query: "TypeScript best practices",
        results: [
          {
            title: "TypeScript Handbook",
            url: "https://www.typescriptlang.org/docs/",
            snippet: "The TypeScript Handbook is a comprehensive guide...",
            source: "typescriptlang.org",
          },
        ],
        total_results: 1,
      };

      const result = validateOpenClawSearch(validSearchResponse);
      expect(result.success).toBe(true);
      expect(result.data?.query).toBe("TypeScript best practices");
    });

    it("should validate featured models response", () => {
      const validFeaturedResponse = {
        models: [
          {
            name: "llama3.2-vision",
            description: "Vision-capable model",
            tags: ["vision", "multimodal"],
            recommended: true,
          },
        ],
        last_updated: "2024-01-15T10:00:00Z",
      };

      const result = validateFeaturedModels(validFeaturedResponse);
      expect(result.success).toBe(true);
      expect(result.data?.models[0].recommended).toBe(true);
    });
  });

  // ============================================================================
  // Error Extraction Tests
  // ============================================================================

  describe("Error Extraction", () => {
    it("should extract error from Error object", () => {
      const error = new Error("Connection refused");
      const extracted = extractOllamaError(error);
      expect(extracted).toContain("Connection refused");
    });

    it("should handle string errors", () => {
      const extracted = extractOllamaError("Something went wrong");
      expect(extracted).toBe("Something went wrong");
    });

    it("should handle null/undefined", () => {
      expect(extractOllamaError(null)).toBe("Unknown error");
      expect(extractOllamaError(undefined)).toBe("Unknown error");
    });

    it("should handle fetch error response", () => {
      const fetchError = {
        status: 500,
        statusText: "Internal Server Error",
      };
      const extracted = extractOllamaError(fetchError);
      expect(extracted).toContain("500");
    });
  });

  // ============================================================================
  // Localhost Detection Tests
  // ============================================================================

  describe("Localhost Detection", () => {
    it("should detect localhost URLs", () => {
      expect(isLocalhostOllama("http://localhost:11434")).toBe(true);
      expect(isLocalhostOllama("http://127.0.0.1:11434")).toBe(true);
      expect(isLocalhostOllama("http://[::1]:11434")).toBe(true);
    });

    it("should reject non-localhost URLs", () => {
      expect(isLocalhostOllama("http://ollama.com")).toBe(false);
      expect(isLocalhostOllama("https://api.ollama.ai")).toBe(false);
      expect(isLocalhostOllama("http://192.168.1.100:11434")).toBe(false);
    });

    it("should return localhost config", () => {
      const config = getLocalhostOllamaConfig();
      expect(config.baseUrl).toBe("http://localhost:11434");
      expect(config.timeout).toBe(30000);
      expect(config.retryCount).toBe(3);
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe("Rate Limiting", () => {
    beforeAll(() => {
      // Reset rate limiter state for tests
      localStorage.clear();
    });

    it("should allow calls under limit", () => {
      const result = ollamaRateLimiter.canMakeCall();
      expect(result.allowed).toBe(true);
    });

    it("should track call count", () => {
      const initialStats = ollamaRateLimiter.getUsageStats();
      ollamaRateLimiter.recordCall();
      const newStats = ollamaRateLimiter.getUsageStats();
      
      expect(newStats.callsThisSession).toBe(initialStats.callsThisSession + 1);
    });

    it("should block calls in local-only mode", () => {
      ollamaRateLimiter.setLocalOnlyMode();
      const result = ollamaRateLimiter.canMakeCall();
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Local-only mode");
    });

    it("should report correct usage stats", () => {
      const stats = ollamaRateLimiter.getUsageStats();
      
      expect(stats.callsThisSession).toBeDefined();
      expect(stats.callsThisWeek).toBeDefined();
      expect(stats.sessionLimit).toBe(50);
      expect(stats.weekLimit).toBe(200);
      expect(stats.timeUntilSessionReset).toBeDefined();
      expect(stats.timeUntilWeekReset).toBeDefined();
    });
  });

  // ============================================================================
  // Local Tool Registry Tests
  // ============================================================================

  describe("Local Tool Registry", () => {
    it("should have localhost-only tools", () => {
      const localTools = localToolRegistry.getLocalOnlyTools();
      expect(localTools.length).toBeGreaterThan(0);
      expect(localTools).toContain("analyze_directory");
      expect(localTools).toContain("find_duplicates");
      expect(localTools).toContain("find_large_files");
    });

    it("should return tool definitions", () => {
      const definitions = localToolRegistry.getToolDefinitions(false);
      expect(definitions.length).toBeGreaterThan(0);
      
      const analyzeDir = definitions.find(
        d => d.function.name === "analyze_directory"
      );
      expect(analyzeDir).toBeDefined();
      expect(analyzeDir?.function.description).toContain("directory");
    });

    it("should execute calculation tool", async () => {
      const result = await localToolRegistry.executeTool("convert_size", {
        size: 1024,
        from_unit: "MB",
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should reject unknown tools", async () => {
      const result = await localToolRegistry.executeTool("unknown_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should identify cloud-dependent tools", () => {
      const cloudTools = localToolRegistry.getCloudDependentTools();
      // Currently no cloud-dependent tools in the registry
      expect(cloudTools).toEqual([]);
    });
  });

  // ============================================================================
  // Environment Configuration Tests
  // ============================================================================

  describe("Environment Configuration", () => {
    it("should return Ollama config with defaults", () => {
      const config = getOllamaConfig();
      
      expect(config.baseUrl).toBeDefined();
      expect(config.defaultModel).toBeDefined();
      expect(config.timeoutMs).toBeGreaterThan(0);
    });

    it("should detect localhost-only mode", () => {
      // Default should be localhost-only
      const isLocal = isLocalhostOnly();
      expect(typeof isLocal).toBe("boolean");
    });
  });
});

// ============================================================================
// Integration Test Helper
// ============================================================================

/**
 * Run this to test with actual local Ollama instance
 * Requires: Ollama running on http://localhost:11434
 */
export async function runIntegrationTests(): Promise<void> {
  console.log("🧪 Starting Ollama Integration Tests...\n");

  const OLLAMA_URL = "http://localhost:11434";

  // Test 1: Connection
  console.log("1️⃣ Testing connection to Ollama...");
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (response.ok) {
      console.log("   ✅ Connected to Ollama successfully");
      
      const data = await response.json();
      const validation = validateOllamaModels(data.models || []);
      
      if (validation.success) {
        console.log(`   ✅ Validated ${validation.data?.length || 0} models`);
      } else {
        console.error("   ❌ Model validation failed:", validation.message);
      }
    } else {
      console.error(`   ❌ Connection failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("   ❌ Connection error:", extractOllamaError(error));
    console.log("   💡 Is Ollama running? Run: ollama serve");
  }

  // Test 2: Generate
  console.log("\n2️⃣ Testing text generation...");
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:7b-instruct",
        prompt: "Say 'Test successful' and nothing else.",
        stream: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const validation = validateGenerateResponse(data);
      
      if (validation.success) {
        console.log("   ✅ Generation response valid");
        console.log(`   📝 Response: ${data.response?.substring(0, 50)}...`);
      } else {
        console.error("   ❌ Response validation failed:", validation.message);
      }
    } else {
      console.error(`   ❌ Generation failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("   ❌ Generation error:", extractOllamaError(error));
  }

  // Test 3: Chat
  console.log("\n3️⃣ Testing chat API...");
  try {
    const request = {
      model: "qwen2.5-coder:7b-instruct",
      messages: [{ role: "user", content: "Hello" }],
      stream: false,
    };

    const reqValidation = validateChatRequest(request);
    if (reqValidation.success) {
      console.log("   ✅ Chat request valid");
      
      const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = await response.json();
        const respValidation = validateOllamaResponse(data);
        
        if (respValidation.success) {
          console.log("   ✅ Chat response valid");
          console.log(`   📝 AI says: ${data.message?.content?.substring(0, 50)}...`);
        } else {
          console.error("   ❌ Response validation failed:", respValidation.message);
        }
      } else {
        console.error(`   ❌ Chat failed: HTTP ${response.status}`);
      }
    } else {
      console.error("   ❌ Request validation failed:", reqValidation.message);
    }
  } catch (error) {
    console.error("   ❌ Chat error:", extractOllamaError(error));
  }

  // Test 4: Rate Limiting
  console.log("\n4️⃣ Testing rate limiting...");
  const rateCheck = ollamaRateLimiter.canMakeCall();
  console.log(`   ${rateCheck.allowed ? "✅" : "❌"} Rate limit check: ${rateCheck.allowed ? "ALLOWED" : "BLOCKED"}`);
  if (!rateCheck.allowed) {
    console.log(`   📝 Reason: ${rateCheck.reason}`);
  }

  // Test 5: Local Tools
  console.log("\n5️⃣ Testing local tools...");
  const tools = localToolRegistry.getLocalOnlyTools();
  console.log(`   ✅ Found ${tools.length} localhost-only tools`);
  console.log(`   📝 Tools: ${tools.slice(0, 5).join(", ")}${tools.length > 5 ? "..." : ""}`);

  // Test 6: Tool Execution
  console.log("\n6️⃣ Testing tool execution...");
  const toolResult = await localToolRegistry.executeTool("convert_size", {
    size: 1024,
    from_unit: "MB",
  });
  
  if (toolResult.success) {
    console.log("   ✅ Tool execution successful");
    console.log(`   📝 1024 MB = ${(toolResult.data as any).GB} GB`);
  } else {
    console.error("   ❌ Tool execution failed:", toolResult.error);
  }

  console.log("\n✨ Integration tests complete!");
}

// Run integration tests if this file is executed directly
if (import.meta.vitest) {
  // Vitest mode - run unit tests
} else {
  // Direct execution - offer to run integration tests
  console.log("💡 To run integration tests with a live Ollama instance:");
  console.log("   1. Ensure Ollama is running: ollama serve");
  console.log("   2. Import and call runIntegrationTests() from your test runner");
  console.log("   3. Or run: npm test -- ollama-validation.test.ts\n");
}
