import { logger } from '../config/logger';
import { getRedis } from '../config/redis';

export async function startAllWorkers(): Promise<void> {
  // Wait briefly for Redis to establish its connection before checking
  const redisReady = await new Promise<boolean>((resolve) => {
    const client = getRedis();
    if (!client) { resolve(false); return; }

    // If already connected
    if (client.status === 'ready') { resolve(true); return; }

    // Wait up to 2s for ready event
    const timeout = setTimeout(() => resolve(false), 2000);

    client.once('ready', () => { clearTimeout(timeout); resolve(true); });
    client.once('error', () => { clearTimeout(timeout); resolve(false); });
    client.once('close', () => { clearTimeout(timeout); resolve(false); });
  });

  if (!redisReady) {
    logger.warn('⚠️  Skipping BullMQ workers — Redis is not available');
    logger.warn('    Thumbnail processing and ZIP generation will be unavailable');
    logger.warn('    Fix: docker run -d -p 6379:6379 --name redis redis:7-alpine');
    return;
  }

  const { thumbnailWorker } = await import('./thumbnail.worker');
  const { zipWorker } = await import('./zip.worker');

  logger.info('✅ Workers initialized: thumbnail, zip');

  process.on('SIGTERM', async () => {
    await thumbnailWorker.close();
    await zipWorker.close();
    logger.info('Workers closed gracefully');
  });
}
