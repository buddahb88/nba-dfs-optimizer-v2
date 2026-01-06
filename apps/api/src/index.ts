import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Load .env from monorepo root BEFORE any other imports
const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

// Now dynamically import the app after env vars are loaded
async function start() {
  const { buildApp } = await import('./app.js');

  const PORT = parseInt(process.env.PORT || '3001', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  const app = await buildApp({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 NBA DFS API v2 running at http://${HOST}:${PORT}`);
    console.log(`📚 API docs at http://${HOST}:${PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
