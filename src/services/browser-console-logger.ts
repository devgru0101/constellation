/**
 * Browser Console Logger
 * Automatically forwards browser console logs to the server for remote debugging
 */

import { API_CONFIG } from '@/config/api';

interface ConsoleLogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  args: any[];
  timestamp: number;
  url: string;
  userAgent: string;
  stack?: string;
}

class BrowserConsoleLogger {
  private originalConsole: Console;
  private logQueue: ConsoleLogEntry[] = [];
  private isForwarding = false;
  private batchTimeout: NodeJS.Timeout | null = null;
  private maxQueueSize = 100;
  private batchDelay = 2000; // Send logs every 2 seconds

  constructor() {
    this.originalConsole = { ...console };
    this.interceptConsole();
    this.setupErrorHandlers();
  }

  /**
   * Intercept all console methods
   */
  private interceptConsole(): void {
    const levels: Array<keyof Console> = ['log', 'info', 'warn', 'error', 'debug'];
    
    levels.forEach((level) => {
      const originalMethod = this.originalConsole[level];
      
      (console as any)[level] = (...args: any[]) => {
        // Call original console method
        originalMethod.apply(console, args);
        
        // Capture and queue the log
        this.captureLog(level as any, args);
      };
    });
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    // Capture unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureLog('error', [
        `Unhandled Error: ${event.error?.message || event.message}`,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      ], event.error?.stack);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureLog('error', [
        `Unhandled Promise Rejection: ${event.reason}`,
        {
          reason: event.reason,
          stack: event.reason?.stack
        }
      ], event.reason?.stack);
    });
  }

  /**
   * Capture a log entry
   */
  private captureLog(level: ConsoleLogEntry['level'], args: any[], stack?: string): void {
    const entry: ConsoleLogEntry = {
      level,
      message: this.formatMessage(args),
      args: this.sanitizeArgs(args),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      stack
    };

    this.logQueue.push(entry);

    // Limit queue size
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue = this.logQueue.slice(-this.maxQueueSize);
    }

    // Schedule batch send
    this.scheduleBatchSend();
  }

  /**
   * Format log message from arguments
   */
  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return '[Circular Object]';
        }
      }
      return String(arg);
    }).join(' ');
  }

  /**
   * Sanitize arguments for JSON serialization
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: arg.message,
          stack: arg.stack
        };
      }
      if (typeof arg === 'function') {
        return '[Function]';
      }
      if (arg instanceof Element) {
        return `[Element: ${arg.tagName}]`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Test if object can be stringified
          JSON.stringify(arg);
          return arg;
        } catch {
          return '[Circular Reference]';
        }
      }
      return arg;
    });
  }

  /**
   * Schedule batch send of logs
   */
  private scheduleBatchSend(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.sendLogs();
    }, this.batchDelay);
  }

  /**
   * Send logs to server
   */
  private async sendLogs(): Promise<void> {
    if (this.isForwarding || this.logQueue.length === 0) {
      return;
    }

    this.isForwarding = true;
    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    try {
      await fetch(`${API_CONFIG.apiUrl}/browser-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          session: {
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            }
          }
        })
      });

      // Successfully sent, logs are cleared
    } catch (error) {
      // If sending fails, put logs back in queue (but limit size)
      this.logQueue = [...logsToSend.slice(-50), ...this.logQueue];
      
      // Use original console to avoid infinite loop
      this.originalConsole.warn('Failed to send console logs to server:', error);
    } finally {
      this.isForwarding = false;
    }
  }

  /**
   * Force send all queued logs immediately
   */
  public flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    return this.sendLogs();
  }

  /**
   * Get current log queue (for debugging)
   */
  public getQueue(): ConsoleLogEntry[] {
    return [...this.logQueue];
  }

  /**
   * Clear log queue
   */
  public clearQueue(): void {
    this.logQueue = [];
  }
}

// Create global instance
export const browserConsoleLogger = new BrowserConsoleLogger();

// Flush logs when page is about to unload
window.addEventListener('beforeunload', () => {
  browserConsoleLogger.flush();
});