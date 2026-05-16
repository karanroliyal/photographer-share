import { Worker, Job } from 'bullmq';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { r2Client, buildZipKey, generateDownloadUrl, isR2Configured } from '../utils/storage';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { JobStatus } from '@prisma/client';

interface ZipJobData {
  zipJobId: string;
  galleryId: string;
  photographerId: string;
  mediaFileIds: string[];
}

export async function processZipJob(zipJobId: string, updateProgress?: (p: number) => Promise<void>) {
    const zipJob = await prisma.zipJob.findUnique({ where: { id: zipJobId } });
    if (!zipJob) {
      logger.error(`ZIP job ${zipJobId} not found in DB`);
      return;
    }

    const mediaFileIds = zipJob.media_file_ids as string[];
    const galleryId = zipJob.gallery_id;
    const photographerId = zipJob.user_id;

    logger.info(`Starting ZIP generation for job ${zipJobId} (${mediaFileIds.length} files)`);

    await prisma.zipJob.update({
      where: { id: zipJobId },
      data: { status: JobStatus.PROCESSING, started_at: new Date() },
    });

    try {
      const files = await prisma.mediaFile.findMany({
        where: { id: { in: mediaFileIds }, is_deleted: false },
        select: { id: true, original_filename: true, storage_key: true, album_id: true },
      });

      const zipKey = buildZipKey(photographerId, zipJobId);
      const archive = archiver('zip', { zlib: { level: 6 } });
      let finalSize = 0;

      if (!isR2Configured()) {
        const zipPath = path.join(process.cwd(), 'uploads', zipKey);
        fs.mkdirSync(path.dirname(zipPath), { recursive: true });
        
        const output = fs.createWriteStream(zipPath);
        archive.pipe(output);

        let processed = 0;
        for (const file of files) {
          const filePath = path.join(process.cwd(), 'uploads', file.storage_key);
          if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: file.original_filename });
          }
          processed++;
          const progress = Math.round((processed / files.length) * 90);
          await prisma.zipJob.update({
            where: { id: zipJobId },
            data: { progress_percent: progress },
          });
          if (updateProgress) await updateProgress(progress);
        }

        await archive.finalize();
        await new Promise<void>((resolve, reject) => {
          output.on('close', resolve);
          output.on('error', reject);
        });
        
        if (fs.existsSync(zipPath)) {
          finalSize = fs.statSync(zipPath).size;
        }

      } else {
        const passThrough = new PassThrough();
        archive.pipe(passThrough);

        const chunks: Buffer[] = [];
        passThrough.on('data', (chunk) => chunks.push(chunk));

        let processed = 0;
        for (const file of files) {
          const getCmd = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: file.storage_key });
          const response = await r2Client.send(getCmd);
          if (!response.Body) continue;

          const fileChunks: Uint8Array[] = [];
          for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
            fileChunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(fileChunks);
          archive.append(fileBuffer, { name: file.original_filename });

          processed++;
          const progress = Math.round((processed / files.length) * 90);
          await prisma.zipJob.update({
            where: { id: zipJobId },
            data: { progress_percent: progress },
          });
          if (updateProgress) await updateProgress(progress);
        }

        await archive.finalize();
        await new Promise<void>((resolve, reject) => {
          passThrough.on('end', resolve);
          passThrough.on('error', reject);
        });

        const zipBuffer = Buffer.concat(chunks);
        finalSize = zipBuffer.length;
        await r2Client.send(new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: zipKey,
          Body: zipBuffer,
          ContentType: 'application/zip',
        }));
      }

      const downloadExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await prisma.zipJob.update({
        where: { id: zipJobId },
        data: {
          status: JobStatus.COMPLETED,
          zip_storage_key: zipKey,
          zip_size: BigInt(finalSize),
          progress_percent: 100,
          completed_at: new Date(),
          download_expires_at: downloadExpires,
        },
      });

      logger.info(`✅ ZIP generated for job ${zipJobId} (${(finalSize / 1024 / 1024).toFixed(1)}MB)`);
    } catch (error) {
      logger.error(`❌ ZIP generation failed for ${zipJobId}:`, error);
      await prisma.zipJob.update({
        where: { id: zipJobId },
        data: { status: JobStatus.FAILED, error_message: String(error) },
      });
      throw error;
    }
}

export const zipWorker = new Worker(
  'zip-queue',
  async (job: Job<ZipJobData>) => {
    await processZipJob(job.data.zipJobId, async (p) => { await job.updateProgress(p); });
  },
  {
    connection: getRedis(),
    concurrency: 2, // Limit concurrent ZIP jobs — memory intensive
  }
);

zipWorker.on('failed', (job, err) => {
  logger.error(`ZIP job ${job?.id} failed:`, err);
});
