/**
 * Terminal Persistence Service
 * Handles terminal state backup/restore and service worker communication
 */

export interface TerminalSession {
  id: string;
  terminalId: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  isFullscreen: boolean;
  history: string[];
  timestamp: number;
}

class TerminalPersistenceService {
  private serviceWorker: ServiceWorker | null = null;
  private currentSession: TerminalSession | null = null;
  private backupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize service worker and persistence
   */
  async initialize(): Promise<void> {
    try {
      if ('serviceWorker' in navigator && !this.isRunningInSecureContext()) {
        console.warn('[Terminal Persistence] Service workers require HTTPS or localhost');
        this.setupFallbackPersistence();
        return;
      }

      if ('serviceWorker' in navigator) {
        // Register terminal service worker
        const registration = await navigator.serviceWorker.register('/terminal-sw.js', {
          scope: '/'
        });

        console.log('[Terminal Persistence] Service worker registered:', registration.scope);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        this.serviceWorker = registration.active;

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

        // Setup keep-alive mechanism
        this.setupKeepAlive();

        console.log('[Terminal Persistence] Initialization complete with service worker');
      } else {
        console.warn('[Terminal Persistence] Service workers not supported, using fallback');
        this.setupFallbackPersistence();
      }
    } catch (error) {
      console.error('[Terminal Persistence] Failed to initialize service worker, using fallback:', error);
      this.setupFallbackPersistence();
    }
  }

  /**
   * Check if running in secure context (HTTPS or localhost)
   */
  private isRunningInSecureContext(): boolean {
    return window.isSecureContext || 
           window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.protocol === 'https:';
  }

  /**
   * Setup fallback persistence using localStorage and basic error handling
   */
  private setupFallbackPersistence(): void {
    console.log('[Terminal Persistence] Setting up fallback persistence with localStorage');
    
    // Setup error handlers without service worker
    this.setupKeepAlive();
    
    // Implement simple localStorage-based backup
    setInterval(() => {
      if (this.currentSession) {
        try {
          localStorage.setItem('constellation-terminal-session', JSON.stringify(this.currentSession));
        } catch (error) {
          console.warn('[Terminal Persistence] Failed to backup to localStorage:', error);
        }
      }
    }, 10000); // Backup every 10 seconds
    
    console.log('[Terminal Persistence] Fallback persistence initialized');
  }

  /**
   * Start session tracking
   */
  startSession(terminalId: string): void {
    this.currentSession = {
      id: `session-${Date.now()}`,
      terminalId,
      connectionStatus: 'connecting',
      isFullscreen: false,
      history: [],
      timestamp: Date.now()
    };

    this.startBackupInterval();
    console.log('[Terminal Persistence] Session started:', this.currentSession.id);
  }

  /**
   * Update session state
   */
  updateSession(updates: Partial<TerminalSession>): void {
    if (this.currentSession) {
      Object.assign(this.currentSession, updates);
      this.currentSession.timestamp = Date.now();
    }
  }

  /**
   * End current session
   */
  endSession(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    if (this.currentSession) {
      // Final backup
      this.backupState();
      console.log('[Terminal Persistence] Session ended:', this.currentSession.id);
      this.currentSession = null;
    }
  }

  /**
   * Restore terminal state after app crash/reload
   */
  async restoreSession(): Promise<TerminalSession | null> {
    if (!this.serviceWorker) {
      console.warn('[Terminal Persistence] Service worker not available for restore');
      return null;
    }

    try {
      const channel = new MessageChannel();
      
      return new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          const { type, data } = event.data;
          if (type === 'TERMINAL_STATE_RESTORED') {
            console.log('[Terminal Persistence] State restored:', data);
            resolve(data);
          }
        };

        this.serviceWorker!.postMessage(
          { type: 'TERMINAL_STATE_RESTORE' },
          [channel.port2]
        );

        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });
    } catch (error) {
      console.error('[Terminal Persistence] Failed to restore session:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): TerminalSession | null {
    return this.currentSession;
  }

  /**
   * Add terminal output to history
   */
  addToHistory(data: string): void {
    if (this.currentSession) {
      this.currentSession.history.push(data);
      
      // Keep only last 1000 entries to prevent memory issues
      if (this.currentSession.history.length > 1000) {
        this.currentSession.history = this.currentSession.history.slice(-1000);
      }
    }
  }

  /**
   * Handle app crash detection
   */
  onAppCrash(callback: () => void): void {
    // Listen for beforeunload to detect crashes
    window.addEventListener('beforeunload', () => {
      this.backupState();
    });

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.backupState();
      }
    });

    // Listen for errors that might crash the app
    window.addEventListener('error', (event) => {
      console.error('[Terminal Persistence] App error detected:', event.error);
      this.backupState();
      callback();
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Terminal Persistence] Unhandled rejection detected:', event.reason);
      this.backupState();
      callback();
    });
  }

  /**
   * Private methods
   */
  private startBackupInterval(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Backup every 10 seconds
    this.backupInterval = setInterval(() => {
      this.backupState();
    }, 10000);
  }

  private backupState(): void {
    if (!this.serviceWorker || !this.currentSession) return;

    try {
      this.serviceWorker.postMessage({
        type: 'TERMINAL_STATE_BACKUP',
        data: this.currentSession
      });
    } catch (error) {
      console.error('[Terminal Persistence] Failed to backup state:', error);
    }
  }

  private setupKeepAlive(): void {
    // Send keep-alive every 30 seconds
    setInterval(() => {
      if (this.serviceWorker) {
        const channel = new MessageChannel();
        
        channel.port1.onmessage = (event) => {
          if (event.data.type === 'TERMINAL_ALIVE') {
            console.log('[Terminal Persistence] Keep-alive received');
          }
        };

        this.serviceWorker.postMessage(
          { type: 'TERMINAL_KEEP_ALIVE' },
          [channel.port2]
        );
      }
    }, 30000);
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    
    switch (type) {
      case 'TERMINAL_CONNECTION_LOST':
        console.warn('[Terminal Persistence] Terminal connection lost, attempting recovery...');
        // Trigger reconnection logic
        break;
        
      case 'TERMINAL_STATE_UPDATED':
        console.log('[Terminal Persistence] State updated from service worker');
        break;
        
      default:
        console.log('[Terminal Persistence] Unknown message from service worker:', type);
    }
  }
}

// Singleton instance
export const terminalPersistence = new TerminalPersistenceService();