const { contextBridge, ipcRenderer } = require("electron");

// Expose protected APIs to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // App info
  getAppVersion: () => process.env.APP_VERSION || "1.0.0",
  isElectron: true,

  // Platform info
  platform: process.platform,

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),
  maximizeWindow: () => ipcRenderer.invoke("maximize-window"),
  closeWindow: () => ipcRenderer.invoke("close-window"),

  // File dialogs (for potential future use)
  openFileDialog: (options) =>
    ipcRenderer.invoke("open-file-dialog", options),

  // App directory for config storage
  appDataPath: () => ipcRenderer.invoke("get-app-data-path"),

  // Listen for messages from main process
  onMessage: (callback) => {
    ipcRenderer.on("main-message", (_event, message) => callback(message));
  },

  // Remove listener
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});