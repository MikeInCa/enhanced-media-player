const { app, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
    this.errorCounts = new Map();
    this.performanceThresholds = {
      memoryWarning: 512 * 1024 * 1024, // 512MB
      memoryCritical: 1024 * 1024 * 1024, // 1GB
      loadTimeWarning: 5000, // 5 seconds
      loadTimeCritical: 10000 // 10 seconds
    };
    this.logFilePath = path.join(app.getPath('userData'), 'error-log.json');
    this.init();
  }

  init() {
    // Set up global error handlers
    this.setupGlobalHandlers();
    this.startPerformanceMonitoring();
    this.loadErrorLog();
    
    console.log('🛡️ Error handling system initialized');
  }

  setupGlobalHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('Uncaught Exception', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('Unhandled Promise Rejection', reason, { promise: promise.toString() });
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.logWarning(warning.name, warning.message, { stack: warning.stack });
    });
  }

  async loadErrorLog() {
    try {
      const logData = await fs.readFile(this.logFilePath, 'utf8');
      const savedLog = JSON.parse(logData);
      this.errorLog = savedLog.errors || [];
      this.errorCounts = new Map(savedLog.counts || []);
      console.log(`📋 Loaded ${this.errorLog.length} previous error entries`);
    } catch (error) {
      console.log('📋 No previous error log found, starting fresh');
    }
  }

  async saveErrorLog() {
    try {
      const logData = {
        errors: this.errorLog.slice(-this.maxLogSize), // Keep only recent errors
        counts: Array.from(this.errorCounts.entries()),
        lastSaved: new Date().toISOString()
      };
      await fs.writeFile(this.logFilePath, JSON.stringify(logData, null, 2));
    } catch (error) {
      console.error('Failed to save error log:', error);
    }
  }

  logError(category, message, details = {}, severity = 'error') {
    const errorEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      category,
      message: message.toString(),
      details,
      severity,
      stack: details.stack || (new Error().stack),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    this.errorLog.push(errorEntry);
    
    // Update error counts
    const key = `${category}:${message}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Console output with emoji indicators
    const emoji = {
      'critical': '🚨',
      'error': '❌',
      'warning': '⚠️',
      'info': 'ℹ️'
    };

    console.log(`${emoji[severity] || '📝'} [${category}] ${message}`);
    if (details && Object.keys(details).length > 0) {
      console.log('   Details:', details);
    }

    // Auto-save critical errors
    if (severity === 'critical') {
      this.saveErrorLog();
    }

    return errorEntry.id;
  }

  logWarning(category, message, details = {}) {
    return this.logError(category, message, details, 'warning');
  }

  logInfo(category, message, details = {}) {
    return this.logError(category, message, details, 'info');
  }

  handleCriticalError(category, error, extraDetails = {}) {
    const details = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...extraDetails
    };

    const errorId = this.logError(category, error.message, details, 'critical');

    // Show user-friendly error dialog
    this.showErrorDialog(category, error.message, errorId);

    return errorId;
  }

  showErrorDialog(category, message, errorId) {
    try {
      dialog.showErrorBox(
        'Application Error',
        `An unexpected error occurred:\n\n${message}\n\nError ID: ${errorId}\n\nThe error has been logged for analysis.`
      );
    } catch (dialogError) {
      console.error('Failed to show error dialog:', dialogError);
    }
  }

  // Graceful degradation helpers
  async safeAsyncOperation(operation, fallback = null, context = 'Unknown') {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      // Check for performance issues
      if (duration > this.performanceThresholds.loadTimeWarning) {
        this.logWarning('Performance', `Slow operation detected: ${context}`, {
          duration,
          context,
          threshold: this.performanceThresholds.loadTimeWarning
        });
      }

      if (duration > this.performanceThresholds.loadTimeCritical) {
        this.logError('Performance', `Critical slow operation: ${context}`, {
          duration,
          context,
          threshold: this.performanceThresholds.loadTimeCritical
        }, 'critical');
      }

      return result;
    } catch (error) {
      this.logError('Operation Failed', `${context}: ${error.message}`, {
        context,
        error: error.stack
      });

      // Return fallback or rethrow based on criticality
      if (fallback !== null) {
        this.logInfo('Fallback Used', `Using fallback for ${context}`, { fallback });
        return fallback;
      } else {
        throw error;
      }
    }
  }

  safeOperation(operation, fallback = null, context = 'Unknown') {
    try {
      return operation();
    } catch (error) {
      this.logError('Sync Operation Failed', `${context}: ${error.message}`, {
        context,
        error: error.stack
      });

      if (fallback !== null) {
        this.logInfo('Fallback Used', `Using fallback for ${context}`, { fallback });
        return fallback;
      } else {
        throw error;
      }
    }
  }

  startPerformanceMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      
      // Memory warnings
      if (memUsage.heapUsed > this.performanceThresholds.memoryWarning) {
        this.logWarning('Memory Usage', 'High memory usage detected', {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
        });
      }

      if (memUsage.heapUsed > this.performanceThresholds.memoryCritical) {
        this.logError('Memory Usage', 'Critical memory usage detected', {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
        }, 'critical');

        // Suggest garbage collection
        if (global.gc) {
          global.gc();
          this.logInfo('Memory Management', 'Triggered garbage collection');
        }
      }
    }, 10000); // Check every 10 seconds

    // Save error log periodically
    setInterval(() => {
      this.saveErrorLog();
    }, 30000); // Save every 30 seconds
  }

  // Get error statistics
  getErrorStats() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const recentErrors = this.errorLog.filter(error => 
      now - new Date(error.timestamp).getTime() < oneHour
    );

    const todayErrors = this.errorLog.filter(error => 
      now - new Date(error.timestamp).getTime() < oneDay
    );

    const errorsByCategory = {};
    this.errorLog.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
    });

    const errorsBySeverity = {};
    this.errorLog.forEach(error => {
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    return {
      total: this.errorLog.length,
      lastHour: recentErrors.length,
      last24Hours: todayErrors.length,
      byCategory: errorsByCategory,
      bySeverity: errorsBySeverity,
      mostCommon: Array.from(this.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  // Export error log
  async exportErrorLog(filePath) {
    try {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: require('../package.json').version,
          platform: process.platform,
          nodeVersion: process.version
        },
        statistics: this.getErrorStats(),
        errors: this.errorLog
      };

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      this.logInfo('Export', 'Error log exported successfully', { filePath });
      return true;
    } catch (error) {
      this.logError('Export', 'Failed to export error log', { error: error.message });
      return false;
    }
  }

  // Clear old errors
  clearOldErrors(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const originalLength = this.errorLog.length;
    this.errorLog = this.errorLog.filter(error => 
      new Date(error.timestamp) > cutoffDate
    );

    const removedCount = originalLength - this.errorLog.length;
    this.logInfo('Cleanup', `Removed ${removedCount} old error entries`);
    
    this.saveErrorLog();
    return removedCount;
  }
}

module.exports = ErrorHandler;
