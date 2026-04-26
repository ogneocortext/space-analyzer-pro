/**
 * Port Detection Utility for Backend Services
 * Helps find available ports and detect running services
 */

const net = require('net');
const http = require('http');

class PortDetector {
    constructor() {
        this.commonPorts = {
            backend: [8092, 8081, 8080, 3000, 5000, 8000, 9000],
            frontend: [5173, 3000, 8080, 8000, 4200, 9000],
            api: [8092, 8081, 8080, 3001, 5000, 8001, 9001]
        };
    }

    /**
     * Check if a port is available
     */
    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => {
                    resolve(true);
                });
                server.close();
            });
            
            server.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Find the first available port from a list
     */
    async findAvailablePort(ports = this.commonPorts.backend) {
        for (const port of ports) {
            if (await this.isPortAvailable(port)) {
                return port;
            }
        }
        
        // If no common ports are available, find a random port
        return this.findRandomPort();
    }

    /**
     * Find a random available port
     */
    async findRandomPort() {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(0, () => {
                const port = server.address().port;
                server.close(() => {
                    resolve(port);
                });
            });
        });
    }

    /**
     * Check if a service is running on a specific port
     */
    async isServiceRunning(port, path = '/') {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: port,
                path: path,
                method: 'GET',
                timeout: 2000
            };

            const req = http.request(options, (res) => {
                resolve(res.statusCode < 500); // Consider server errors as "running"
            });

            req.on('error', () => {
                resolve(false);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    /**
     * Detect running backend services
     */
    async detectBackendServices() {
        const results = [];
        
        for (const port of this.commonPorts.backend) {
            if (await this.isServiceRunning(port, '/api/health')) {
                results.push({ port, type: 'backend', status: 'running' });
            } else if (await this.isServiceRunning(port, '/health')) {
                results.push({ port, type: 'backend', status: 'running' });
            }
        }
        
        return results;
    }

    /**
     * Get the best available port for a new backend service
     */
    async getBestBackendPort() {
        // First check if any backend services are already running
        const running = await this.detectBackendServices();
        
        if (running.length === 0) {
            // No backend running, use the default
            return this.commonPorts.backend[0]; // 8092
        }
        
        // Backend is running, find the next available port
        const usedPorts = running.map(s => s.port);
        const availablePorts = this.commonPorts.backend.filter(p => !usedPorts.includes(p));
        
        if (availablePorts.length > 0) {
            return availablePorts[0];
        }
        
        // All common ports are taken, find a random one
        return this.findRandomPort();
    }
}

module.exports = PortDetector;
