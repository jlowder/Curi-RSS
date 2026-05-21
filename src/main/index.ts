import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } from 'electron';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const fs = require('fs');
const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

// Keep a global reference of the window object and server process
let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let tray: Tray | null = null;

// Get the app's data directory
const userDataPath = app.getPath('userData');
const appDataDir = path.join(userDataPath, 'curi-rss');

// Ensure app data directory exists
if (!existsSync(appDataDir)) {
  mkdirSync(appDataDir, { recursive: true });
}

// Initialize database path in userData
process.env.DB_PATH = path.join(appDataDir, 'rss.db');

// Copy existing database if it doesn't exist in userData
const originalDbPath = path.join(process.cwd(), '..', 'rss.db');
if (!existsSync(process.env.DB_PATH!) && existsSync(originalDbPath)) {
  try {
    fs.copyFileSync(originalDbPath, process.env.DB_PATH!);
  } catch (e) {
    console.log('No existing database to copy');
  }
}

// Auto-updater disabled to prevent GitHub API errors
// const { autoUpdater } = require('electron-updater');

const startServer = () => {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log('Using external development server');
    return;
  }

  // Use DB_PATH initialized earlier
  process.env.PORT = '7016';
  process.env.NODE_ENV = 'production';

  try {
    // Import and start the server directly in the main process
    // This ensures it has access to the same environment and avoids spawn issues
    console.log('Initializing backend server...');
    require('./server.js');
  } catch (error) {
    console.error('Failed to start backend server:', error);
  }
};

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1a1a',
    show: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
  });

  // Enable @electron/remote for the renderer
  remoteMain.enable(mainWindow.webContents);

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // When bundled, we load the index.html from the dist/renderer directory
    // which is at the same level as main.js in the asar
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Show window when ready
  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Handle external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow navigation to same origin
    if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:') || url.startsWith('file://')) {
      return { action: 'allow' };
    }
    
    // Open external URLs in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Clean up on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const createTray = () => {
  // Create tray icon
  let trayIconPath: string;
  
  if (process.platform === 'darwin') {
    trayIconPath = path.join(__dirname, '../assets/iconTemplate.png');
  } else {
    trayIconPath = path.join(__dirname, '../assets/icon.png');
  }

  // Use a simple icon if file doesn't exist
  if (!existsSync(trayIconPath)) {
    trayIconPath = '';
  }

  const trayIcon = nativeImage.createFromPath(trayIconPath);
  
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Curi-RSS',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  
  // Handle tray click
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
};

// Auto-updater disabled to prevent GitHub API errors
// const setupAutoUpdater = () => {
//   console.log('Auto-updater disabled');
//   return;
//   
//   if (process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux') {
//     autoUpdater.autoDownload = true;
//     autoUpdater.autoInstallOnAppQuit = true;
//     
//     // Check for updates after app is ready
//     app.whenReady().then(() => {
//       autoUpdater.checkForUpdates();
//       
//       // Check for updates every hour
//       setInterval(() => {
//         autoUpdater.checkForUpdates();
//       }, 60 * 60 * 1000);
//     });
//     
//     autoUpdater.on('update-downloaded', () => {
//       autoUpdater.quitAndInstall();
//     });
//     
//     autoUpdater.on('error', (error: Error) => {
//       console.error('Auto-updater error:', error);
//     });
//   }
// };

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  startServer();
  createWindow();
  createTray();
  // setupAutoUpdater(); // disabled
  
  // Handle activation on macOS
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for database operations
ipcMain.handle('get-db-path', () => {
  return process.env.DB_PATH;
});

ipcMain.handle('ensure-db-initialized', async () => {
  // Database is initialized in the renderer process
  return true;
});

// Expose app info for renderer
app.whenReady().then(() => {
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      userDataPath: app.getPath('userData'),
    };
  });
  
  ipcMain.handle('open-external-url', (_event, url) => {
    shell.openExternal(url);
  });
});