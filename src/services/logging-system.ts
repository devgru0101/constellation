/**
 * Comprehensive Logging System
 * 
 * Captures and stores detailed logs for all system interactions:
 * - UI interactions and user behavior
 * - Project creation and workspace events
 * - Docker container operations
 * - Preview errors and application issues
 * - Encore CLI logs and output
 * - Claude Code interactions and responses
 */

import { API_CONFIG } from '@/config/api';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'ui' | 'project' | 'container' | 'preview' | 'encore' | 'claude' | 'system' | 'git';
  event: string;
  message: string;
  data?: any;
  userId?: string;
  projectId?: string;
  sessionId?: string;
  stackTrace?: string;
  performance?: {
    startTime: number;
    endTime: number;
    duration: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

export interface LogQuery {
  level?: LogEntry['level'][];
  category?: LogEntry['category'][];
  event?: string;
  projectId?: string;
  sessionId?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface LogAnalytics {
  totalLogs: number;
  errorRate: number;
  averageResponseTime: number;
  topErrors: { error: string; count: number }[];
  categoryBreakdown: { [category: string]: number };
  performanceMetrics: {
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowestOperations: { event: string; duration: number }[];
  };
}

class ComprehensiveLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 10000; // Keep last 10k logs in memory
  private persistenceEnabled = true;
  private performanceTracking: Map<string, number> = new Map();

  constructor() {
    this.initializeLogging();
    this.setupPerformanceMonitoring();
  }

  /**
   * Initialize logging system
   */
  private initializeLogging(): void {
    // Load existing logs from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedLogs = localStorage.getItem('constellation-logs');
        if (savedLogs) {
          const parsedLogs = JSON.parse(savedLogs);
          this.logs = parsedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }));
        }
      } catch (error) {
        console.warn('Failed to load saved logs:', error);
      }
    }

    // Log system initialization
    this.log('info', 'system', 'logging_system_initialized', 'Comprehensive logging system started', {
      maxLogs: this.maxLogs,
      persistenceEnabled: this.persistenceEnabled,
      existingLogs: this.logs.length
    });
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Monitor page performance
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        this.logPerformance('system', 'page_load', 'Page load completed', {
          loadTime: perfData.loadEventEnd - perfData.loadEventStart,
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          totalTime: perfData.loadEventEnd - perfData.fetchStart
        });
      });

      // Monitor memory usage periodically
      setInterval(() => {
        if ('memory' in performance) {
          const memInfo = (performance as any).memory;
          this.log('debug', 'system', 'memory_usage', 'Memory usage snapshot', {
            usedJSHeapSize: memInfo.usedJSHeapSize,
            totalJSHeapSize: memInfo.totalJSHeapSize,
            jsHeapSizeLimit: memInfo.jsHeapSizeLimit
          });
        }
      }, 60000); // Every minute
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogEntry['level'],
    category: LogEntry['category'],
    event: string,
    message: string,
    data?: any,
    projectId?: string,
    sessionId?: string
  ): LogEntry {
    const logEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      event,
      message,
      data,
      projectId,
      sessionId,
      ...(level === 'error' || level === 'critical') && {
        stackTrace: new Error().stack
      }
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Maintain max logs limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist to localStorage
    if (this.persistenceEnabled && typeof window !== 'undefined') {
      try {
        localStorage.setItem('constellation-logs', JSON.stringify(this.logs.slice(-1000))); // Keep last 1000 in storage
      } catch (error) {
        console.warn('Failed to persist logs:', error);
      }
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'error' || level === 'critical' ? console.error :
                           level === 'warn' ? console.warn :
                           level === 'debug' ? console.debug : console.log;
      
      consoleMethod(`[${category.toUpperCase()}] ${event}: ${message}`, data || '');
    }

    // Send to backend for persistent storage
    this.sendToBackend(logEntry);

    return logEntry;
  }

  /**
   * Send log to backend for persistent storage
   */
  private async sendToBackend(logEntry: LogEntry): Promise<void> {
    try {
      await fetch(`${API_CONFIG.apiUrl}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      // Silently fail - don't want logging to break the app
      console.debug('Failed to send log to backend:', error);
    }
  }

  /**
   * Log UI interactions
   */
  logUserInteraction(event: string, data?: any, projectId?: string): LogEntry {
    return this.log('info', 'ui', event, `User interaction: ${event}`, {
      ...data,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    }, projectId);
  }

  /**
   * Log project events
   */
  logProjectEvent(event: string, data?: any, projectId?: string): LogEntry {
    return this.log('info', 'project', event, `Project event: ${event}`, data, projectId);
  }

  /**
   * Log container operations
   */
  logContainerEvent(event: string, data?: any, projectId?: string): LogEntry {
    return this.log('info', 'container', event, `Container event: ${event}`, {
      ...data,
      dockerVersion: data?.dockerVersion,
      containerId: data?.containerId,
      image: data?.image,
      ports: data?.ports
    }, projectId);
  }

  /**
   * Log preview errors
   */
  logPreviewError(error: Error | string, data?: any, projectId?: string): LogEntry {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.log('error', 'preview', 'preview_error', `Preview error: ${errorMessage}`, {
      ...data,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, projectId);
  }

  /**
   * Log Encore CLI operations
   */
  logEncoreEvent(event: string, data?: any, projectId?: string): LogEntry {
    return this.log('info', 'encore', event, `Encore event: ${event}`, {
      ...data,
      command: data?.command,
      output: data?.output,
      exitCode: data?.exitCode,
      workingDir: data?.workingDir
    }, projectId);
  }

  /**
   * Log Claude Code interactions
   */
  logClaudeInteraction(event: string, data?: any, projectId?: string, sessionId?: string): LogEntry {
    return this.log('info', 'claude', event, `Claude Code interaction: ${event}`, {
      ...data,
      messageLength: data?.message?.length,
      responseTime: data?.responseTime,
      filesGenerated: data?.files ? Object.keys(data.files).length : undefined
    }, projectId, sessionId);
  }

  /**
   * Log performance metrics
   */
  logPerformance(category: LogEntry['category'], event: string, message: string, perfData: any): LogEntry {
    return this.log('info', category, event, message, {
      performance: perfData,
      timestamp: Date.now()
    });
  }

  /**
   * Log errors with full context
   */
  logError(event: string, error: Error, context?: any, projectId?: string): LogEntry {
    return this.log('error', 'system', event, error.message, {
      ...context,
      errorName: error.name,
      stack: error.stack,
      cause: error.cause
    }, projectId);
  }

  /**
   * Start performance tracking
   */
  startPerformanceTracking(operationId: string): void {
    this.performanceTracking.set(operationId, performance.now());
  }

  /**
   * End performance tracking
   */
  endPerformanceTracking(operationId: string, event: string, category: LogEntry['category'] = 'system'): LogEntry | null {
    const startTime = this.performanceTracking.get(operationId);
    if (!startTime) return null;

    const duration = performance.now() - startTime;
    this.performanceTracking.delete(operationId);

    return this.log('info', category, event, `Operation completed: ${operationId}`, {
      performance: {
        startTime,
        endTime: performance.now(),
        duration,
        memoryUsage: typeof process !== 'undefined' ? process.memoryUsage() : undefined
      }
    });
  }

  /**
   * Query logs with filters
   */
  queryLogs(query: LogQuery): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (query.level) {
      filteredLogs = filteredLogs.filter(log => query.level!.includes(log.level));
    }

    if (query.category) {
      filteredLogs = filteredLogs.filter(log => query.category!.includes(log.category));
    }

    if (query.event) {
      filteredLogs = filteredLogs.filter(log => log.event.includes(query.event!));
    }

    if (query.projectId) {
      filteredLogs = filteredLogs.filter(log => log.projectId === query.projectId);
    }

    if (query.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === query.sessionId);
    }

    if (query.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime!);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (query.offset) {
      filteredLogs = filteredLogs.slice(query.offset);
    }

    if (query.limit) {
      filteredLogs = filteredLogs.slice(0, query.limit);
    }

    return filteredLogs;
  }

  /**
   * Get log analytics
   */
  getAnalytics(timeframe?: { startTime: Date; endTime: Date }): LogAnalytics {
    let logs = this.logs;

    if (timeframe) {
      logs = logs.filter(log => 
        log.timestamp >= timeframe.startTime && 
        log.timestamp <= timeframe.endTime
      );
    }

    const totalLogs = logs.length;
    const errorLogs = logs.filter(log => log.level === 'error' || log.level === 'critical');
    const errorRate = totalLogs > 0 ? (errorLogs.length / totalLogs) * 100 : 0;

    // Calculate average response time from performance logs
    const perfLogs = logs.filter(log => log.performance?.duration);
    const averageResponseTime = perfLogs.length > 0 
      ? perfLogs.reduce((sum, log) => sum + log.performance!.duration, 0) / perfLogs.length
      : 0;

    // Top errors
    const errorCounts = new Map<string, number>();
    errorLogs.forEach(log => {
      const key = log.message;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    });
    const topErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Category breakdown
    const categoryBreakdown: { [category: string]: number } = {};
    logs.forEach(log => {
      categoryBreakdown[log.category] = (categoryBreakdown[log.category] || 0) + 1;
    });

    // Performance metrics
    const durations = perfLogs.map(log => log.performance!.duration).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    
    const slowestOperations = perfLogs
      .sort((a, b) => b.performance!.duration - a.performance!.duration)
      .slice(0, 10)
      .map(log => ({ event: log.event, duration: log.performance!.duration }));

    return {
      totalLogs,
      errorRate,
      averageResponseTime,
      topErrors,
      categoryBreakdown,
      performanceMetrics: {
        p95ResponseTime: durations[p95Index] || 0,
        p99ResponseTime: durations[p99Index] || 0,
        slowestOperations
      }
    };
  }

  /**
   * Export logs for analysis
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'category', 'event', 'message', 'projectId', 'data'];
      const csvRows = [headers.join(',')];
      
      this.logs.forEach(log => {
        const row = [
          log.timestamp.toISOString(),
          log.level,
          log.category,
          log.event,
          `"${log.message.replace(/"/g, '""')}"`,
          log.projectId || '',
          log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : ''
        ];
        csvRows.push(row.join(','));
      });
      
      return csvRows.join('\n');
    } else {
      return JSON.stringify(this.logs, null, 2);
    }
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('constellation-logs');
    }
    this.log('info', 'system', 'logs_cleared', 'All logs have been cleared');
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.level === 'error' || log.level === 'critical')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

// Singleton instance
export const comprehensiveLogger = new ComprehensiveLogger();

// Export utility functions for common logging patterns
export const loggers = {
  ui: (event: string, data?: any, projectId?: string) => 
    comprehensiveLogger.logUserInteraction(event, data, projectId),
    
  project: (event: string, data?: any, projectId?: string) => 
    comprehensiveLogger.logProjectEvent(event, data, projectId),
    
  container: (event: string, data?: any, projectId?: string) => 
    comprehensiveLogger.logContainerEvent(event, data, projectId),
    
  preview: (error: Error | string, data?: any, projectId?: string) => 
    comprehensiveLogger.logPreviewError(error, data, projectId),
    
  encore: (event: string, data?: any, projectId?: string) => 
    comprehensiveLogger.logEncoreEvent(event, data, projectId),
    
  claude: (event: string, data?: any, projectId?: string, sessionId?: string) => 
    comprehensiveLogger.logClaudeInteraction(event, data, projectId, sessionId),
    
  git: (event: string, data?: any, projectId?: string) => 
    comprehensiveLogger.log('info', 'git', event, `Git operation: ${event}`, data, undefined, projectId),
    
  error: (event: string, error: Error, context?: any, projectId?: string) => 
    comprehensiveLogger.logError(event, error, context, projectId),
    
  perf: {
    start: (operationId: string) => comprehensiveLogger.startPerformanceTracking(operationId),
    end: (operationId: string, event: string, category?: LogEntry['category']) => 
      comprehensiveLogger.endPerformanceTracking(operationId, event, category)
  }
};