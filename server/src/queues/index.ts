import { Queue } from 'bullmq';
import { getRedis } from '../config/redis';

const connection = { connection: getRedis() };

export const thumbnailQueue = new Queue('thumbnail-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const zipQueue = new Queue('zip-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export const emailQueue = new Queue('email-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

export const storageQueue = new Queue('storage-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

export const cleanupQueue = new Queue('cleanup-queue', {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});
