const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const ErrorHandler = require('./utils/errorHandler');

let mainWindow;
let errorHandler;

const supportedFormats = {
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.flv', '.wmv'],
  audio: ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.wma'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff']
};

function createWindow() {
  errorHandler.logInfo('App', 'Creating main window');
  
  try {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false
      },
      show: false
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      errorHandler.logInfo('App', 'Main window displayed successfully');
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
      errorHandler.logInfo('App', 'Main window closed');
    });

    // Handle renderer process crashes
    mainWindow.webContents.on('crashed', (event) => {
      errorHandler.handleCriticalError('Renderer Crash', new Error('Renderer process crashed'), {
        event: event.toString()
      });
      
      // Attempt to reload
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.reload();
          errorHandler.logInfo('Recovery', 'Attempted to reload after crash');
        }
      }, 1000);
    });

    // Handle unresponsive renderer
    mainWindow.on('unresponsive', () => {
      errorHandler.logError('Performance', 'Renderer process became unresponsive');
      
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Application Unresponsive',
        message: 'The application has become unresponsive. Would you like to restart it?',
        buttons: ['Wait', 'Restart'],
        defaultId: 1
      }).then((result) => {
        if (result.response === 1) {
          mainWindow.reload();
          errorHandler.logInfo('Recovery', 'User chose to restart unresponsive app');
        }
      });
    });

    mainWindow.on('responsive', () => {
      errorHandler.logInfo('Recovery', 'Renderer process became responsive again');
    });

  } catch (error) {
    errorHandler.handleCriticalError('Window Creation', error);
    throw error;
  }
}

function getAllSupportedExtensions() {
  return errorHandler.safeOperation(() => {
    return [
      ...supportedFormats.video.map(ext => ext.slice(1)),
      ...supportedFormats.audio.map(ext => ext.slice(1)),
      ...supportedFormats.image.map(ext => ext.slice(1))
    ];
  }, [], 'Get supported extensions');
}

function isSupportedFile(filePath) {
  return errorHandler.safeOperation(() => {
    const ext = path.extname(filePath).toLowerCase();
    return getAllSupportedExtensions().includes(ext.slice(1));
  }, false, `Check if file is supported: ${filePath}`);
}

async function scanFolderForMedia(folderPath, maxDepth = 2, currentDepth = 0) {
  return await errorHandler.safeAsyncOperation(async () => {
    const mediaFiles = [];
    
    if (currentDepth >= maxDepth) return mediaFiles;

    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      
      try {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await scanFolderForMedia(fullPath, maxDepth, currentDepth + 1);
          mediaFiles.push(...subFiles);
        } else if (entry.isFile() && isSupportedFile(fullPath)) {
          await fs.access(fullPath);
          mediaFiles.push(fullPath);
        }
      } catch (error) {
        errorHandler.logWarning('File Access', `Cannot access file: ${fullPath}`, {
          error: error.message
        });
      }
    }

    return mediaFiles.sort();
  }, [], `Scan folder: ${folderPath}`);
}

// Enhanced IPC Handlers with error handling
function setupIPCHandlers() {
  ipcMain.handle('select-files', async () => {
    return await errorHandler.safeAsyncOperation(async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'All Media', extensions: getAllSupportedExtensions() },
          { name: 'Videos', extensions: supportedFormats.video.map(ext => ext.slice(1)) },
          { name: 'Audio', extensions: supportedFormats.audio.map(ext => ext.slice(1)) },
          { name: 'Images', extensions: supportedFormats.image.map(ext => ext.slice(1)) },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Select Media Files'
      });

      if (result.canceled) return [];

      const validFiles = [];
      for (const filePath of result.filePaths) {
        try {
          await fs.access(filePath);
          if (isSupportedFile(filePath)) {
            validFiles.push(filePath);
          } else {
            errorHandler.logWarning('File Selection', `Unsupported file type selected: ${filePath}`);
          }
        } catch (error) {
          errorHandler.logWarning('File Selection', `Cannot access selected file: ${filePath}`, {
            error: error.message
          });
        }
      }

      errorHandler.logInfo('File Selection', `Successfully selected ${validFiles.length} files`);
      return validFiles;
    }, [], 'Select files dialog');
  });

  ipcMain.handle('select-folder', async () => {
    return await errorHandler.safeAsyncOperation(async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Folder Containing Media'
      });

      if (result.canceled || result.filePaths.length === 0) return [];

      const folderPath = result.filePaths[0];
      const mediaFiles = await scanFolderForMedia(folderPath);
      
      errorHandler.logInfo('Folder Selection', `Found ${mediaFiles.length} media files in folder`, {
        folderPath
      });
      
      return mediaFiles;
    }, [], 'Select folder dialog');
  });

  ipcMain.handle('show-in-folder', async (event, filePath) => {
    return await errorHandler.safeAsyncOperation(async () => {
      await fs.access(filePath);
      shell.showItemInFolder(filePath);
      return { success: true };
    }, { error: 'Could not show file in folder' }, `Show in folder: ${filePath}`);
  });

  // New error handling IPC handlers
  ipcMain.handle('get-error-stats', async () => {
    return errorHandler.getErrorStats();
  });

  ipcMain.handle('export-error-log', async () => {
    return await errorHandler.safeAsyncOperation(async () => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Error Log',
        defaultPath: `error-log-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });

      if (result.canceled) return { canceled: true };

      const success = await errorHandler.exportErrorLog(result.filePath);
      return { success, filePath: result.filePath };
    }, { error: 'Failed to export error log' }, 'Export error log');
  });

  ipcMain.handle('clear-old-errors', async (event, daysToKeep = 7) => {
    return errorHandler.safeOperation(() => {
      const removedCount = errorHandler.clearOldErrors(daysToKeep);
      return { success: true, removedCount };
    }, { error: 'Failed to clear old errors' }, 'Clear old errors');
  });

  ipcMain.handle('report-renderer-error', async (event, errorData) => {
    errorHandler.logError('Renderer', errorData.message, {
      stack: errorData.stack,
      filename: errorData.filename,
      lineno: errorData.lineno,
      colno: errorData.colno,
      userAgent: errorData.userAgent
    });
    return { success: true };
  });
}

// App initialization with error handling
app.whenReady().then(async () => {
  try {
    // Initialize error handler first
    errorHandler = new ErrorHandler();
    
    setupIPCHandlers();
    createWindow();
    
    errorHandler.logInfo('App', 'Application started successfully');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (errorHandler) {
      errorHandler.logInfo('App', 'Application shutting down');
      errorHandler.saveErrorLog();
    }
    app.quit();
  }
});

// Handle app crashes gracefully
app.on('gpu-process-crashed', (event, killed) => {
  if (errorHandler) {
    errorHandler.handleCriticalError('GPU Process Crash', new Error('GPU process crashed'), {
      killed
    });
  }
});

app.on('child-process-gone', (event, details) => {
  if (errorHandler) {
    errorHandler.logError('Process', 'Child process terminated unexpectedly', details);
  }
});

console.log('🛡️ Enhanced Media Player with comprehensive error handling loading...');
