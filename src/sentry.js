/**
 * Sentry Error Monitoring Configuration
 * Initializes Sentry for error tracking and performance monitoring
 */

import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";

export function initSentry(app) {
  // Initialize Sentry only in production and when DSN is available
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      app,
      dsn: import.meta.env.VITE_SENTRY_DSN,
      
      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      tracesSampleRate: 0.1,
      
      // Set the sample rate for error reporting
      sampleRate: 0.1,
      
      // Performance monitoring
      integrations: [
        new BrowserTracing({
          routingInstrumentation: Sentry.vueRouterInstrumentation(app),
        }),
      ],
      
      // Environment
      environment: import.meta.env.MODE,
      
      // Release version
      release: `space-analyzer@${import.meta.env.VITE_APP_VERSION || '2.8.9'}`,
      
      // Before send hook to filter out certain errors
      beforeSend(event) {
        // Filter out errors from development
        if (import.meta.env.DEV) {
          return null;
        }
        
        // Filter out network errors that are expected
        if (event.exception) {
          const error = event.exception.values[0];
          if (error.type === 'NetworkError' || error.type === 'ChunkLoadError') {
            return null;
          }
        }
        
        return event;
      },
      
      // Context tags
      tags: {
        component: 'space-analyzer',
        framework: 'vue',
        version: import.meta.env.VITE_APP_VERSION || '2.8.9',
      },
      
      // Additional data
      extra: {
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    });
    
    console.log('✅ Sentry initialized for error monitoring');
  } else {
    console.log('📝 Sentry not initialized - missing DSN or in development mode');
  }
}

export function captureException(error, context = {}) {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function captureMessage(message, level = 'info', context = {}) {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureMessage(message, level, {
      extra: context,
    });
  }
}

export function setUser(user) {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(user);
  }
}

export function clearUser() {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

export function addBreadcrumb(breadcrumb) {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}