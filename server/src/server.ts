import { execSync } from 'child_process';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedis, disconnectRedis } from './config/redis';
import { startScheduler } from './jobs/scheduler';

// ── BigInt JSON serialization patch ──────────────────────────────────────────
;(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// ── Startup sequence ─────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  logger.info(`🚀  Starting ${env.APP_NAME} server [${env.NODE_ENV}]`);

  // 1. Check DB connection + run migrations
  await setupDatabase();

  // 2. Connect Redis (non-fatal — BullMQ workers need it, but HTTP routes don't)
  const redis = getRedis();
  if (redis) {
    redis.connect().catch(() => {
      logger.warn('⚠️  Redis unavailable — BullMQ workers & rate-limiting will be disabled');
      logger.warn('    Start Redis: docker run -d -p 6379:6379 redis:7-alpine');
    });
  }

  // 3. Start BullMQ workers
  await startWorkers();

  // 4. Start scheduled background jobs
  startScheduler();

  // 5. Start HTTP server
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`✅  HTTP server running on port ${env.PORT}`);
    logger.info(`📖  API: ${env.APP_URL}/api/v1`);
    logger.info(`❤️   Health: ${env.APP_URL}/health`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.warn(`⚠️  ${signal} received — shutting down gracefully`);

    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('✅  Server shut down cleanly');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error('❌  Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

// ── Database setup: connect → migrate → seed ────────────────────────────────

async function setupDatabase(): Promise<void> {
  logger.info('📦  Setting up database...');

  // Connect first (Prisma will auto-create DB if using create-db option)
  await connectDatabase();

  // Run migrations (safe in all environments, but can hang execSync on Windows dev)
  if (env.NODE_ENV === 'production') {
    logger.info('🔄  Running Prisma migrations...');
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      logger.info('✅  Migrations applied');
    } catch (error) {
      logger.error('❌  Migration failed:', error);
      throw error;
    }
  } else {
    logger.info('⏩  Skipping automatic migrations in development');
  }
}

// ── Start BullMQ workers ─────────────────────────────────────────────────────

async function startWorkers(): Promise<void> {
  logger.info('⚙️   Starting background workers...');
  try {
    const { startAllWorkers } = await import('./workers');
    await startAllWorkers();
    logger.info('✅  Workers started');
  } catch (error) {
    logger.warn('⚠️   Workers failed to start (non-fatal in dev):', error);
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

bootstrap().catch((error) => {
  logger.error('❌  Bootstrap failed:', error);
  process.exit(1);
});
