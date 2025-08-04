/**
 * Terminal Service Worker
 * Keeps terminal connections alive even when main app crashes
 */

const TERMINAL_CACHE = 'constellation-terminal-v1';
const TERMINAL_DB = 'constellation-terminal-db';
const TERMINAL_STORE = 'terminal-sessions';

// Cache for terminal resources
const TERMINAL_RESOURCES = [
  '/terminal-sw.js',
  // Add other critical terminal resources
];

// Install event - cache terminal resources
self.addEventListener('install', (event) => {
  console.log('[Terminal SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(TERMINAL_CACHE).then((cache) => {
      console.log('[Terminal SW] Caching terminal resources');
      return cache.addAll(TERMINAL_RESOURCES);
    })
  );
  
  // Take control immediately
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Terminal SW] Activating service worker...');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== TERMINAL_CACHE) {
            console.log('[Terminal SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Handle fetch events - keep terminal connections alive
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Intercept terminal WebSocket connections
  if (url.pathname === '/terminal' && url.protocol.includes('ws')) {
    console.log('[Terminal SW] Intercepting WebSocket connection');
    // WebSocket connections can't be cached, but we can log them
    return;
  }
  
  // Handle terminal API requests
  if (url.pathname.startsWith('/api/') && url.hostname === 'localhost') {
    event.respondWith(
      fetch(event.request).catch((error) => {
        console.warn('[Terminal SW] API request failed, using cached response if available:', error);
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // Default handling
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle terminal messages from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'TERMINAL_STATE_BACKUP':
      backupTerminalState(data);
      break;
      
    case 'TERMINAL_STATE_RESTORE':
      restoreTerminalState().then((state) => {
        event.ports[0].postMessage({ type: 'TERMINAL_STATE_RESTORED', data: state });
      });
      break;
      
    case 'TERMINAL_KEEP_ALIVE':
      // Send keep-alive signal
      event.ports[0].postMessage({ type: 'TERMINAL_ALIVE', timestamp: Date.now() });
      break;
      
    default:
      console.log('[Terminal SW] Unknown message type:', type);
  }
});

// Backup terminal state to IndexedDB
async function backupTerminalState(state) {
  try {
    const db = await openDB();
    const transaction = db.transaction([TERMINAL_STORE], 'readwrite');
    const store = transaction.objectStore(TERMINAL_STORE);
    
    await store.put({
      id: 'current-session',
      state: state,
      timestamp: Date.now()
    });
    
    console.log('[Terminal SW] Terminal state backed up');
  } catch (error) {
    console.error('[Terminal SW] Failed to backup terminal state:', error);
  }
}

// Restore terminal state from IndexedDB
async function restoreTerminalState() {
  try {
    const db = await openDB();
    const transaction = db.transaction([TERMINAL_STORE], 'readonly');
    const store = transaction.objectStore(TERMINAL_STORE);
    
    const result = await store.get('current-session');
    
    if (result && result.state) {
      console.log('[Terminal SW] Terminal state restored');
      return result.state;
    }
    
    return null;
  } catch (error) {
    console.error('[Terminal SW] Failed to restore terminal state:', error);
    return null;
  }
}

// Open IndexedDB for terminal persistence
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TERMINAL_DB, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(TERMINAL_STORE)) {
        const store = db.createObjectStore(TERMINAL_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Error handler
self.addEventListener('error', (event) => {
  console.error('[Terminal SW] Service worker error:', event.error);
});

// Unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Terminal SW] Unhandled promise rejection:', event.reason);
});

console.log('[Terminal SW] Service worker loaded');