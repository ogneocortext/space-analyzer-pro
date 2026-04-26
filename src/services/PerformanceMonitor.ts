// Performance monitoring service for localhost development
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, number> = new Map();
    private activeTimers: Map<string, number> = new Map();

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    startTimer(name: string): void {
        this.activeTimers.set(name, performance.now());
        console.log(`⏱️ Started timer: ${name}`);
    }

    endTimer(name: string): number {
        const startTime = this.activeTimers.get(name);
        if (!startTime) {
            console.warn(`⚠️ Timer not found: ${name}`);
            return 0;
        }

        const duration = performance.now() - startTime;
        this.metrics.set(name, duration);
        this.activeTimers.delete(name);
        
        console.log(`✅ Timer ${name}: ${duration.toFixed(2)}ms`);
        return duration;
    }

    getMetric(name: string): number | undefined {
        return this.metrics.get(name);
    }

    getAllMetrics(): Record<string, number> {
        return Object.fromEntries(this.metrics);
    }

    logAnalysisMetrics(analysisId: string, filePath: string, fileCount: number, totalSize: number): void {
        const metrics = {
            analysisId,
            filePath,
            fileCount,
            totalSize: this.formatBytes(totalSize),
            timestamp: new Date().toISOString(),
            performanceMetrics: this.getAllMetrics()
        };
        
        console.log('📊 Analysis Performance Metrics:', metrics);
        
        // Store in localStorage for debugging
        try {
            const existingMetrics = JSON.parse(localStorage.getItem('performance-metrics') || '[]');
            existingMetrics.push(metrics);
            
            // Keep only last 10 analyses
            if (existingMetrics.length > 10) {
                existingMetrics.shift();
            }
            
            localStorage.setItem('performance-metrics', JSON.stringify(existingMetrics));
        } catch (error) {
            console.warn('Failed to store performance metrics:', error);
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    clearMetrics(): void {
        this.metrics.clear();
        this.activeTimers.clear();
        console.log('🗑️ Performance metrics cleared');
    }

    // Web Vitals monitoring
    measureWebVitals(): void {
        if ('performance' in window) {
            // Measure navigation timing
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            if (navigation) {
                const ttfb = navigation.responseStart - navigation.requestStart;
                const domLoad = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
                const pageLoad = navigation.loadEventEnd - navigation.loadEventStart;
                
                console.log('🌐 Web Vitals:', {
                    'Time to First Byte (TTFB)': `${ttfb.toFixed(2)}ms`,
                    'DOM Load Time': `${domLoad.toFixed(2)}ms`,
                    'Page Load Time': `${pageLoad.toFixed(2)}ms`
                });
                
                this.metrics.set('ttfb', ttfb);
                this.metrics.set('domLoad', domLoad);
                this.metrics.set('pageLoad', pageLoad);
            }
        }
    }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
