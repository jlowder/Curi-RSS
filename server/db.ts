import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../shared/schema";
import path from "path";
import fs from "fs";

let _db: ReturnType<typeof drizzle> | null = null;
export let db: ReturnType<typeof drizzle>;

async function getBaseDir(): Promise<string> {
  try {
    const electron = await import("electron");
    const app = electron.app;
    if (app.isPackaged) {
      return app.getPath("userData");
    }
  } catch (e) {
    // Not in Electron
  }
  return process.cwd();
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function getDb() {
  if (_db) return _db;
  
  const baseDir = await getBaseDir();
  
  // In production (Electron), use userData dir; in dev, use cwd
  let dbPath: string;
  try {
    const electron = await import("electron");
    if (electron.app.isPackaged) {
      dbPath = path.join(baseDir, "rss.db");
    } else {
      dbPath = path.join(process.cwd(), "rss.db");
    }
  } catch {
    dbPath = path.join(process.cwd(), "rss.db");
  }
  
  // Ensure the directory exists
  ensureDir(path.dirname(dbPath));
  
  try {
    const sqlite = new Database(dbPath);
    _db = drizzle({ client: sqlite, schema });
    db = _db;
    console.log(`Database opened at: ${dbPath}`);
  } catch (err) {
    console.error(`Failed to open database at ${dbPath}:`, err);
    // Fallback: try the current working directory
    const fallbackPath = path.join(process.cwd(), "rss.db");
    console.warn("Trying fallback path:", fallbackPath);
    try {
      const sqlite = new Database(fallbackPath);
      _db = drizzle({ client: sqlite, schema });
      db = _db;
    } catch (fallbackErr) {
      console.error("Fallback also failed:", fallbackErr);
      throw new Error("Could not open database at primary or fallback path");
    }
  }
  
  return _db;
}

export { getBaseDir, ensureDir };