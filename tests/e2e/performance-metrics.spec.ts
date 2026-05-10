/**
 * Performance Metrics Test - Comprehensive Performance Analysis
 * Measures Core Web Vitals, navigation timing, resource loading, and memory usage
 */

import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';

interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  
  // Navigation Timing
  domContentLoaded?: number;
  loadComplete?: number;
  firstPaint?: number;
  timeToInteractive?: number;
  
  // Resource Metrics
  totalResources?: number;
  totalSize?: number;
  slowResources?: Array<{name: string, duration: number, size: number}>;
  
  // Memory Metrics
  jsHeapUsed?: number;
  jsHeapTotal?: number;
  
  // Custom Metrics
  appStartupTime?: number;
  routeChangeTime?: number;
}

interface ResourceTimingEntry {
  name: string;
  duration: number;
  size: number;
  type: string;
}

test.describe('Performance Metrics', () => {
  let logger: TestLogger;
  const baseUrl = 'http://localhost:5173';

  test.beforeEach(async () => {
    logger = new TestLogger('performance-metrics');
    logger.log('TEST_START', { testName: 'Performance Metrics' });
  });

  test('should measure Core Web Vitals on initial load', async ({ page }) => {
    const metrics: PerformanceMetrics = {};
    
    // Enable performance observers
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    
    // Collect Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        
        // First Contentful Paint
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
          }
        }).observe({ entryTypes: ['paint'] });
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry?.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // First Input Delay
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            vitals.fid = (entry as any).processingStart - entry.startTime;
          }
        }).observe({ entryTypes: ['first-input'] });
        
        // Wait a bit for metrics to populate
        setTimeout(() => resolve(vitals), 2000);
      });
    });
    
    Object.assign(metrics, webVitals);
    
    // Log Core Web Vitals
    logger.log('CORE_WEB_VITALS', {
      fcp: metrics.fcp,
      lcp: metrics.lcp,
      fid: metrics.fid,
      cls: metrics.cls
    });
    
    // Performance assertions (adjust thresholds based on your requirements)
    if (metrics.fcp) expect(metrics.fcp).toBeLessThan(2000); // < 2s
    if (metrics.lcp) expect(metrics.lcp).toBeLessThan(2500); // < 2.5s
    if (metrics.cls) expect(metrics.cls).toBeLessThan(0.1); // < 0.1
    
    logger.log('TEST_COMPLETE', { coreWebVitals: metrics });
  });

  test('should measure navigation timing and resource loading', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate and wait for full load
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    const navigationTiming = await page.evaluate(() => {
      const timing = performance.timing;
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        timeToInteractive: timing.domInteractive - timing.navigationStart
      };
    });
    
    // Get resource timing data
    const resourceData = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const totalResources = resources.length;
      const totalSize = resources.reduce((sum, resource) => {
        return sum + (resource.transferSize || 0);
      }, 0);
      
      const slowResources = resources
        .filter(r => r.duration > 100) // Resources taking > 100ms
        .map(r => ({
          name: r.name.split('/').pop() || r.name,
          duration: r.duration,
          size: r.transferSize || 0,
          type: r.initiatorType
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10); // Top 10 slowest
      
      return { totalResources, totalSize, slowResources };
    });
    
    const metrics: PerformanceMetrics = {
      ...navigationTiming,
      ...resourceData,
      appStartupTime: Date.now() - startTime
    };
    
    // Log navigation metrics
    logger.log('NAVIGATION_TIMING', {
      domContentLoaded: metrics.domContentLoaded,
      loadComplete: metrics.loadComplete,
      firstPaint: metrics.firstPaint,
      timeToInteractive: metrics.timeToInteractive,
      appStartupTime: metrics.appStartupTime
    });
    
    // Log resource metrics
    logger.log('RESOURCE_METRICS', {
      totalResources: metrics.totalResources,
      totalSize: metrics.totalSize,
      slowResourcesCount: metrics.slowResources?.length
    });
    
    // Log slow resources details
    if (metrics.slowResources && metrics.slowResources.length > 0) {
      logger.log('SLOW_RESOURCES', { resources: metrics.slowResources });
    }
    
    // Performance assertions
    expect(metrics.domContentLoaded).toBeLessThan(3000); // < 3s
    expect(metrics.loadComplete).toBeLessThan(5000); // < 5s
    expect(metrics.appStartupTime).toBeLessThan(10000); // < 10s
    
    logger.log('TEST_COMPLETE', { navigationMetrics: metrics });
  });

  test('should measure memory usage and detect leaks', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (initialMemory) {
      logger.log('INITIAL_MEMORY', {
        used: initialMemory.used,
        total: initialMemory.total,
        limit: initialMemory.limit
      });
    }
    
    // Simulate user interactions to test memory growth
    await page.waitForTimeout(2000);
    
    // Try to trigger some interactions
    await page.click('body').catch(() => {});
    await page.keyboard.press('Tab').catch(() => {});
    await page.waitForTimeout(1000);
    
    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (finalMemory) {
      logger.log('FINAL_MEMORY', {
        used: finalMemory.used,
        total: finalMemory.total,
        limit: finalMemory.limit
      });
      
      const memoryGrowth = finalMemory.used - initialMemory!.used;
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024 * 100) / 100;
      
      logger.log('MEMORY_GROWTH', {
        growthBytes: memoryGrowth,
        growthMB: memoryGrowthMB,
        initialUsedMB: Math.round(initialMemory!.used / 1024 / 1024 * 100) / 100,
        finalUsedMB: Math.round(finalMemory.used / 1024 / 1024 * 100) / 100
      });
      
      // Memory should not grow excessively (> 50MB)
      expect(memoryGrowthMB).toBeLessThan(50);
    }
    
    logger.log('TEST_COMPLETE', { memoryMetrics: finalMemory });
  });

  test('should measure route navigation performance', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    // Wait for app to fully load
    await page.waitForTimeout(2000);
    
    // Measure route changes (if SPA routing exists)
    const routeMetrics: Array<{route: string, time: number}> = [];
    
    // Try common navigation elements
    const navSelectors = [
      'nav a[href]',
      '.sidebar a[href]',
      '[data-testid="nav"] a[href]',
      'a[href^="/"]'
    ];
    
    for (const selector of navSelectors) {
      const links = await page.locator(selector).all();
      
      for (let i = 0; i < Math.min(links.length, 3); i++) {
        const link = links[i];
        const href = await link.getAttribute('href');
        
        if (href && href.startsWith('/') && !href.includes('http')) {
          const startTime = Date.now();
          
          try {
            await link.click();
            await page.waitForTimeout(1000); // Wait for route change
            
            const routeTime = Date.now() - startTime;
            routeMetrics.push({ route: href, time: routeTime });
            
            logger.log('ROUTE_CHANGE', {
              route: href,
              time: routeTime
            });
            
            // Go back for next test
            await page.goBack({ waitUntil: 'networkidle' });
            await page.waitForTimeout(500);
            
          } catch (error) {
            logger.log('ROUTE_CHANGE_FAILED', { route: href, error: (error as Error).message });
          }
        }
      }
    }
    
    if (routeMetrics.length > 0) {
      const avgRouteTime = routeMetrics.reduce((sum, r) => sum + r.time, 0) / routeMetrics.length;
      logger.log('ROUTE_PERFORMANCE_SUMMARY', {
        totalRoutes: routeMetrics.length,
        averageTime: avgRouteTime,
        routes: routeMetrics
      });
      
      // Route changes should be fast (< 500ms)
      expect(avgRouteTime).toBeLessThan(500);
    }
    
    logger.log('TEST_COMPLETE', { routeMetrics });
  });

  test('should generate comprehensive performance report', async ({ page }) => {
    const fullReport: any = {
      timestamp: new Date().toISOString(),
      url: baseUrl,
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: await page.viewportSize(),
      metrics: {}
    };
    
    // Run all performance measurements
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    // Collect all metrics in one go
    fullReport.metrics = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const paint = performance.getEntriesByType('paint');
      
      return {
        // Navigation Timing
        navigation: {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          firstPaint: paint[0]?.startTime || 0,
          timeToInteractive: timing.domInteractive - timing.navigationStart,
          domInteractive: timing.domInteractive - timing.navigationStart,
          domComplete: timing.domComplete - timing.navigationStart
        },
        
        // Resource Summary
        resources: {
          total: resources.length,
          totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          cached: resources.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length,
          slowResources: resources
            .filter(r => r.duration > 100)
            .map(r => ({
              name: r.name.split('/').pop(),
              duration: r.duration,
              size: r.transferSize || 0,
              type: r.initiatorType
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)
        },
        
        // Memory (if available)
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null
      };
    });
    
    // Calculate performance score
    const score = calculatePerformanceScore(fullReport.metrics);
    fullReport.score = score;
    
    // Save report
    logger.log('PERFORMANCE_REPORT', fullReport);
    
    // Write report to file
    await page.evaluate((report) => {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, fullReport);
    
    logger.log('TEST_COMPLETE', { 
      performanceScore: score,
      reportGenerated: true 
    });
    
    // Performance score should be reasonable (> 70)
    expect(score).toBeGreaterThan(70);
  });
});

/**
 * Calculate a performance score based on collected metrics
 */
function calculatePerformanceScore(metrics: any): number {
  let score = 100;
  
  // Navigation timing penalties
  if (metrics.navigation.domContentLoaded > 3000) score -= 10;
  if (metrics.navigation.loadComplete > 5000) score -= 10;
  if (metrics.navigation.firstPaint > 1000) score -= 10;
  
  // Resource penalties
  if (metrics.resources.total > 100) score -= 10;
  if (metrics.resources.totalSize > 5 * 1024 * 1024) score -= 10; // > 5MB
  if (metrics.resources.slowResources.length > 5) score -= 10;
  
  // Memory penalties
  if (metrics.memory && metrics.memory.used > 100 * 1024 * 1024) score -= 10; // > 100MB
  
  return Math.max(0, score);
}