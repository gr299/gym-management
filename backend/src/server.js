import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './config/db.js';

const app = createApp();

let server;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server = app.listen(config.port, () => {
    console.log(`[Gym Backend API] Server running on port ${config.port} (${config.env})`);
    console.log(`[Gym Backend API] CORS origin allowed: ${config.clientOrigin}`);
  });
}

export default app;

// Graceful shutdown handling
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('\nShutting down server gracefully...');
  server.close(async () => {
    try {
      await pool.end();
      console.log('Database pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database pool:', err);
      process.exit(1);
    }
  });
}

