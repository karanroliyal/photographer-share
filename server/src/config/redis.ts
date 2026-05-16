import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,      // Required for BullMQ
      enableReadyCheck: false,
      lazyConnect: true,               // Don't connect immediately
      retryStrategy: (times: number) => {
        if (times > 3) {
          // Stop retrying — Redis is not available
          return null;
        }
        return Math.min(times * 500, 3000);
      },
    });

    client.on('connect', () => {
      redisAvailable = true;
      logger.info('✅  Redis connected');
    });

    client.on('ready', () => {
      redisAvailable = true;
    });

    client.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        redisAvailable = false;
        // Only log once (on first failure) not every retry
      } else {
        logger.error('Redis error:', err);
      }
    });

    client.on('close', () => {
      redisAvailable = false;
    });

    client.on('reconnecting', () => logger.warn('🔄  Redis reconnecting...'));

    redisClient = client;
  } catch (err) {
    logger.warn('⚠️  Redis client could not be created:', err);
  }

  return redisClient;
}

/**
 * Returns true if Redis successfully connected and is ready.
 */
export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient?.status === 'ready';
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // ignore errors on disconnect
    }
    redisClient = null;
    redisAvailable = false;
    logger.info('🔌  Redis disconnected');
  }
}
