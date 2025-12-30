import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

// Ensure data directory exists in production
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'data', 'rss.db')
  : path.join(process.cwd(), 'rss.db');

if (process.env.NODE_ENV === 'production') {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const sqlite = new Database(dbPath);
export const db = drizzle({ client: sqlite, schema });