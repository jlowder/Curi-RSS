import { initializeDatabase } from './init-db';

async function startServer() {
  try {
    const { getDb } = await import('./db');
    const { sqlite } = await getDb();
    await initializeDatabase(sqlite);
    await import('./production'); 
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
