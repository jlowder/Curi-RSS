import { app, BrowserWindow, Menu, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

// Static imports from source files (bundled by esbuild)
import { registerRoutes } from "../server/routes.js";
import { getDb, getBaseDir, ensureDir } from "../server/db.js";
import { initializeDatabase } from "../server/init-db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The electron main process is always compiled into electron/dist/
// and the Express server is bundled inside it via esbuild --bundle.
// Paths are relative to the project root (which contains dist/, shared/, etc.)

// In both dev and production, we import from within the same bundle.
// The app uses static file serving (not Vite HMR) when running as Electron.
const PORT = parseInt(process.env.PORT || "7016", 10);
const SERVER_URL = `http://localhost:${PORT}`;



// Try to resolve resources path early (may fail in unpackaged context)
let appResourcesPath: string | null = null;
try {
  appResourcesPath = app.getPath('resources');
} catch (e) {
  console.warn('[electron] Failed to get resources path:', e);
}

// Single-instance lock
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  console.log("Another instance is already running. Quitting.");
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let httpServer: any = null;

async function startExpressServer() {
  const expressModule = await import("express");
  const express = expressModule.default;

  // Routes and init-db are imported statically at the top level

  // Create Express app
  const expressApp = express();
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: false }));

  // Request logging middleware
  expressApp.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        console.log(`[express] ${logLine}`);
      }
    });
    next();
  });

  // Ensure data directory exists and lazily init the database
  const baseDir = await getBaseDir();
  ensureDir(baseDir);
  const db = await getDb();
  const sqliteClient = (db as any).$client;
  await initializeDatabase(sqliteClient);

  // Register routes and get HTTP server
  httpServer = await registerRoutes(expressApp);

  // Serve static files from dist/public (Vite build output)
  // In production (packaged), use resources path; in dev, use project root
  // If not packaged or resources path unavailable, fall back to dev paths
  const distPublic = (app.isPackaged && appResourcesPath)
    ? path.join(appResourcesPath, "app", "dist", "public")
    : path.resolve(__dirname, "..", "..", "dist", "public");
  expressApp.use(express.static(distPublic));
  expressApp.get("*", (_req, res) => {
    res.sendFile(path.join(distPublic, "index.html"));
  });

  // Error handler
  expressApp.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // Start listening
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[electron] Express server running on ${SERVER_URL}`);
  });

  return httpServer;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Curi-RSS",
    icon: (app.isPackaged && appResourcesPath)
      ? path.join(appResourcesPath, "public", "favicon.ico")
      : path.resolve(__dirname, "..", "..", "client", "public", "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handler for getting the app data path (used by preload)
ipcMain.handle("get-app-data-path", () => {
  return app.getPath("userData");
});

// IPC handlers for window controls from renderer
ipcMain.handle("minimize-window", () => {
  mainWindow?.minimize();
});

ipcMain.handle("maximize-window", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("close-window", () => {
  mainWindow?.close();
});

// Restore or create window when second instance launches
app.on("secondInstance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

app.whenReady().then(async () => {
  // Set app menu (no default menus)
  Menu.setApplicationMenu(null);

  try {
    await startExpressServer();

    // Wait for server to be ready before opening window
    await new Promise<void>((resolve) => {
      const check = () => {
        http
          .get(SERVER_URL, () => resolve())
          .on("error", () => {
            setTimeout(check, 100);
          });
      };
      check();
    });

    createWindow();
  } catch (err) {
    console.error("Failed to start server:", err);
    app.quit();
  }

  // Handle macOS window recreation
  app.on("activate", () => {
    if (!mainWindow) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (httpServer) {
    httpServer.close();
  }
});