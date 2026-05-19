import { contextBridge, ipcRenderer, shell } from 'electron';

// Expose APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Database operations
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  ensureDbInitialized: () => ipcRenderer.invoke('ensure-db-initialized'),
  
  // Window management
  minimizeWindow: () => {
    const { BrowserWindow } = require('@electron/remote');
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  },
  maximizeWindow: () => {
    const { BrowserWindow } = require('@electron/remote');
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  },
  closeWindow: () => {
    const { BrowserWindow } = require('@electron/remote');
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  },
  
  // Shell operations
  openExternal: (url: string) => shell.openExternal(url),
  
  // Theme
  onThemeChange: (callback: (isDark: boolean) => void) => {
    const listener = (_event: import('electron').IpcRendererEvent, isDark: boolean) => callback(isDark);
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },
  
  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // IPC listeners
  onUpdaterStatus: (callback: (status: string) => void) => {
    const subscription = (_event: import('electron').IpcRendererEvent, status: string) => callback(status);
    ipcRenderer.on('updater-status', subscription);
    return () => ipcRenderer.removeListener('updater-status', subscription);
  },
});

// Expose APIs for database
contextBridge.exposeInMainWorld('database', {
  // Database operations
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  ensureDbInitialized: () => ipcRenderer.invoke('ensure-db-initialized'),
});

// Expose theme for theme management
contextBridge.exposeInMainWorld('nativeTheme', {
  getShouldUseDarkColors: () => ipcRenderer.invoke('get-theme'),
  onUpdated: (callback: (isDark: boolean) => void) => {
    const listener = (_event: any, isDark: boolean) => callback(isDark);
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },
});