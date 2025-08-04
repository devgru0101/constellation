/**
 * Log Analysis and Review System
 * 
 * Provides advanced analytics, monitoring, and review capabilities
 * for all system logs to help identify issues and optimize performance.
 */

import { comprehensiveLogger, type LogEntry, type LogQuery, type LogAnalytics } from './logging-system';

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  errorRate: number;
  averageResponseTime: number;
  activeIssues: IssueAlert[];
  performance: {
    cpuUsage?: number;
    memoryUsage?: number;
    networkLatency?: number;
  };
  recommendations: string[];
}

interface IssueAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: LogEntry['category'];
  title: string;
  description: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  resolution?: string;
  status: 'active' | 'investigating' | 'resolved';
}

interface PerformanceInsight {
  type: 'slow_operation' | 'high_error_rate' | 'memory_leak' | 'frequent_retries';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  recommendation: string;
  data: any;
}

interface UserBehaviorInsight {
  mostUsedFeatures: { feature: string; usage: number }[];
  commonUserPaths: string[];
  errorProneAreas: { area: string; errorRate: number }[];
  peakUsageTimes: { hour: number; activity: number }[];
}

class LogAnalysisSystem {
  private alerts: Map<string, IssueAlert> = new Map();
  private performanceBaseline: Map<string, number> = new Map();
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startContinuousAnalysis();
    this.setupPerformanceBaseline();
  }

  /**
   * Start continuous log analysis
   */
  private startContinuousAnalysis(): void {
    // Run analysis every 5 minutes
    this.analysisInterval = setInterval(() => {
      this.runPeriodicAnalysis();
    }, 5 * 60 * 1000);
  }

  /**
   * Setup performance baseline for comparison
   */
  private setupPerformanceBaseline(): void {
    // Get baseline metrics from historical data
    const recentLogs = comprehensiveLogger.queryLogs({
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      level: ['info', 'warn', 'error']
    });

    const perfLogs = recentLogs.filter(log => log.performance?.duration);
    if (perfLogs.length > 0) {
      const avgResponseTime = perfLogs.reduce((sum, log) => 
        sum + log.performance!.duration, 0) / perfLogs.length;
      this.performanceBaseline.set('response_time', avgResponseTime);
    }

    const errorLogs = recentLogs.filter(log => log.level === 'error');
    const errorRate = errorLogs.length / recentLogs.length;
    this.performanceBaseline.set('error_rate', errorRate);
  }

  /**
   * Run periodic analysis
   */
  private runPeriodicAnalysis(): void {
    try {
      // Detect new issues
      this.detectAnomalies();
      this.identifyPerformanceIssues();
      this.updateExistingAlerts();
      
      // Clean up resolved alerts
      this.cleanupOldAlerts();
      
      console.log(`[Log Analysis] Periodic analysis completed. Active alerts: ${this.alerts.size}`);
    } catch (error) {
      console.error('[Log Analysis] Periodic analysis failed:', error);
    }
  }

  /**
   * Detect anomalies in recent logs
   */
  private detectAnomalies(): void {
    const recentLogs = comprehensiveLogger.queryLogs({
      startTime: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
      limit: 1000
    });

    // Detect error spikes
    this.detectErrorSpikes(recentLogs);
    
    // Detect slow operations
    this.detectSlowOperations(recentLogs);
    
    // Detect repeated failures
    this.detectRepeatedFailures(recentLogs);
    
    // Detect unusual patterns
    this.detectUnusualPatterns(recentLogs);
  }

  /**
   * Detect error spikes
   */
  private detectErrorSpikes(logs: LogEntry[]): void {
    const errorLogs = logs.filter(log => log.level === 'error' || log.level === 'critical');
    const errorRate = errorLogs.length / logs.length;
    const baselineErrorRate = this.performanceBaseline.get('error_rate') || 0.05;

    if (errorRate > baselineErrorRate * 3) { // 3x baseline error rate
      this.createOrUpdateAlert('error_spike', {
        severity: errorRate > baselineErrorRate * 10 ? 'critical' : 'high',
        category: 'system',
        title: 'Error Rate Spike Detected',
        description: `Error rate (${(errorRate * 100).toFixed(2)}%) is ${Math.round(errorRate / baselineErrorRate)}x higher than baseline`,
        data: { currentRate: errorRate, baseline: baselineErrorRate, errors: errorLogs.length }
      });
    }
  }

  /**
   * Detect slow operations
   */
  private detectSlowOperations(logs: LogEntry[]): void {
    const perfLogs = logs.filter(log => log.performance?.duration);
    const baselineResponseTime = this.performanceBaseline.get('response_time') || 1000;

    const slowOperations = perfLogs.filter(log => 
      log.performance!.duration > baselineResponseTime * 5
    );

    if (slowOperations.length > 5) {
      this.createOrUpdateAlert('slow_operations', {
        severity: 'medium',
        category: 'system',
        title: 'Slow Operations Detected',
        description: `${slowOperations.length} operations are significantly slower than baseline`,
        data: { 
          slowOps: slowOperations.length, 
          avgDuration: slowOperations.reduce((sum, log) => sum + log.performance!.duration, 0) / slowOperations.length,
          baseline: baselineResponseTime
        }
      });
    }
  }

  /**
   * Detect repeated failures
   */
  private detectRepeatedFailures(logs: LogEntry[]): void {
    const failureCounts = new Map<string, number>();
    
    logs.filter(log => log.level === 'error').forEach(log => {
      const key = `${log.category}:${log.event}`;
      failureCounts.set(key, (failureCounts.get(key) || 0) + 1);
    });

    failureCounts.forEach((count, key) => {
      if (count >= 5) { // 5 or more of the same failure
        const [category, event] = key.split(':');
        this.createOrUpdateAlert(`repeated_failure_${key}`, {
          severity: count >= 20 ? 'critical' : count >= 10 ? 'high' : 'medium',
          category: category as LogEntry['category'],
          title: 'Repeated Failure Pattern',
          description: `${event} has failed ${count} times in the last 30 minutes`,
          data: { event, category, count, pattern: 'repeated_failure' }
        });
      }
    });
  }

  /**
   * Detect unusual patterns
   */
  private detectUnusualPatterns(logs: LogEntry[]): void {
    // Detect unusual user behavior
    const uiLogs = logs.filter(log => log.category === 'ui');
    const rapidClicks = this.detectRapidUserActions(uiLogs);
    
    if (rapidClicks.length > 0) {
      this.createOrUpdateAlert('unusual_user_behavior', {
        severity: 'low',
        category: 'ui',
        title: 'Unusual User Behavior Detected',
        description: `Detected ${rapidClicks.length} instances of rapid user actions`,
        data: { patterns: rapidClicks, type: 'rapid_actions' }
      });
    }

    // Detect container restart patterns
    const containerLogs = logs.filter(log => log.category === 'container');
    const restarts = containerLogs.filter(log => log.event.includes('restart') || log.event.includes('create'));
    
    if (restarts.length > 3) {
      this.createOrUpdateAlert('container_instability', {
        severity: 'medium',
        category: 'container',
        title: 'Container Instability Detected',
        description: `${restarts.length} container restarts in the last 30 minutes`,
        data: { restarts: restarts.length, events: restarts.map(log => log.event) }
      });
    }
  }

  /**
   * Detect rapid user actions
   */
  private detectRapidUserActions(uiLogs: LogEntry[]): any[] {
    const rapidActions: any[] = [];
    let consecutiveActions = 0;
    let lastActionTime = 0;

    uiLogs.forEach(log => {
      const actionTime = log.timestamp.getTime();
      if (actionTime - lastActionTime < 100) { // Less than 100ms between actions
        consecutiveActions++;
      } else {
        if (consecutiveActions > 10) {
          rapidActions.push({
            count: consecutiveActions,
            timespan: lastActionTime - (actionTime - consecutiveActions * 100),
            event: log.event
          });
        }
        consecutiveActions = 0;
      }
      lastActionTime = actionTime;
    });

    return rapidActions;
  }

  /**
   * Create or update alert
   */
  private createOrUpdateAlert(alertId: string, alertData: Partial<IssueAlert>): void {
    const existingAlert = this.alerts.get(alertId);
    
    if (existingAlert) {
      existingAlert.occurrences++;
      existingAlert.lastSeen = new Date();
      if (alertData.severity && alertData.severity !== existingAlert.severity) {
        existingAlert.severity = alertData.severity;
      }
    } else {
      const newAlert: IssueAlert = {
        id: alertId,
        severity: alertData.severity || 'medium',
        category: alertData.category || 'system',
        title: alertData.title || 'System Alert',
        description: alertData.description || 'An issue has been detected',
        occurrences: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        status: 'active',
        ...alertData
      };
      
      this.alerts.set(alertId, newAlert);
      console.log(`[Log Analysis] New alert created: ${newAlert.title}`);
    }
  }

  /**
   * Identify performance issues
   */
  private identifyPerformanceIssues(): void {
    const analytics = comprehensiveLogger.getAnalytics({
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      endTime: new Date()
    });

    // Check if error rate is high
    if (analytics.errorRate > 10) { // More than 10% error rate
      this.createOrUpdateAlert('high_error_rate', {
        severity: analytics.errorRate > 25 ? 'critical' : 'high',
        category: 'system',
        title: 'High Error Rate',
        description: `System error rate is ${analytics.errorRate.toFixed(2)}%`,
        data: { errorRate: analytics.errorRate, threshold: 10 }
      });
    }

    // Check if response time is slow
    if (analytics.averageResponseTime > 5000) { // More than 5 seconds
      this.createOrUpdateAlert('slow_response_time', {
        severity: analytics.averageResponseTime > 10000 ? 'critical' : 'high',
        category: 'system',
        title: 'Slow Response Time',
        description: `Average response time is ${(analytics.averageResponseTime / 1000).toFixed(2)} seconds`,
        data: { responseTime: analytics.averageResponseTime, threshold: 5000 }
      });
    }
  }

  /**
   * Update existing alerts status
   */
  private updateExistingAlerts(): void {
    this.alerts.forEach((alert, alertId) => {
      const timeSinceLastSeen = Date.now() - alert.lastSeen.getTime();
      
      // Auto-resolve alerts that haven't occurred in the last hour
      if (timeSinceLastSeen > 60 * 60 * 1000 && alert.status === 'active') {
        alert.status = 'resolved';
        alert.resolution = 'Auto-resolved: No recent occurrences';
      }
    });
  }

  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    
    this.alerts.forEach((alert, alertId) => {
      if (alert.status === 'resolved' && alert.lastSeen.getTime() < cutoffTime) {
        this.alerts.delete(alertId);
      }
    });
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => alert.status === 'active');
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    const highAlerts = activeAlerts.filter(alert => alert.severity === 'high');

    const analytics = comprehensiveLogger.getAnalytics({
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date()
    });

    let overall: SystemHealth['overall'] = 'healthy';
    if (criticalAlerts.length > 0 || analytics.errorRate > 25) {
      overall = 'critical';
    } else if (highAlerts.length > 0 || analytics.errorRate > 10) {
      overall = 'warning';
    }

    const recommendations = this.generateRecommendations(activeAlerts, analytics);

    return {
      overall,
      errorRate: analytics.errorRate,
      averageResponseTime: analytics.averageResponseTime,
      activeIssues: activeAlerts,
      performance: {
        // These would be populated from system monitoring
        cpuUsage: undefined,
        memoryUsage: undefined,
        networkLatency: undefined
      },
      recommendations
    };
  }

  /**
   * Generate recommendations based on current issues
   */
  private generateRecommendations(alerts: IssueAlert[], analytics: LogAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.errorRate > 10) {
      recommendations.push('Investigate high error rate - check recent code changes and dependencies');
    }

    if (analytics.averageResponseTime > 3000) {
      recommendations.push('Optimize slow operations - consider caching, database indexing, or code optimization');
    }

    const containerAlerts = alerts.filter(alert => alert.category === 'container');
    if (containerAlerts.length > 0) {
      recommendations.push('Review container configuration and resource allocation');
    }

    const claudeAlerts = alerts.filter(alert => alert.category === 'claude');
    if (claudeAlerts.length > 0) {
      recommendations.push('Check Claude Code CLI integration and API connectivity');
    }

    const previewAlerts = alerts.filter(alert => alert.category === 'preview');
    if (previewAlerts.length > 0) {
      recommendations.push('Review preview environment configuration and build processes');
    }

    return recommendations;
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];
    const analytics = comprehensiveLogger.getAnalytics();

    // Slow operations insight
    if (analytics.performanceMetrics.slowestOperations.length > 0) {
      insights.push({
        type: 'slow_operation',
        title: 'Slow Operations Detected',
        description: `${analytics.performanceMetrics.slowestOperations.length} operations are performing slowly`,
        impact: 'high',
        recommendation: 'Optimize these operations or consider background processing',
        data: analytics.performanceMetrics.slowestOperations
      });
    }

    // High error rate insight
    if (analytics.errorRate > 5) {
      insights.push({
        type: 'high_error_rate',
        title: 'Elevated Error Rate',
        description: `Current error rate is ${analytics.errorRate.toFixed(2)}%`,
        impact: analytics.errorRate > 15 ? 'high' : 'medium',
        recommendation: 'Review error logs and implement additional error handling',
        data: { errorRate: analytics.errorRate, topErrors: analytics.topErrors }
      });
    }

    return insights;
  }

  /**
   * Get user behavior insights
   */
  getUserBehaviorInsights(): UserBehaviorInsight {
    const uiLogs = comprehensiveLogger.queryLogs({
      category: ['ui'],
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 5000
    });

    // Most used features
    const featureUsage = new Map<string, number>();
    uiLogs.forEach(log => {
      const feature = log.event;
      featureUsage.set(feature, (featureUsage.get(feature) || 0) + 1);
    });

    const mostUsedFeatures = Array.from(featureUsage.entries())
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    // Peak usage times
    const hourlyUsage = new Array(24).fill(0);
    uiLogs.forEach(log => {
      const hour = log.timestamp.getHours();
      hourlyUsage[hour]++;
    });

    const peakUsageTimes = hourlyUsage
      .map((activity, hour) => ({ hour, activity }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 6);

    return {
      mostUsedFeatures,
      commonUserPaths: [], // Would need session tracking to implement
      errorProneAreas: [], // Would need error correlation analysis
      peakUsageTimes
    };
  }

  /**
   * Generate comprehensive system report
   */
  generateSystemReport(): {
    health: SystemHealth;
    insights: PerformanceInsight[];
    userBehavior: UserBehaviorInsight;
    analytics: LogAnalytics;
    alerts: IssueAlert[];
  } {
    return {
      health: this.getSystemHealth(),
      insights: this.getPerformanceInsights(),
      userBehavior: this.getUserBehaviorInsights(),
      analytics: comprehensiveLogger.getAnalytics(),
      alerts: Array.from(this.alerts.values())
    };
  }

  /**
   * Export system report
   */
  exportSystemReport(format: 'json' | 'html' = 'json'): string {
    const report = this.generateSystemReport();
    
    if (format === 'html') {
      return this.generateHtmlReport(report);
    }
    
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Constellation IDE - System Health Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .health-${report.health.overall} { 
            color: ${report.health.overall === 'healthy' ? 'green' : 
                    report.health.overall === 'warning' ? 'orange' : 'red'}; 
        }
        .alert { padding: 10px; margin: 10px 0; border-left: 4px solid; }
        .alert.critical { border-color: red; background: #ffebee; }
        .alert.high { border-color: orange; background: #fff3e0; }
        .alert.medium { border-color: blue; background: #e3f2fd; }
        .alert.low { border-color: gray; background: #f5f5f5; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric { padding: 15px; background: #f8f9fa; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Constellation IDE - System Health Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <h2>System Health: <span class="health-${report.health.overall}">${report.health.overall.toUpperCase()}</span></h2>
    
    <div class="metrics">
        <div class="metric">
            <h3>Error Rate</h3>
            <p>${report.health.errorRate.toFixed(2)}%</p>
        </div>
        <div class="metric">
            <h3>Avg Response Time</h3>
            <p>${(report.health.averageResponseTime / 1000).toFixed(2)}s</p>
        </div>
        <div class="metric">
            <h3>Total Logs</h3>
            <p>${report.analytics.totalLogs}</p>
        </div>
    </div>
    
    <h2>Active Alerts (${report.alerts.filter((a: any) => a.status === 'active').length})</h2>
    ${report.alerts.filter((a: any) => a.status === 'active').map((alert: any) => `
        <div class="alert ${alert.severity}">
            <h4>${alert.title}</h4>
            <p>${alert.description}</p>
            <small>Occurrences: ${alert.occurrences} | Last seen: ${alert.lastSeen}</small>
        </div>
    `).join('')}
    
    <h2>Recommendations</h2>
    <ul>
        ${report.health.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>
    `;
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}

// Singleton instance
export const logAnalysisSystem = new LogAnalysisSystem();