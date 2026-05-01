/**
 * Vue Plugin for Performance Optimization
 * Installs performance utilities globally
 */

import type { App } from 'vue';
import { 
  debounce, 
  throttle, 
  VirtualScroller, 
  LazyImageLoader, 
  PerformanceMonitor,
  MemoryManager,
  ResponsiveHelper,
  AnimationHelper
} from '../utils/performanceEnhancements';

export interface PerformanceOptions {
  enableMonitoring?: boolean;
  enableVirtualScrolling?: boolean;
  enableLazyLoading?: boolean;
  maxCacheSize?: number;
}

export default {
  install(app: App, options: PerformanceOptions = {}) {
    const {
      enableMonitoring = true,
      enableVirtualScrolling = true,
      enableLazyLoading = true,
      maxCacheSize = 100
    } = options;

    // Global performance monitor
    const performanceMonitor = PerformanceMonitor.getInstance();
    
    // Global memory manager
    const memoryManager = new MemoryManager();
    
    // Global lazy image loader
    const lazyImageLoader = new LazyImageLoader();

    // Provide global properties
    app.config.globalProperties.$performance = {
      monitor: performanceMonitor,
      memory: memoryManager,
      lazyLoader: lazyImageLoader,
      debounce,
      throttle,
      VirtualScroller,
      ResponsiveHelper,
      AnimationHelper,
    };

    // Provide injectables
    app.provide('performanceMonitor', performanceMonitor);
    app.provide('memoryManager', memoryManager);
    app.provide('lazyImageLoader', lazyImageLoader);

    // Auto-cleanup on app unmount
    app.config.globalProperties.$cleanup = () => {
      memoryManager.clear();
      lazyImageLoader.disconnect();
    };

    // Performance directive for v-performance
    app.directive('performance', {
      mounted(el, binding) {
        if (binding.value === 'lazy' && el.tagName === 'IMG') {
          lazyImageLoader.observe(el);
        }
        
        if (binding.value === 'monitor' && enableMonitoring) {
          const componentName = el.__vueParentComponent?.type.name || 'Unknown';
          performanceMonitor.startTimer(componentName);
        }
      },
      
      unmounted(el, binding) {
        if (binding.value === 'monitor' && enableMonitoring) {
          const componentName = el.__vueParentComponent?.type.name || 'Unknown';
          performanceMonitor.endTimer(componentName);
        }
      }
    });

    // Virtual scroll directive
    app.directive('virtual-scroll', {
      mounted(el, binding) {
        if (!enableVirtualScrolling) return;
        
        const { itemHeight, items } = binding.value;
        const containerHeight = el.clientHeight;
        const scroller = new VirtualScroller(containerHeight, itemHeight);
        
        el.addEventListener('scroll', throttle((e) => {
          const scrollTop = (e.target as HTMLElement).scrollTop;
          const range = scroller.getVisibleRange(items.length, scrollTop);
          
          // Emit event with visible range
          el.dispatchEvent(new CustomEvent('virtual-scroll', {
            detail: { range, scrollTop }
          }));
        }, 16));
      }
    });

    // Responsive classes directive
    app.directive('responsive', {
      mounted(el) {
        const updateClasses = () => {
          const breakpoint = ResponsiveHelper.getCurrentBreakpoint();
          el.className = el.className.replace(/\\b(sm|md|lg|xl|2xl):\\S+/g, '');
          el.classList.add(`${breakpoint}:responsive`);
        };

        updateClasses();
        window.addEventListener('resize', debounce(updateClasses, 100));
      },
      
      unmounted(el) {
        window.removeEventListener('resize', debounce(() => {}, 100));
      }
    });

    console.log('🚀 Performance plugin installed with optimizations:', {
      monitoring: enableMonitoring,
      virtualScrolling: enableVirtualScrolling,
      lazyLoading: enableLazyLoading,
      maxCacheSize,
    });
  }
};
