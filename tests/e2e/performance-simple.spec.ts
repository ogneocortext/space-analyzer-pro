/**
 * Simple Performance Test - Direct performance measurement
 * Runs against the already running frontend server
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Performance Metrics', () => {
  const baseUrl = 'http://localhost:5173';

  test('should measure page load performance', async ({ page }) => {
    console.log('🚀 Starting performance test...');
    
    // Enable performance monitoring
    const startTime = Date.now();
    
    // Navigate to the page
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Page load time: ${loadTime}ms`);
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const paint = performance.getEntriesByType('paint');
      
      return {
        // Navigation timing
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        firstPaint: paint[0]?.startTime || 0,
        firstContentfulPaint: paint[1]?.startTime || 0,
        
        // Resource metrics
        totalResources: resources.length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
        slowResources: resources
          .filter(r => r.duration > 100)
          .map(r => ({
            name: r.name.split('/').pop(),
            duration: r.duration,
            size: r.transferSize || 0
          }))
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5),
        
        // Memory (if available)
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize
        } : null
      };
    });
    
    console.log('📊 Performance Metrics:');
    console.log(`   DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`   Load Complete: ${metrics.loadComplete}ms`);
    console.log(`   First Paint: ${metrics.firstPaint}ms`);
    console.log(`   First Contentful Paint: ${metrics.firstContentfulPaint}ms`);
    console.log(`   Total Resources: ${metrics.totalResources}`);
    console.log(`   Total Size: ${Math.round(metrics.totalSize / 1024)}KB`);
    
    if (metrics.memory) {
      console.log(`   Memory Used: ${Math.round(metrics.memory.used / 1024 / 1024)}MB`);
    }
    
    if (metrics.slowResources.length > 0) {
      console.log('🐌 Slow Resources:');
      metrics.slowResources.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name}: ${r.duration}ms (${Math.round(r.size / 1024)}KB)`);
      });
    }
    
    // Performance assertions
    expect(metrics.domContentLoaded).toBeLessThan(5000); // < 5s
    expect(metrics.loadComplete).toBeLessThan(10000); // < 10s
    expect(loadTime).toBeLessThan(15000); // < 15s total
    
    console.log('✅ Performance test completed successfully!');
  });

  test('should measure Core Web Vitals', async ({ page }) => {
    console.log('🎯 Measuring Core Web Vitals...');
    
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait for metrics to populate
    await page.waitForTimeout(2000);
    
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const results: any = {};
        
        // First Contentful Paint
        const fcpEntry = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint');
        results.fcp = fcpEntry?.startTime || 0;
        
        // Largest Contentful Paint (approximate)
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const lastEntry = lcpEntries[lcpEntries.length - 1];
          results.lcp = lastEntry.startTime;
        }
        
        // Cumulative Layout Shift
        let cls = 0;
        const clsEntries = performance.getEntriesByType('layout-shift');
        clsEntries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        results.cls = cls;
        
        resolve(results);
      });
    });
    
    console.log('📈 Core Web Vitals:');
    console.log(`   First Contentful Paint: ${vitals.fcp}ms`);
    console.log(`   Largest Contentful Paint: ${vitals.lcp}ms`);
    console.log(`   Cumulative Layout Shift: ${vitals.cls}`);
    
    // Core Web Vitals thresholds
    if (vitals.fcp) expect(vitals.fcp).toBeLessThan(2000); // Good: < 2s
    if (vitals.lcp) expect(vitals.lcp).toBeLessThan(2500); // Good: < 2.5s
    if (vitals.cls) expect(vitals.cls).toBeLessThan(0.1); // Good: < 0.1
    
    console.log('✅ Core Web Vitals test completed!');
  });

  test('should check for performance bottlenecks', async ({ page }) => {
    console.log('🔍 Analyzing performance bottlenecks...');
    
    // Collect console warnings/errors
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    // Check for large resources
    const largeResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources
        .filter(r => (r.transferSize || 0) > 1024 * 1024) // > 1MB
        .map(r => ({
          name: r.name.split('/').pop(),
          size: r.transferSize,
          type: r.initiatorType
        }));
    });
    
    // Check for slow resources
    const slowResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources
        .filter(r => r.duration > 500) // > 500ms
        .map(r => ({
          name: r.name.split('/').pop(),
          duration: r.duration,
          type: r.initiatorType
        }));
    });
    
    console.log('🚨 Performance Issues:');
    
    if (consoleMessages.length > 0) {
      console.log(`   Console Errors/Warnings: ${consoleMessages.length}`);
      consoleMessages.forEach(msg => console.log(`     ${msg}`));
    }
    
    if (largeResources.length > 0) {
      console.log(`   Large Resources (>1MB): ${largeResources.length}`);
      largeResources.forEach(r => {
        console.log(`     ${r.name}: ${Math.round(r.size / 1024 / 1024)}MB (${r.type})`);
      });
    }
    
    if (slowResources.length > 0) {
      console.log(`   Slow Resources (>500ms): ${slowResources.length}`);
      slowResources.forEach(r => {
        console.log(`     ${r.name}: ${r.duration}ms (${r.type})`);
      });
    }
    
    if (consoleMessages.length === 0 && largeResources.length === 0 && slowResources.length === 0) {
      console.log('   No major performance issues detected! 🎉');
    }
    
    // Generate performance score
    let score = 100;
    if (consoleMessages.length > 0) score -= consoleMessages.length * 5;
    if (largeResources.length > 0) score -= largeResources.length * 10;
    if (slowResources.length > 0) score -= slowResources.length * 5;
    
    console.log(`🏆 Performance Score: ${Math.max(0, score)}/100`);
    
    expect(score).toBeGreaterThan(70); // Should have at least 70% score
    
    console.log('✅ Performance bottleneck analysis completed!');
  });
});