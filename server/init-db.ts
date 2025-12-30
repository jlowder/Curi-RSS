import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Initialize database tables
export async function initializeDatabase() {
  try {
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

    // Connect directly to SQLite for initialization
    const sqlite = new Database(dbPath);

    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS feeds (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        description TEXT,
        favicon_url TEXT,
        last_fetched INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        feed_id TEXT NOT NULL REFERENCES feeds(id),
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        url TEXT NOT NULL,
        author TEXT,
        published_at INTEGER,
        image_url TEXT,
        category TEXT,
        is_read INTEGER DEFAULT 0,
        is_bookmarked INTEGER DEFAULT 0,
        is_queued INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    sqlite.close();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}