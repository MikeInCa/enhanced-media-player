const { contextBridge, ipcRenderer } = require('electron');

// Set up error reporting from renderer to main process
window.addEventListener('error', (event) => {
  ipcRenderer.invoke('report-renderer-error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error ? event.error.stack : 'No stack trace',
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ipcRenderer.invoke('report-renderer-error', {
    message: `Unhandled Promise Rejection: ${event.reason}`,
    filename: 'renderer',
    lineno: 0,
    colno: 0,
    stack: event.reason && event.reason.stack ? event.reason.stack : 'No stack trace',
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });
});

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  
  // Error handling APIs
  getErrorStats: () => ipcRenderer.invoke('get-error-stats'),
  exportErrorLog: () => ipcRenderer.invoke('export-error-log'),
  clearOldErrors: (days) => ipcRenderer.invoke('clear-old-errors', days),
  reportError: (errorData) => ipcRenderer.invoke('report-renderer-error', errorData)
});

// Helper function for renderer to report errors safely
contextBridge.exposeInMainWorld('errorReporter', {
  logError: (category, message, details = {}) => {
    ipcRenderer.invoke('report-renderer-error', {
      message: `[${category}] ${message}`,
      filename: 'renderer-manual',
      lineno: 0,
      colno: 0,
      stack: details.stack || new Error().stack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      details
    });
  }
});

console.log('🛡️ Error handling preload script loaded');
