/**
 * Preview Error Handler Service
 * 
 * Captures and logs preview errors, application crashes, and build failures
 * for debugging and system monitoring.
 */

import { loggers } from './logging-system';

interface PreviewError {
  type: 'build_error' | 'runtime_error' | 'network_error' | 'container_error';
  message: string;
  stack?: string;
  timestamp: Date;
  projectId?: string;
  url?: string;
  statusCode?: number;
}

class PreviewErrorHandler {
  private errorCounts: Map<string, number> = new Map();
  private maxErrors = 50; // Prevent spam

  constructor() {
    this.setupGlobalErrorHandlers();
  }

  /**
   * Setup global error handlers for preview iframe
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePreviewError({
        type: 'runtime_error',
        message: `Unhandled promise rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: new Date()
      });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      // Only handle preview-related errors
      if (event.filename?.includes('preview') || event.target?.tagName === 'IFRAME') {
        this.handlePreviewError({
          type: 'runtime_error',
          message: event.message,
          stack: event.error?.stack,
          timestamp: new Date(),
          url: event.filename
        });
      }
    });

    // Monitor iframe load errors
    this.setupIFrameErrorMonitoring();
  }

  /**
   * Setup iframe error monitoring
   */
  private setupIFrameErrorMonitoring(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const iframes = element.tagName === 'IFRAME' 
              ? [element] 
              : element.querySelectorAll('iframe');
            
            iframes.forEach((iframe) => {
              this.monitorIFrameErrors(iframe as HTMLIFrameElement);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Monitor specific iframe for errors
   */
  private monitorIFrameErrors(iframe: HTMLIFrameElement): void {
    iframe.addEventListener('error', () => {
      this.handlePreviewError({
        type: 'network_error',
        message: `Failed to load preview: ${iframe.src}`,
        timestamp: new Date(),
        url: iframe.src
      });
    });

    iframe.addEventListener('load', () => {
      try {
        // Try to access iframe content for error monitoring
        const iframeWindow = iframe.contentWindow;
        if (iframeWindow) {
          // Monitor iframe for console errors
          this.monitorIFrameConsole(iframeWindow, iframe.src);
        }
      } catch (error) {
        // Cross-origin restriction - can't monitor directly
        loggers.preview('iframe_cross_origin_restriction', {
          url: iframe.src,
          error: (error as Error).message
        });
      }
    });
  }

  /**
   * Monitor iframe console for errors
   */
  private monitorIFrameConsole(iframeWindow: Window, url: string): void {
    try {
      const originalConsoleError = iframeWindow.console.error;
      const originalConsoleWarn = iframeWindow.console.warn;

      iframeWindow.console.error = (...args: any[]) => {
        this.handlePreviewError({
          type: 'runtime_error',
          message: args.join(' '),
          timestamp: new Date(),
          url
        });
        originalConsoleError.apply(iframeWindow.console, args);
      };

      iframeWindow.console.warn = (...args: any[]) => {
        loggers.preview('preview_warning', {
          message: args.join(' '),
          url
        });
        originalConsoleWarn.apply(iframeWindow.console, args);
      };

      // Monitor for unhandled errors in iframe
      iframeWindow.addEventListener('error', (event) => {
        this.handlePreviewError({
          type: 'runtime_error',
          message: event.message,
          stack: event.error?.stack,
          timestamp: new Date(),
          url
        });
      });

    } catch (error) {
      // Can't access iframe console due to cross-origin restrictions
      loggers.preview('iframe_console_monitoring_failed', {
        url,
        error: (error as Error).message
      });
    }
  }

  /**
   * Handle preview errors
   */
  handlePreviewError(error: PreviewError): void {
    const errorKey = `${error.type}:${error.message}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;

    // Prevent error spam
    if (currentCount >= this.maxErrors) {
      return;
    }

    this.errorCounts.set(errorKey, currentCount + 1);

    // Log the error
    loggers.preview(error.message, {
      type: error.type,
      stack: error.stack,
      url: error.url,
      statusCode: error.statusCode,
      errorCount: currentCount + 1,
      timestamp: error.timestamp
    }, error.projectId);

    // Handle specific error types
    this.handleSpecificErrorType(error);
  }

  /**
   * Handle specific error types with custom logic
   */
  private handleSpecificErrorType(error: PreviewError): void {
    switch (error.type) {
      case 'build_error':
        this.handleBuildError(error);
        break;
      case 'container_error':
        this.handleContainerError(error);
        break;
      case 'network_error':
        this.handleNetworkError(error);
        break;
      case 'runtime_error':
        this.handleRuntimeError(error);
        break;
    }
  }

  /**
   * Handle build errors
   */
  private handleBuildError(error: PreviewError): void {
    loggers.preview('build_error_detected', {
      message: error.message,
      stack: error.stack,
      projectId: error.projectId,
      suggestions: this.getBuildErrorSuggestions(error.message)
    }, error.projectId);
  }

  /**
   * Handle container errors
   */
  private handleContainerError(error: PreviewError): void {
    loggers.container('container_error_in_preview', {
      message: error.message,
      stack: error.stack,
      projectId: error.projectId,
      timestamp: error.timestamp
    }, error.projectId);
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: PreviewError): void {
    loggers.preview('network_error_detected', {
      message: error.message,
      url: error.url,
      statusCode: error.statusCode,
      projectId: error.projectId,
      retryable: this.isRetryableNetworkError(error)
    }, error.projectId);
  }

  /**
   * Handle runtime errors
   */
  private handleRuntimeError(error: PreviewError): void {
    loggers.preview('runtime_error_detected', {
      message: error.message,
      stack: error.stack,
      url: error.url,
      projectId: error.projectId,
      severity: this.getRuntimeErrorSeverity(error.message)
    }, error.projectId);
  }

  /**
   * Get build error suggestions
   */
  private getBuildErrorSuggestions(errorMessage: string): string[] {
    const suggestions: string[] = [];
    
    if (errorMessage.includes('Module not found')) {
      suggestions.push('Check if the module is installed in package.json');
      suggestions.push('Run npm install or yarn install');
    }
    
    if (errorMessage.includes('TypeScript')) {
      suggestions.push('Check TypeScript configuration');
      suggestions.push('Verify type definitions are correct');
    }
    
    if (errorMessage.includes('port') && errorMessage.includes('use')) {
      suggestions.push('Port might be in use, try a different port');
      suggestions.push('Check if another application is running');
    }

    return suggestions;
  }

  /**
   * Check if network error is retryable
   */
  private isRetryableNetworkError(error: PreviewError): boolean {
    if (error.statusCode) {
      return error.statusCode >= 500 || error.statusCode === 408 || error.statusCode === 429;
    }
    
    return error.message.includes('timeout') || 
           error.message.includes('network') ||
           error.message.includes('connection');
  }

  /**
   * Get runtime error severity
   */
  private getRuntimeErrorSeverity(errorMessage: string): 'low' | 'medium' | 'high' | 'critical' {
    if (errorMessage.includes('Cannot read property') || 
        errorMessage.includes('is not a function') ||
        errorMessage.includes('undefined')) {
      return 'high';
    }
    
    if (errorMessage.includes('Warning') || 
        errorMessage.includes('deprecated')) {
      return 'low';
    }
    
    if (errorMessage.includes('memory') || 
        errorMessage.includes('stack overflow')) {
      return 'critical';
    }
    
    return 'medium';
  }

  /**
   * Log build failure
   */
  logBuildFailure(projectId: string, buildOutput: string, exitCode: number): void {
    this.handlePreviewError({
      type: 'build_error',
      message: `Build failed with exit code ${exitCode}`,
      stack: buildOutput,
      timestamp: new Date(),
      projectId,
      statusCode: exitCode
    });
  }

  /**
   * Log container failure
   */
  logContainerFailure(projectId: string, containerId: string, error: Error): void {
    this.handlePreviewError({
      type: 'container_error',
      message: `Container ${containerId} failed: ${error.message}`,
      stack: error.stack,
      timestamp: new Date(),
      projectId
    });
  }

  /**
   * Log network failure
   */
  logNetworkFailure(projectId: string, url: string, statusCode?: number, error?: Error): void {
    this.handlePreviewError({
      type: 'network_error',
      message: error ? error.message : `Network request failed: ${url}`,
      stack: error?.stack,
      timestamp: new Date(),
      projectId,
      url,
      statusCode
    });
  }

  /**
   * Clear error counts (useful for reset)
   */
  clearErrorCounts(): void {
    this.errorCounts.clear();
    loggers.preview('error_counts_cleared', {
      timestamp: new Date()
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { [errorType: string]: number } {
    const stats: { [errorType: string]: number } = {};
    
    this.errorCounts.forEach((count, key) => {
      const [type] = key.split(':');
      stats[type] = (stats[type] || 0) + count;
    });
    
    return stats;
  }
}

// Singleton instance
export const previewErrorHandler = new PreviewErrorHandler();