/**
 * Enhanced AI Chat Service
 * Integrates with unified AI workflow backend
 */

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    model?: string;
}

export interface ChatResponse {
    success: boolean;
    response: {
        summary: string;
        recommendations: string[];
        patterns: any[];
        optimizations: string[];
        modelUsed: string;
        confidence: number;
        workflowStage: string;
        selfLearningBase?: any;
        ollamaEnhancement?: any;
        improvement?: any;
    };
    metadata: {
        workflow: string;
        aiFeatures: {
            selfLearning: boolean;
            ollama: boolean;
            analysisDepth: string;
        };
        modelUsed: string;
        processingTime: number;
        context: any;
        timestamp: string;
    };
}

export interface StreamingChunk {
    type: 'start' | 'content' | 'end';
    model?: string;
    stage?: string;
    content?: string;
    recommendations?: string[];
    confidence?: number;
    improvement?: any;
}

export class AIChatService {
    private static instance: AIChatService;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = process.env.NODE_ENV === 'production' 
            ? 'http://localhost:8080' 
            : 'http://localhost:8080';
    }

    static getInstance(): AIChatService {
        if (!AIChatService.instance) {
            AIChatService.instance = new AIChatService();
        }
        return AIChatService.instance;
    }

    /**
     * Send message through unified AI workflow
     */
    async sendMessage(
        message: string, 
        context?: any,
        options: {
            enableSelfLearning?: boolean;
            enableOllama?: boolean;
            analysisDepth?: string;
            modelPreference?: string;
        } = {}
    ): Promise<ChatResponse> {
        try {
            console.log('💬 Sending message through unified AI workflow...');

            const response = await fetch(`${this.baseUrl}/api/ai-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{ 
                        role: 'user', 
                        content: message,
                        timestamp: new Date()
                    }],
                    context,
                    options: {
                        enableSelfLearning: options.enableSelfLearning ?? true,
                        enableOllama: options.enableOllama ?? true,
                        analysisDepth: options.analysisDepth ?? 'comprehensive',
                        modelPreference: options.modelPreference ?? 'auto'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error('❌ AI chat service failed:', error);
            throw error;
        }
    }

    /**
     * Send message with streaming response
     */
    async sendMessageStreaming(
        message: string,
        context?: any,
        options: any = {},
        onChunk?: (chunk: StreamingChunk) => void,
        onComplete?: (response: ChatResponse) => void
    ): Promise<void> {
        try {
            console.log('🌊 Starting streaming AI chat...');

            const response = await fetch(`${this.baseUrl}/api/ai-chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{ 
                        role: 'user', 
                        content: message,
                        timestamp: new Date()
                    }],
                    context,
                    options
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Streaming not supported');
            }

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (onChunk) onChunk(data);
                    } catch (e) {
                        console.warn('Failed to parse chunk:', e);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Streaming AI chat failed:', error);
            throw error;
        }
    }

    /**
     * Get AI capabilities and status
     */
    async getAIStatus(): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            const health = await response.json();
            
            return {
                backend: health.backend || false,
                ollama: health.ollama || false,
                models: health.models || [],
                capabilities: {
                    vision: health.vision || false,
                    selfLearning: health.selfLearning || false,
                    enhancedWorkflow: health.enhancedWorkflow || false
                }
            };
        } catch (error) {
            console.error('❌ Failed to get AI status:', error);
            return {
                backend: false,
                ollama: false,
                models: [],
                capabilities: {
                    vision: false,
                    selfLearning: false,
                    enhancedWorkflow: false
                }
            };
        }
    }

    /**
     * Get available AI models
     */
    async getAvailableModels(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/models`);
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('❌ Failed to get models:', error);
            return [];
        }
    }
}

export default AIChatService.getInstance();
