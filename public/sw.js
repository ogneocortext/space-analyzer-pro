// Progressive Web App Service Worker for Space Analyzer
// Implements offline capabilities, background sync, and caching

const CACHE_NAME = 'space-analyzer-v1';
const STATIC_CACHE_NAME = 'space-analyzer-static-v1';
const DYNAMIC_CACHE_NAME = 'space-analyzer-dynamic-v1';
const ANALYSIS_CACHE_NAME = 'space-analyzer-analysis-v1';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 PWA Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Static assets cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 PWA Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== ANALYSIS_CACHE_NAME) {
              console.log(`🗑️ Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Cache cleanup completed');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests with caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different request types with appropriate caching strategies
  if (isStaticAsset(request)) {
    // Cache First strategy for static assets
    event.respondWith(handleStaticRequest(request));
  } else if (isAPIRequest(request)) {
    // Network First strategy for API requests
    event.respondWith(handleAPIRequest(request));
  } else if (isAnalysisRequest(request)) {
    // Cache First with Network Fallback for analysis requests
    event.respondWith(handleAnalysisRequest(request));
  } else {
    // Stale While Revalidate for navigation requests
    event.respondWith(handleNavigationRequest(request));
  }
});

// Background sync for analysis results
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'analysis-sync') {
    event.waitUntil(syncAnalysisResults());
  } else if (event.tag === 'cache-sync') {
    event.waitUntil(syncCacheData());
  }
});

// Push notifications for critical issues
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const options = {
    body: 'Critical code issues detected in your project',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore Issues',
        icon: '/static/icons/explore.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/static/icons/dismiss.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Space Analyzer Alert', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard?show=issues')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Caching strategy functions
async function handleStaticRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Static request failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('API request failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

async function handleAnalysisRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          const cache = await caches.open(ANALYSIS_CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
      });
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(ANALYSIS_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Analysis request failed:', error);
    return new Response('Analysis unavailable offline', { status: 503 });
  }
}

async function handleNavigationRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
      });
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Navigation request failed:', error);
    return caches.match('/offline.html') || new Response('Offline', { status: 503 });
  }
}

// Helper functions
function isStaticAsset(request) {
  return request.url.includes('/static/') || 
         request.url.includes('.js') || 
         request.url.includes('.css') || 
         request.url.includes('.png') || 
         request.url.includes('.jpg') || 
         request.url.includes('.svg');
}

function isAPIRequest(request) {
  return request.url.includes('/api/');
}

function isAnalysisRequest(request) {
  return request.url.includes('/analysis/') || 
         request.url.includes('/ai/') || 
         request.url.includes('/ml/');
}

// Background sync functions
async function syncAnalysisResults() {
  console.log('🔄 Syncing analysis results...');
  
  try {
    // Get pending analysis results from IndexedDB
    const pendingResults = await getPendingAnalysisResults();
    
    for (const result of pendingResults) {
      try {
        // Sync to server
        const response = await fetch('/api/analysis/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(result)
        });
        
        if (response.ok) {
          // Remove from pending queue
          await removePendingResult(result.id);
          console.log('✅ Synced analysis result:', result.id);
        }
      } catch (error) {
        console.error('❌ Failed to sync result:', result.id, error);
      }
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

async function syncCacheData() {
  console.log('🔄 Syncing cache data...');
  
  try {
    // Sync user preferences and settings
    const userPrefs = await getUserPreferences();
    const response = await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userPrefs)
    });
    
    if (response.ok) {
      console.log('✅ User preferences synced');
    }
  } catch (error) {
    console.error('❌ Failed to sync preferences:', error);
  }
}

// IndexedDB helpers for offline storage
async function getPendingAnalysisResults() {
  // Mock implementation - would use IndexedDB in production
  return [];
}

async function removePendingResult(id) {
  // Mock implementation - would use IndexedDB in production
  console.log('Removing pending result:', id);
}

async function getUserPreferences() {
  // Mock implementation - would use IndexedDB in production
  return {};
}

// Message handling for client communication
self.addEventListener('message', (event) => {
  console.log('📨 Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CACHE_UPDATE') {
    updateCache(event.data.url, event.data.data);
  } else if (event.data.type === 'CLEAR_CACHE') {
    clearCache(event.data.cacheName);
  }
});

// Cache management functions
async function updateCache(url, data) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(url, response);
    console.log('✅ Cache updated for:', url);
  } catch (error) {
    console.error('❌ Failed to update cache:', error);
  }
}

async function clearCache(cacheName) {
  try {
    await caches.delete(cacheName);
    console.log('✅ Cache cleared:', cacheName);
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
}

console.log('🚀 PWA Service Worker loaded successfully');