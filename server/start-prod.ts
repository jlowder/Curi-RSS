import { initializeDatabase } from './init-db';

async function startServer() {
  try {
    await initializeDatabase();
    await import('./production'); 
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
