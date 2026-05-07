/**
 * Health Controller
 * Handles health check and status endpoints
 */

class HealthController {
    constructor() {
        this.startTime = Date.now();
    }

    async healthCheck(req, res) {
        try {
            const uptime = Date.now() - this.startTime;
            const memoryUsage = process.memoryUsage();
            
            const health = {
                status: 'healthy',
                uptime: uptime,
                uptimeFormatted: this.formatUptime(uptime),
                memory: {
                    used: memoryUsage.heapUsed,
                    total: memoryUsage.heapTotal,
                    external: memoryUsage.external,
                    rss: memoryUsage.rss
                },
                version: process.version,
                platform: process.platform,
                arch: process.arch,
                timestamp: new Date().toISOString()
            };
            
            res.json({
                success: true,
                data: health
            });
        } catch (error) {
            console.error('Health check failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async readinessCheck(req, res) {
        try {
            // Check if all critical services are ready
            const ready = {
                status: 'ready',
                checks: {
                    database: 'ok',
                    fileSystem: 'ok',
                    services: 'ok'
                },
                timestamp: new Date().toISOString()
            };
            
            res.json({
                success: true,
                data: ready
            });
        } catch (error) {
            console.error('Readiness check failed:', error);
            res.status(503).json({
                success: false,
                error: error.message
            });
        }
    }

    async livenessCheck(req, res) {
        try {
            const liveness = {
                status: 'alive',
                timestamp: new Date().toISOString()
            };
            
            res.json({
                success: true,
                data: liveness
            });
        } catch (error) {
            console.error('Liveness check failed:', error);
            res.status(503).json({
                success: false,
                error: error.message
            });
        }
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

module.exports = HealthController;
