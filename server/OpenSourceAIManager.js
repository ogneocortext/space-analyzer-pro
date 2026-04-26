/**
 * Open Source AI Manager with Performance Monitoring
 * Uses performance monitoring for local tools, usage tracking only for external APIs
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const LocalAIPerformanceMonitor = require('./LocalAIPerformanceMonitor');
const CloudAPIUsageTracker = require('./CloudAPIUsageTracker');

class OpenSourceAIManager extends EventEmitter {
    constructor() {
        super();
        this.providers = new Map();
        this.currentProvider = null;
        this.fallbackChain = [];
        this.initialized = false;
        
        // Performance and usage tracking
        this.performanceMonitor = new LocalAIPerformanceMonitor();
        this.usageTracker = new CloudAPIUsageTracker();
        
        // Initialize local AI providers
        this.initializeProviders();
    }

    async initializeProviders() {
        console.log('🔧 Initializing Open Source AI Providers...');
        
        // 1. Ollama (Primary - already configured)
        this.providers.set('ollama', {
            name: 'Ollama',
            type: 'local',
            endpoint: 'http://localhost:11434',
            priority: 1,
            features: ['chat', 'embeddings', 'vision'],
            checkHealth: () => this.checkOllamaHealth(),
            switchTo: () => this.switchToProvider('ollama')
        });

        // 2. LM Studio (Fallback 1)
        this.providers.set('lmstudio', {
            name: 'LM Studio',
            type: 'local',
            endpoint: 'http://localhost:1234',
            priority: 2,
            features: ['chat', 'embeddings'],
            checkHealth: () => this.checkLMStudioHealth(),
            switchTo: () => this.switchToProvider('lmstudio')
        });

        // 3. LocalAI (Fallback 2)
        this.providers.set('localai', {
            name: 'LocalAI',
            type: 'local',
            endpoint: 'http://localhost:8080',
            priority: 3,
            features: ['chat', 'embeddings', 'image'],
            checkHealth: () => this.checkLocalAIHealth(),
            switchTo: () => this.switchToProvider('localai')
        });

        // 4. vLLM (Production fallback)
        this.providers.set('vllm', {
            name: 'vLLM',
            type: 'local',
            endpoint: 'http://localhost:8000',
            priority: 4,
            features: ['chat', 'embeddings', 'multimodal'],
            checkHealth: () => this.checkVLLMHealth(),
            switchTo: () => this.switchToProvider('vllm')
        });

        // Set up fallback chain
        this.fallbackChain = ['ollama', 'lmstudio', 'localai', 'vllm'];
        
        // Set up performance monitoring
        this.setupPerformanceMonitoring();
        
        // Find initial provider
        await this.findBestProvider();
        this.initialized = true;
        
        console.log(`✅ Open Source AI Manager initialized with primary provider: ${this.currentProvider}`);
    }

    setupPerformanceMonitoring() {
        // Listen to performance alerts
        this.performanceMonitor.on('performanceAlert', (alert) => {
            console.log(`🚨 Performance Alert [${alert.severity.toUpperCase()}]: ${alert.type}`);
            console.log(`   Data:`, alert.data);
            
            // Emit to external monitoring system
            this.emit('performanceAlert', alert);
        });

        // Listen to slow response alerts and consider switching providers
        this.performanceMonitor.on('performanceAlert', (alert) => {
            if (alert.type === 'SLOW_RESPONSE' || alert.type === 'CONSECUTIVE_ERRORS') {
                console.log(`🔄 Performance issue detected, considering provider switch...`);
                this.considerProviderSwitch(alert.data.provider);
            }
        });

        // Listen to high error rate alerts
        this.performanceMonitor.on('performanceAlert', (alert) => {
            if (alert.type === 'HIGH_ERROR_RATE') {
                console.log(`🔄 High error rate detected, switching provider...`);
                this.switchToNextAvailableProvider(alert.data.provider);
            }
        });
    }

    async considerProviderSwitch(currentProviderName) {
        const stats = this.performanceMonitor.getPerformanceStats();
        const providerStats = stats.byProvider[currentProviderName];
        
        if (!providerStats) return;

        // Switch if performance is poor
        if (providerStats.successRate < 85 || providerStats.avgResponseTime > 5000) {
            console.log(`🔄 Switching from ${currentProviderName} due to poor performance`);
            await this.switchToNextAvailableProvider(currentProviderName);
        }
    }

    async findBestProvider() {
        console.log('🔍 Scanning for available AI providers...');
        
        for (const providerName of this.fallbackChain) {
            const provider = this.providers.get(providerName);
            if (provider && await provider.checkHealth()) {
                this.currentProvider = providerName;
                console.log(`✅ Selected provider: ${provider.name}`);
                return true;
            }
        }
        
        console.log('❌ No AI providers available');
        return false;
    }

    async checkOllamaHealth() {
        try {
            const response = await fetch('http://localhost:11434/api/tags', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async checkLMStudioHealth() {
        try {
            const response = await fetch('http://localhost:1234/v1/models', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async checkLocalAIHealth() {
        try {
            const response = await fetch('http://localhost:8080/v1/models', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async checkVLLMHealth() {
        try {
            const response = await fetch('http://localhost:8000/v1/models', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async switchToProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        if (!(await provider.checkHealth())) {
            console.log(`⚠️ Provider ${provider.name} is not healthy, finding alternative...`);
            return await this.findNextAvailableProvider(providerName);
        }

        const oldProvider = this.currentProvider;
        this.currentProvider = providerName;
        
        console.log(`🔄 Switched from ${oldProvider} to ${provider.name}`);
        this.emit('providerSwitched', { from: oldProvider, to: providerName });
        
        return true;
    }

    async findNextAvailableProvider(currentProviderName) {
        const currentIndex = this.fallbackChain.indexOf(currentProviderName);
        
        for (let i = currentIndex + 1; i < this.fallbackChain.length; i++) {
            const providerName = this.fallbackChain[i];
            const provider = this.providers.get(providerName);
            
            if (provider && await provider.checkHealth()) {
                await this.switchToProvider(providerName);
                return true;
            }
        }
        
        return false;
    }

    async processRequest(requestType, payload, options = {}) {
        if (!this.initialized) {
            await this.initializeProviders();
        }

        // Determine if this is a local or cloud request
        const isCloudRequest = options.provider && ['vercel', 'google', 'openai', 'anthropic'].includes(options.provider.toLowerCase());
        
        if (isCloudRequest) {
            return await this.processCloudRequest(requestType, payload, options);
        } else {
            return await this.processLocalRequest(requestType, payload, options);
        }
    }

    async processLocalRequest(requestType, payload, options = {}) {
        // Start performance monitoring
        const monitoringId = this.performanceMonitor.startRequestMonitoring(
            this.currentProvider,
            requestType,
            `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );

        try {
            const result = await this.processWithProvider(this.currentProvider, requestType, payload, options);
            
            // End performance monitoring with success
            this.performanceMonitor.endRequestMonitoring(monitoringId, true, null, result.tokens || 0);
            
            return result;
            
        } catch (error) {
            // End performance monitoring with failure
            this.performanceMonitor.endRequestMonitoring(monitoringId, false, error.message, 0);
            
            // Handle provider failure
            console.log(`❌ Provider ${this.currentProvider} failed: ${error.message}`);
            
            // Try to switch to next provider
            const switched = await this.findNextAvailableProvider(this.currentProvider);
            if (switched) {
                console.log(`🔄 Retrying with new provider: ${this.currentProvider}`);
                return await this.processLocalRequest(requestType, payload, options);
            }
            
            throw error;
        }
    }

    async processCloudRequest(requestType, payload, options = {}) {
        const providerName = options.provider.toLowerCase();
        
        // Track usage for cloud APIs
        this.usageTracker.trackUsage(providerName, requestType, options.tokens || 0);
        
        // Check if we should switch to local due to usage limits
        if (this.shouldSwitchToLocal(providerName)) {
            console.log(`⚠️ Cloud provider ${providerName} usage limits approaching, switching to local...`);
            return await this.processLocalRequest(requestType, payload, { ...options, provider: null });
        }
        
        // Process with cloud provider (implementation would go here)
        throw new Error(`Cloud provider ${providerName} not implemented yet`);
    }

    shouldSwitchToLocal(providerName) {
        const stats = this.usageTracker.getUsageStats();
        const dailyStats = stats.daily[providerName];
        
        if (!dailyStats) return false;
        
        // Switch if we're at 80% of limits
        return dailyStats.requestsUsedPercentage > 80 || dailyStats.tokensUsedPercentage > 80;
    }

    async processWithProvider(providerName, requestType, payload, options) {
        const provider = this.providers.get(providerName);
        
        switch (providerName) {
            case 'ollama':
                return await this.processWithOllama(requestType, payload, options);
            case 'lmstudio':
                return await this.processWithLMStudio(requestType, payload, options);
            case 'localai':
                return await this.processWithLocalAI(requestType, payload, options);
            case 'vllm':
                return await this.processWithVLLM(requestType, payload, options);
            default:
                throw new Error(`Unknown provider: ${providerName}`);
        }
    }

    async processWithOllama(requestType, payload, options) {
        // Use existing Ollama integration
        const aiIntegratedScanner = require('./ai-integrated-scanner');
        
        if (requestType === 'chat') {
            const result = await aiIntegratedScanner.processChatWithAI(
                payload.messages,
                payload.context,
                options
            );
            
            return {
                ...result,
                provider: 'ollama',
                performance: this.performanceMonitor.getCurrentSystemStats()
            };
        }
        
        throw new Error(`Request type ${requestType} not supported by Ollama`);
    }

    async processWithLMStudio(requestType, payload, options) {
        // LM Studio OpenAI-compatible API
        const endpoint = 'http://localhost:1234/v1/chat/completions';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model || 'default',
                messages: payload.messages,
                stream: options.stream || false,
                max_tokens: options.maxTokens || 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`LM Studio request failed: ${response.status}`);
        }
        
        if (options.stream) {
            return response; // Return stream for SSE
        }
        
        const result = await response.json();
        return {
            ...result,
            provider: 'lmstudio',
            performance: this.performanceMonitor.getCurrentSystemStats()
        };
    }

    async processWithLocalAI(requestType, payload, options) {
        // LocalAI OpenAI-compatible API
        const endpoint = 'http://localhost:8080/v1/chat/completions';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model || 'default',
                messages: payload.messages,
                stream: options.stream || false,
                max_tokens: options.maxTokens || 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`LocalAI request failed: ${response.status}`);
        }
        
        if (options.stream) {
            return response; // Return stream for SSE
        }
        
        const result = await response.json();
        return {
            ...result,
            provider: 'localai',
            performance: this.performanceMonitor.getCurrentSystemStats()
        };
    }

    async processWithVLLM(requestType, payload, options) {
        // vLLM OpenAI-compatible API
        const endpoint = 'http://localhost:8000/v1/chat/completions';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model || 'default',
                messages: payload.messages,
                stream: options.stream || false,
                max_tokens: options.maxTokens || 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`vLLM request failed: ${response.status}`);
        }
        
        if (options.stream) {
            return response; // Return stream for SSE
        }
        
        const result = await response.json();
        return {
            ...result,
            provider: 'vllm',
            performance: this.performanceMonitor.getCurrentSystemStats()
        };
    }

    getProviderStatus() {
        const status = {
            current: this.currentProvider,
            providers: {},
            performance: this.performanceMonitor.getPerformanceStats(),
            usage: this.usageTracker.getUsageStats(),
            recommendations: {
                performance: this.performanceMonitor.getRecommendations(),
                usage: this.usageTracker.getRecommendations()
            }
        };

        for (const [name, provider] of this.providers) {
            status.providers[name] = {
                name: provider.name,
                type: provider.type,
                priority: provider.priority,
                features: provider.features,
                healthy: false // Would check health here
            };
        }

        return status;
    }

    getPerformanceStats() {
        return this.performanceMonitor.getPerformanceStats();
    }

    getUsageStats() {
        return this.usageTracker.getUsageStats();
    }

    exportMetrics(format = 'json') {
        return {
            performance: this.performanceMonitor.exportMetrics(format),
            usage: this.usageTracker.exportUsageReport(format)
        };
    }
}

module.exports = OpenSourceAIManager;
