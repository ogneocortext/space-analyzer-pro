const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const framework = process.env.FRAMEWORK || 'vue'; // 'vue' or 'react'
  const performanceMetrics = {
    framework,
    pageLoad: 0,
    firstContentfulPaint: 0,
    domContentLoaded: 0,
    loadComplete: 0,
    networkRequests: [],
    memoryUsage: [],
    fps: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    console.log(`=== Performance Test Started (${framework.toUpperCase()}) ===`);
    const startTime = Date.now();
    
    // Enable performance monitoring
    await page.context().addInitScript(() => {
      window.performanceMetrics = {
        fps: [],
        lastFrameTime: performance.now()
      };
      
      function measureFPS() {
        const now = performance.now();
        const delta = now - window.performanceMetrics.lastFrameTime;
        const fps = 1000 / delta;
        window.performanceMetrics.fps.push(fps);
        window.performanceMetrics.lastFrameTime = now;
        requestAnimationFrame(measureFPS);
      }
      requestAnimationFrame(measureFPS);
    });
    
    console.log('Navigating to http://localhost:3001');
    const navStart = Date.now();
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    performanceMetrics.pageLoad = Date.now() - navStart;
    console.log(`⏱️ Page load time: ${performanceMetrics.pageLoad}ms`);
    
    console.log('Waiting for page to load...');
    await page.waitForLoadState('domcontentloaded');
    
    // Get performance metrics from page
    const perfData = await page.evaluate(() => {
      const perf = performance.timing;
      return {
        firstContentfulPaint: perf.responseStart - perf.navigationStart,
        domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
        loadComplete: perf.loadEventEnd - perf.navigationStart
      };
    });
    performanceMetrics.firstContentfulPaint = perfData.firstContentfulPaint;
    performanceMetrics.domContentLoaded = perfData.domContentLoaded;
    performanceMetrics.loadComplete = perfData.loadComplete;
    console.log(`⏱️ First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms`);
    console.log(`⏱️ DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`⏱️ Load Complete: ${performanceMetrics.loadComplete}ms`);
    
    console.log('Taking initial screenshot...');
    await page.screenshot({ path: 'test-screenshot-1.png' });
    
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());
    
    // Monitor network requests
    page.on('response', async (response) => {
      performanceMetrics.networkRequests.push({
        url: response.url(),
        status: response.status()
      });
    });
    
    // Look for directory input and analyze button
    console.log('Looking for directory input...');
    const dirInput = await page.locator('input[type="text"], input[placeholder*="directory"], input[placeholder*="path"]').first();
    if (await dirInput.isVisible()) {
      console.log('Found directory input, entering test path...');
      const inputStart = Date.now();
      await dirInput.fill('E:\\Generated with Producer.AI');
      console.log(`⏱️ Input fill time: ${Date.now() - inputStart}ms`);
      
      console.log('Looking for analyze button...');
      const analyzeBtn = await page.locator('button:has-text("Analyze"), button:has-text("Start"), button[aria-label*="analyze"]').first();
      if (await analyzeBtn.isVisible()) {
        console.log('Clicking analyze button...');
        const clickStart = Date.now();
        await analyzeBtn.click();
        console.log(`⏱️ Button click response: ${Date.now() - clickStart}ms`);
        
        console.log('Waiting for analysis to start...');
        await page.waitForTimeout(3000);
        
        // Get memory usage
        const memUsage = await page.evaluate(() => {
          if (performance.memory) {
            return {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit
            };
          }
          return null;
        });
        if (memUsage) {
          performanceMetrics.memoryUsage.push(memUsage);
          console.log(`💾 Memory: ${(memUsage.used / 1024 / 1024).toFixed(2)}MB / ${(memUsage.total / 1024 / 1024).toFixed(2)}MB`);
        }
        
        console.log('Taking screenshot after analysis start...');
        await page.screenshot({ path: 'test-screenshot-2.png' });
        
        // Check for progress indicators
        console.log('Checking for progress...');
        const progress = await page.locator('text=/scanning|progress|analyzing/i').first();
        if (await progress.isVisible()) {
          console.log('Progress indicator found:', await progress.textContent());
        }
        
        // Wait for results
        console.log('Waiting for results (30s)...');
        await page.waitForTimeout(30000);
        
        // Get final FPS data
        const fpsData = await page.evaluate(() => {
          const fps = window.performanceMetrics?.fps || [];
          return {
            avg: fps.length > 0 ? fps.reduce((a, b) => a + b, 0) / fps.length : 0,
            min: fps.length > 0 ? Math.min(...fps) : 0,
            max: fps.length > 0 ? Math.max(...fps) : 0
          };
        });
        performanceMetrics.fps = fpsData;
        console.log(`🎯 FPS - Avg: ${fpsData.avg.toFixed(1)}, Min: ${fpsData.min.toFixed(1)}, Max: ${fpsData.max.toFixed(1)}`);
        
        console.log('Taking final screenshot...');
        await page.screenshot({ path: 'test-screenshot-3.png' });
      } else {
        console.log('Analyze button not found');
      }
    } else {
      console.log('Directory input not found, checking for file picker...');
      const filePicker = await page.locator('input[type="file"]').first();
      if (await filePicker.isVisible()) {
        console.log('File picker found but not testing file upload');
      }
    }
    
    console.log('Waiting 5 seconds before closing...');
    await page.waitForTimeout(5000);
    
    // Print performance summary
    console.log('\n=== Performance Summary ===');
    console.log(`Framework: ${framework.toUpperCase()}`);
    console.log(`Total test time: ${Date.now() - startTime}ms`);
    console.log(`Page load: ${performanceMetrics.pageLoad}ms`);
    console.log(`First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms`);
    console.log(`DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`Load Complete: ${performanceMetrics.loadComplete}ms`);
    console.log(`Network requests: ${performanceMetrics.networkRequests.length}`);
    console.log(`FPS - Avg: ${performanceMetrics.fps.avg.toFixed(1)}, Min: ${performanceMetrics.fps.min.toFixed(1)}, Max: ${performanceMetrics.fps.max.toFixed(1)}`);
    
    // Save results to file
    const resultsDir = path.join(__dirname, 'performance-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const resultsFile = path.join(resultsDir, `${framework}-performance-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(performanceMetrics, null, 2));
    console.log(`\n📊 Results saved to: ${resultsFile}`);
    
    // Compare with previous results if available
    const files = fs.readdirSync(resultsDir).filter(f => f.includes(`${framework}-performance`)).sort();
    if (files.length > 1) {
      const prevFile = files[files.length - 2];
      const prevData = JSON.parse(fs.readFileSync(path.join(resultsDir, prevFile), 'utf8'));
      console.log('\n📈 Comparison with previous run:');
      console.log(`Page load: ${performanceMetrics.pageLoad}ms vs ${prevData.pageLoad}ms (${((performanceMetrics.pageLoad - prevData.pageLoad) / prevData.pageLoad * 100).toFixed(1)}%)`);
      console.log(`FPS Avg: ${performanceMetrics.fps.avg.toFixed(1)} vs ${prevData.fps.avg.toFixed(1)} (${((performanceMetrics.fps.avg - prevData.fps.avg) / prevData.fps.avg * 100).toFixed(1)}%)`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
