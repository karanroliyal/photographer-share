import { Worker, Job } from 'bullmq';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { r2Client, buildStorageKey, generateDownloadUrl } from '../utils/storage';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';

interface ThumbnailJobData {
  mediaFileId: string;
  storageKey: string;
  mediaType: 'image' | 'video';
  photographerId: string;
}

const SIZES = {
  small: { width: 300, height: 300 },
  medium: { width: 800, height: 600 },
  large: { width: 1600, height: 1200 },
};

export const thumbnailWorker = new Worker(
  'thumbnail-queue',
  async (job: Job<ThumbnailJobData>) => {
    const { mediaFileId, storageKey, mediaType, photographerId } = job.data;
    logger.info(`Processing thumbnails for media ${mediaFileId}`);

    if (mediaType !== 'image') {
      logger.info(`Skipping thumbnail for non-image: ${mediaFileId}`);
      return;
    }

    try {
      // Download original from R2
      const getCmd = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: storageKey });
      const response = await r2Client.send(getCmd);
      if (!response.Body) throw new Error('No body in R2 response');

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const originalBuffer = Buffer.concat(chunks);

      const projectId = storageKey.split('/')[3]; // photographers/{id}/projects/{projectId}/...
      const ext = storageKey.split('.').pop() ?? 'jpg';
      const baseName = path.basename(storageKey, `.${ext}`);

      const updates: Record<string, string> = {};

      // Generate each thumbnail size
      for (const [sizeName, dims] of Object.entries(SIZES)) {
        const thumbBuffer = await sharp(originalBuffer)
          .resize(dims.width, dims.height, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();

        const thumbKey = buildStorageKey(
          photographerId, projectId,
          `thumbnails/${sizeName}` as any,
          `${baseName}.webp`
        );

        await r2Client.send(new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: 'image/webp',
        }));

        updates[`thumb_${sizeName}_key`] = thumbKey;
      }

      // Also generate WebP version of original
      const webpBuffer = await sharp(originalBuffer).webp({ quality: 90 }).toBuffer();
      const webpKey = buildStorageKey(photographerId, projectId, 'original', `${baseName}.webp`);
      await r2Client.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: webpKey,
        Body: webpBuffer,
        ContentType: 'image/webp',
      }));
      updates['webp_key'] = webpKey;

      // Get image dimensions
      const meta = await sharp(originalBuffer).metadata();

      await prisma.mediaFile.update({
        where: { id: mediaFileId },
        data: {
          ...updates,
          width: meta.width,
          height: meta.height,
          is_processed: true,
        },
      });

      logger.info(`✅ Thumbnails generated for ${mediaFileId}`);
    } catch (error) {
      logger.error(`❌ Thumbnail generation failed for ${mediaFileId}:`, error);
      await prisma.mediaFile.update({
        where: { id: mediaFileId },
        data: { processing_error: String(error) },
      });
      throw error;
    }
  },
  {
    connection: getRedis(),
    concurrency: 5,
  }
);

thumbnailWorker.on('failed', (job, err) => {
  logger.error(`Thumbnail job ${job?.id} failed:`, err);
});
