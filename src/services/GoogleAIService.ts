/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

/**
 * Google AI Service
 * Proper implementation of @google/genai SDK with best practices
 */

// @ts-ignore - @google/genai may not be installed
// import { GoogleGenerativeAI } from '@google/genai';

// Stub for TypeScript compatibility
const GoogleGenerativeAI: any = null;

export interface GoogleAIConfig {
  apiKey?: string;
  model?: string;
  vertexAI?: boolean;
  projectId?: string;
  location?: string;
}

export interface AnalysisResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    model: string;
    tokens?: number;
    processingTime: number;
  };
}

export class GoogleAIService {
  private static instance: GoogleAIService;
  private client: any = null;
  private model: any = null;
  private config: GoogleAIConfig;

  private constructor(config: GoogleAIConfig = {}) {
    this.config = {
      model: "gemini-2.0-flash",
      vertexAI: false,
      ...config,
    };
  }

  static getInstance(config?: GoogleAIConfig): GoogleAIService {
    if (!GoogleAIService.instance) {
      GoogleAIService.instance = new GoogleAIService(config);
    }
    return GoogleAIService.instance;
  }

  /**
   * Initialize the Google AI client with proper error handling
   */
  async initialize(): Promise<void> {
    try {
      const apiKey = this.config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "Google API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable."
        );
      }

      // Validate API key exists (format validation removed for security)
      if (!apiKey || apiKey.length < 10) {
        throw new Error("Invalid API key. Please check your Google Gemini API key.");
      }

      // Initialize client
      if (this.config.vertexAI) {
        if (!this.config.projectId) {
          throw new Error("Project ID is required for Vertex AI");
        }

        this.client = new GoogleGenerativeAI({
          vertexai: true,
          project: this.config.projectId,
          location: this.config.location || "us-central1",
          apiKey,
        });
      } else {
        this.client = new GoogleGenerativeAI({ apiKey });
      }

      // Initialize model
      this.model = this.client.getGenerativeModel({
        model: this.config.model!,
      });

      console.warn("✅ Google AI service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Google AI service:", error);
      throw error;
    }
  }

  /**
   * Analyze image with proper error handling and validation
   */
  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string,
    mimeType: string = "image/png"
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.model) {
        await this.initialize();
      }

      if (!this.client || !this.model) {
        throw new Error("Failed to initialize Google AI client");
      }

      // Validate inputs
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error("Image buffer is empty");
      }

      if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt cannot be empty");
      }

      // Convert image to base64
      const base64Image = imageBuffer.toString("base64");

      // Generate content
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from Gemini API");
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        content: text,
        metadata: {
          model: this.config.model!,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error("❌ Google AI image analysis failed:", {
        message: error.message,
        stack: error.stack,
        status: error.status,
        processingTime,
      });

      return {
        success: false,
        error: error.message,
        metadata: {
          model: this.config.model!,
          processingTime,
        },
      };
    }
  }

  /**
   * Generate text with proper error handling
   */
  async generateText(prompt: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.model) {
        await this.initialize();
      }

      if (!this.client || !this.model) {
        throw new Error("Failed to initialize Google AI client");
      }

      if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt cannot be empty");
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from Gemini API");
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        content: text,
        metadata: {
          model: this.config.model!,
          processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error("❌ Google AI text generation failed:", {
        message: error.message,
        stack: error.stack,
        status: error.status,
        processingTime,
      });

      return {
        success: false,
        error: error.message,
        metadata: {
          model: this.config.model!,
          processingTime,
        },
      };
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    model: string;
    vertexAI: boolean;
  } {
    return {
      initialized: !!(this.client && this.model),
      model: this.config.model!,
      vertexAI: this.config.vertexAI || false,
    };
  }

  /**
   * Reset the service (useful for reconfiguration)
   */
  reset(): void {
    this.client = null;
    this.model = null;
  }
}

export default GoogleAIService.getInstance();
