/**
 * Enhanced Streaming Implementation with Retry Logic
 * Implements robust streaming with automatic fallback and retry mechanisms
 */

const { EventEmitter } = require('events');

class EnhancedStreamingService extends EventEmitter {
    constructor() {
        super();
        this.activeStreams = new Map();
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
        };
    }

    async createStream(streamId, request, options = {}) {
        const streamConfig = {
            id: streamId,
            request,
            options,
            retryCount: 0,
            lastError: null,
            startTime: Date.now(),
            provider: options.provider || 'ollama'
        };

        this.activeStreams.set(streamId, streamConfig);
        
        try {
            return await this.executeStream(streamConfig);
        } catch (error) {
            return await this.handleStreamError(streamConfig, error);
        }
    }

    async executeStream(streamConfig) {
        const { request, options, provider } = streamConfig;
        
        // Create Server-Sent Events stream
        const stream = new ReadableStream({
            start(controller) {
                this.setupStreamController(controller, streamConfig);
            },
            cancel() {
                this.cleanupStream(streamConfig.id);
            }
        });

        return stream;
    }

    setupStreamController(controller, streamConfig) {
        const { request, options } = streamConfig;
        
        // Start the streaming process
        this.processStreamingRequest(request, options)
            .then(() => {
                // Stream completed successfully
                controller.close();
                this.emit('streamCompleted', streamConfig.id);
            })
            .catch((error) => {
                // Stream failed
                controller.error(error);
                this.emit('streamError', streamConfig.id, error);
            });
    }

    async processStreamingRequest(request, options) {
        const { messages, context } = request;
        const aiManager = require('./OpenSourceAIManager');
        
        try {
            // Process with current provider
            const response = await aiManager.processRequest('chat', { messages, context }, {
                ...options,
                stream: true
            });

            // Handle streaming response
            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            
                            if (data === '[DONE]') {
                                this.emit('streamEnd');
                                return;
                            }
                            
                            try {
                                const parsed = JSON.parse(data);
                                this.emit('streamChunk', parsed);
                            } catch (e) {
                                // Skip invalid JSON
                                continue;
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            throw new Error(`Streaming request failed: ${error.message}`);
        }
    }

    async handleStreamError(streamConfig, error) {
        const { retryCount } = streamConfig;
        
        if (retryCount < this.retryConfig.maxRetries) {
            // Calculate retry delay with exponential backoff
            const delay = Math.min(
                this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, retryCount),
                this.retryConfig.maxDelay
            );
            
            console.log(`🔄 Retrying stream ${streamConfig.id} in ${delay}ms (attempt ${retryCount + 1})`);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Update retry count
            streamConfig.retryCount++;
            streamConfig.lastError = error;
            
            // Try again
            try {
                return await this.executeStream(streamConfig);
            } catch (retryError) {
                return await this.handleStreamError(streamConfig, retryError);
            }
        } else {
            // Max retries exceeded
            console.error(`❌ Stream ${streamConfig.id} failed after ${this.retryConfig.maxRetries} retries`);
            throw error;
        }
    }

    cleanupStream(streamId) {
        this.activeStreams.delete(streamId);
        this.emit('streamCleanup', streamId);
    }

    getActiveStreams() {
        return Array.from(this.activeStreams.values()).map(config => ({
            id: config.id,
            provider: config.provider,
            retryCount: config.retryCount,
            startTime: config.startTime,
            duration: Date.now() - config.startTime
        }));
    }

    async healthCheck() {
        const aiManager = require('./OpenSourceAIManager');
        const status = aiManager.getProviderStatus();
        
        return {
            streaming: true,
            activeStreams: this.activeStreams.size,
            providerStatus: status,
            retryConfig: this.retryConfig
        };
    }
}

module.exports = EnhancedStreamingService;
