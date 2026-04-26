/**
 * Cloud API Usage Tracker
 * Only tracks usage for external cloud services (Vercel, Google Cloud, etc.)
 * Local tools use performance monitoring instead
 */

const { EventEmitter } = require('events');

class CloudAPIUsageTracker extends EventEmitter {
    constructor() {
        super();
        this.usage = new Map();
        this.limits = new Map();
        this.providers = new Map();
        this.dailyUsage = new Map();
        this.monthlyUsage = new Map();
        
        // Configure cloud API providers and their limits
        this.configureProviders();
    }

    configureProviders() {
        // Vercel AI SDK limits (free tier)
        this.limits.set('vercel', {
            dailyRequests: 10000,
            monthlyTokens: 1000000,
            requestsPerMinute: 60,
            concurrentRequests: 5,
            pricing: {
                inputTokenPrice: 0.00015, // $0.15 per 1M tokens
                outputTokenPrice: 0.0006,  // $0.60 per 1M tokens
                currency: 'USD'
            }
        });

        // Google Cloud AI Platform limits (free tier)
        this.limits.set('google', {
            dailyRequests: 5000,
            monthlyTokens: 500000,
            requestsPerMinute: 30,
            concurrentRequests: 3,
            pricing: {
                inputTokenPrice: 0.000125,
                outputTokenPrice: 0.000375,
                currency: 'USD'
            }
        });

        // OpenAI API limits (free tier)
        this.limits.set('openai', {
            dailyRequests: 3000,
            monthlyTokens: 100000,
            requestsPerMinute: 20,
            concurrentRequests: 2,
            pricing: {
                inputTokenPrice: 0.00015,
                outputTokenPrice: 0.0006,
                currency: 'USD'
            }
        });

        // Anthropic Claude limits (free tier)
        this.limits.set('anthropic', {
            dailyRequests: 1000,
            monthlyTokens: 50000,
            requestsPerMinute: 10,
            concurrentRequests: 1,
            pricing: {
                inputTokenPrice: 0.0003,
                outputTokenPrice: 0.0015,
                currency: 'USD'
            }
        });
    }

    trackUsage(providerName, requestType, tokens, cost = null) {
        const now = new Date();
        const dateKey = this.getDateKey(now);
        const monthKey = this.getMonthKey(now);

        // Create usage record
        const usageRecord = {
            id: `${providerName}-${requestType}-${now.getTime()}`,
            provider: providerName,
            requestType,
            timestamp: now,
            tokens,
            cost: cost || this.calculateCost(providerName, tokens),
            dateKey,
            monthKey
        };

        // Store usage
        this.usage.set(usageRecord.id, usageRecord);

        // Update daily usage
        if (!this.dailyUsage.has(dateKey)) {
            this.dailyUsage.set(dateKey, {});
        }
        const daily = this.dailyUsage.get(dateKey);
        if (!daily[providerName]) {
            daily[providerName] = { requests: 0, tokens: 0, cost: 0 };
        }
        daily[providerName].requests++;
        daily[providerName].tokens += tokens;
        daily[providerName].cost += usageRecord.cost;

        // Update monthly usage
        if (!this.monthlyUsage.has(monthKey)) {
            this.monthlyUsage.set(monthKey, {});
        }
        const monthly = this.monthlyUsage.get(monthKey);
        if (!monthly[providerName]) {
            monthly[providerName] = { requests: 0, tokens: 0, cost: 0 };
        }
        monthly[providerName].requests++;
        monthly[providerName].tokens += tokens;
        monthly[providerName].cost += usageRecord.cost;

        // Check limits and emit warnings
        this.checkUsageLimits(providerName);

        this.emit('usageTracked', usageRecord);
    }

    calculateCost(providerName, tokens) {
        const limits = this.limits.get(providerName);
        if (!limits || !limits.pricing) return 0;

        // Simplified cost calculation (assuming 50% input, 50% output tokens)
        const inputTokens = Math.floor(tokens * 0.5);
        const outputTokens = Math.floor(tokens * 0.5);

        const inputCost = (inputTokens / 1000000) * limits.pricing.inputTokenPrice;
        const outputCost = (outputTokens / 1000000) * limits.pricing.outputTokenPrice;

        return inputCost + outputCost;
    }

    checkUsageLimits(providerName) {
        const limits = this.limits.get(providerName);
        if (!limits) return;

        const now = new Date();
        const dateKey = this.getDateKey(now);
        const monthKey = this.getMonthKey(now);

        // Check daily limits
        const daily = this.dailyUsage.get(dateKey)?.[providerName] || { requests: 0, tokens: 0, cost: 0 };
        const dailyRequestUsage = daily.requests / limits.dailyRequests;
        const dailyTokenUsage = daily.tokens / limits.monthlyTokens;

        // Check monthly limits
        const monthly = this.monthlyUsage.get(monthKey)?.[providerName] || { requests: 0, tokens: 0, cost: 0 };
        const monthlyRequestUsage = monthly.requests / (limits.dailyRequests * 30); // Approximate
        const monthlyTokenUsage = monthly.tokens / limits.monthlyTokens;

        // Emit warnings based on usage percentage
        if (dailyRequestUsage > 0.8) {
            this.emit('usageWarning', {
                provider: providerName,
                type: 'daily_requests',
                usage: dailyRequestUsage,
                limit: limits.dailyRequests,
                message: `${providerName}: ${(dailyRequestUsage * 100).toFixed(1)}% of daily request limit used`
            });
        }

        if (dailyTokenUsage > 0.8) {
            this.emit('usageWarning', {
                provider: providerName,
                type: 'daily_tokens',
                usage: dailyTokenUsage,
                limit: limits.monthlyTokens,
                message: `${providerName}: ${(dailyTokenUsage * 100).toFixed(1)}% of daily token limit used`
            });
        }

        if (monthlyTokenUsage > 0.8) {
            this.emit('usageWarning', {
                provider: providerName,
                type: 'monthly_tokens',
                usage: monthlyTokenUsage,
                limit: limits.monthlyTokens,
                message: `${providerName}: ${(monthlyTokenUsage * 100).toFixed(1)}% of monthly token limit used`
            });
        }

        // Critical warnings
        if (dailyRequestUsage > 0.95) {
            this.emit('criticalUsageWarning', {
                provider: providerName,
                type: 'daily_requests_critical',
                usage: dailyRequestUsage,
                message: `${providerName}: Daily request limit almost reached!`
            });
        }

        if (monthlyTokenUsage > 0.95) {
            this.emit('criticalUsageWarning', {
                provider: providerName,
                type: 'monthly_tokens_critical',
                usage: monthlyTokenUsage,
                message: `${providerName}: Monthly token limit almost reached!`
            });
        }
    }

    getUsageStats() {
        const now = new Date();
        const dateKey = this.getDateKey(now);
        const monthKey = this.getMonthKey(now);

        const daily = this.dailyUsage.get(dateKey) || {};
        const monthly = this.monthlyUsage.get(monthKey) || {};

        return {
            daily: this.formatUsageStats(daily),
            monthly: this.formatUsageStats(monthly),
            limits: Object.fromEntries(this.limits),
            providers: Array.from(this.limits.keys()),
            totalUsage: this.getTotalUsage()
        };
    }

    formatUsageStats(rawStats) {
        const formatted = {};
        
        for (const [provider, stats] of Object.entries(rawStats)) {
            const limits = this.limits.get(provider);
            formatted[provider] = {
                ...stats,
                requestsRemaining: limits ? Math.max(0, limits.dailyRequests - stats.requests) : 0,
                tokensRemaining: limits ? Math.max(0, limits.monthlyTokens - stats.tokens) : 0,
                requestsUsedPercentage: limits ? (stats.requests / limits.dailyRequests) * 100 : 0,
                tokensUsedPercentage: limits ? (stats.tokens / limits.monthlyTokens) * 100 : 0
            };
        }

        return formatted;
    }

    getTotalUsage() {
        const total = {
            requests: 0,
            tokens: 0,
            cost: 0,
            byProvider: {}
        };

        for (const [provider, stats] of this.monthlyUsage) {
            total.requests += stats.requests;
            total.tokens += stats.tokens;
            total.cost += stats.cost;
            total.byProvider[provider] = stats;
        }

        return total;
    }

    getRecommendations() {
        const recommendations = [];
        const stats = this.getUsageStats();

        for (const [provider, dailyStats] of Object.entries(stats.daily)) {
            if (dailyStats.requestsUsedPercentage > 70) {
                recommendations.push({
                    type: 'USAGE_OPTIMIZATION',
                    provider,
                    message: `${provider}: ${(dailyStats.requestsUsedPercentage).toFixed(1)}% of daily limit used. Consider optimizing requests.`,
                    priority: 'medium'
                });
            }

            if (dailyStats.tokensUsedPercentage > 70) {
                recommendations.push({
                    type: 'TOKEN_OPTIMIZATION',
                    provider,
                    message: `${provider}: ${(dailyStats.tokensUsedPercentage).toFixed(1)}% of daily token limit used. Consider using smaller models.`,
                    priority: 'high'
                });
            }
        }

        // Suggest switching to local alternatives
        for (const [provider, dailyStats] of Object.entries(stats.daily)) {
            if (dailyStats.requestsUsedPercentage > 80) {
                recommendations.push({
                    type: 'SWITCH_TO_LOCAL',
                    provider,
                    message: `${provider} usage is high. Consider switching to local AI providers to avoid throttling.`,
                    priority: 'high'
                });
            }
        }

        return recommendations;
    }

    getDateKey(date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    getMonthKey(date) {
        return date.toISOString().substring(0, 7); // YYYY-MM
    }

    exportUsageReport(format = 'json') {
        const stats = this.getUsageStats();
        
        switch (format) {
            case 'json':
                return JSON.stringify(stats, null, 2);
            case 'csv':
                return this.convertToCSV(stats);
            default:
                return stats;
        }
    }

    convertToCSV(stats) {
        const csv = ['Date,Provider,Requests,Tokens,Cost'];
        
        for (const [date, dailyStats] of Object.entries(stats.daily)) {
            for (const [provider, providerStats] of Object.entries(dailyStats)) {
                csv.push([
                    date,
                    provider,
                    providerStats.requests,
                    providerStats.tokens,
                    providerStats.cost.toFixed(4)
                ].join(','));
            }
        }
        
        return csv.join('\n');
    }

    resetUsage(providerName = null) {
        if (providerName) {
            // Reset specific provider
            for (const [key, stats] of this.dailyUsage) {
                delete stats[providerName];
            }
            for (const [key, stats] of this.monthlyUsage) {
                delete stats[providerName];
            }
        } else {
            // Reset all usage
            this.dailyUsage.clear();
            this.monthlyUsage.clear();
            this.usage.clear();
        }
        
        this.emit('usageReset', { provider: providerName });
    }
}

module.exports = CloudAPIUsageTracker;
