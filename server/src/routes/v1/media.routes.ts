import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';
import { buildStorageKey, generateUploadUrl, generateDownloadUrl, deleteFile } from '../../utils/storage';
import { MediaType } from '@prisma/client';

const router = Router();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const ALL_ALLOWED = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// ── POST /api/v1/media/upload-url  (get signed URL for direct R2 upload) ──

router.post('/upload-url', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      album_id: z.string().min(1),
      filename: z.string().min(1),
      content_type: z.string().refine((t) => ALL_ALLOWED.includes(t), {
        message: 'Unsupported file type',
      }),
      file_size: z.number().int().positive(),
    }).parse(req.body);

    // Verify album ownership
    const album = await prisma.album.findFirst({
      where: { id: body.album_id, photographer_id: req.user!.id },
      include: { project: true },
    });
    if (!album) throw Errors.NotFound('Album');

    // Get plan limits
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: req.user!.id },
      include: { plan: true },
    });
    if (!subscription) throw Errors.PaymentRequired('No active subscription');

    const isVideo = ALLOWED_VIDEO_TYPES.includes(body.content_type);
    if (isVideo && !subscription.plan.allow_video_uploads) {
      throw Errors.PlanLimitExceeded('video uploads');
    }

    const maxBytes = subscription.plan.max_file_size_mb * 1024 * 1024;
    if (body.file_size > maxBytes) {
      throw Errors.BadRequest(`File too large. Max size: ${subscription.plan.max_file_size_mb}MB`);
    }

    // Check storage quota
    const storageUsage = await prisma.storageUsage.findUnique({ where: { user_id: req.user!.id } });
    if (storageUsage) {
      const limit = Number(storageUsage.storage_limit);
      const used = Number(storageUsage.storage_used);
      if (limit > 0 && used + body.file_size > limit) {
        throw Errors.StorageExceeded();
      }
    }

    // Build storage key
    const ext = body.filename.split('.').pop() ?? 'bin';
    const fileId = uuidv4();
    const storageKey = buildStorageKey(
      req.user!.id,
      album.project_id,
      isVideo ? 'videos' : 'original',
      `${fileId}.${ext}`
    );

    // Generate presigned upload URL
    const uploadUrl = await generateUploadUrl(storageKey, body.content_type, 3600);

    // Create upload job record
    const uploadJob = await prisma.uploadJob.create({
      data: {
        user_id: req.user!.id,
        storage_key: storageKey,
        filename: body.filename,
        file_size: BigInt(body.file_size),
        mime_type: body.content_type,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h
      },
    });

    res.json({
      success: true,
      data: {
        upload_url: uploadUrl,
        storage_key: storageKey,
        upload_job_id: uploadJob.id,
        expires_in: 3600,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/media/confirm  (confirm upload complete, create MediaFile) ─

router.post('/confirm', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      upload_job_id: z.string().min(1),
      album_id: z.string().min(1),
      filename: z.string().min(1),
      file_size: z.number().int().positive(),
      content_type: z.string().min(1),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      duration_seconds: z.number().optional(),
      tags: z.array(z.string()).default([]),
    }).parse(req.body);

    const uploadJob = await prisma.uploadJob.findFirst({
      where: { id: body.upload_job_id, user_id: req.user!.id },
    });
    if (!uploadJob) throw Errors.NotFound('Upload job');

    const isVideo = ALLOWED_VIDEO_TYPES.includes(body.content_type);

    const mediaFile = await prisma.$transaction(async (tx) => {
      // Create media file record
      const file = await tx.mediaFile.create({
        data: {
          album_id: body.album_id,
          photographer_id: req.user!.id,
          original_filename: body.filename,
          storage_key: uploadJob.storage_key,
          file_size: BigInt(body.file_size),
          mime_type: body.content_type,
          media_type: isVideo ? MediaType.VIDEO : MediaType.IMAGE,
          width: body.width,
          height: body.height,
          duration_seconds: body.duration_seconds,
          tags: body.tags,
        },
      });

      // Link upload job to media file
      await tx.uploadJob.update({
        where: { id: uploadJob.id },
        data: { media_file_id: file.id, status: 'COMPLETED', completed_at: new Date() },
      });

      // Update storage usage
      await tx.storageUsage.update({
        where: { user_id: req.user!.id },
        data: {
          storage_used: { increment: BigInt(body.file_size) },
          images_used: isVideo ? undefined : { increment: BigInt(body.file_size) },
          videos_used: isVideo ? { increment: BigInt(body.file_size) } : undefined,
          total_files: { increment: 1 },
          total_images: isVideo ? undefined : { increment: 1 },
          total_videos: isVideo ? { increment: 1 } : undefined,
        },
      });

      return file;
    });

    // Queue thumbnail generation
    try {
      const { thumbnailQueue } = await import('../../queues');
      await thumbnailQueue.add('generate-thumbnails', {
        mediaFileId: mediaFile.id,
        storageKey: uploadJob.storage_key,
        mediaType: isVideo ? 'video' : 'image',
        photographerId: req.user!.id,
      });
    } catch { /* Queue optional in dev */ }

    res.status(201).json({ success: true, data: mediaFile });
  } catch (err) { next(err); }
});

// ── GET /api/v1/media?albumId= ────────────────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { albumId, page = '1', limit = '50', type } = req.query as Record<string, string>;
    if (!albumId) throw Errors.BadRequest('albumId is required');

    const album = await prisma.album.findFirst({
      where: { id: albumId, photographer_id: req.user!.id },
    });
    if (!album) throw Errors.NotFound('Album');

    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      album_id: albumId,
      is_deleted: false,
      ...(type && { media_type: type.toUpperCase() as MediaType }),
    };

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true, original_filename: true, media_type: true,
          thumb_small_key: true, thumb_medium_key: true, thumb_large_key: true,
          width: true, height: true, duration_seconds: true,
          file_size: true, tags: true, is_processed: true, created_at: true,
        },
      }),
      prisma.mediaFile.count({ where }),
    ]);

    res.json({
      success: true,
      data: files,
      pagination: {
        page: Number(page), limit: Number(limit), total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/media/:id/download-url ────────────────────────────────────

router.get('/:id/download-url', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!file) throw Errors.NotFound('Media file');

    const url = await generateDownloadUrl(file.storage_key, 3600);
    res.json({ success: true, data: { download_url: url, expires_in: 3600 } });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/media/:id ──────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!file) throw Errors.NotFound('Media file');

    await prisma.$transaction(async (tx) => {
      await tx.mediaFile.update({
        where: { id: file.id },
        data: { is_deleted: true, deleted_at: new Date() },
      });
      await tx.storageUsage.update({
        where: { user_id: req.user!.id },
        data: {
          storage_used: { decrement: file.file_size },
          total_files: { decrement: 1 },
          images_used: file.media_type === 'IMAGE' ? { decrement: file.file_size } : undefined,
          videos_used: file.media_type === 'VIDEO' ? { decrement: file.file_size } : undefined,
          total_images: file.media_type === 'IMAGE' ? { decrement: 1 } : undefined,
          total_videos: file.media_type === 'VIDEO' ? { decrement: 1 } : undefined,
        },
      });
    });

    // Queue R2 cleanup
    try {
      const { cleanupQueue } = await import('../../queues');
      await cleanupQueue.add('delete-r2-file', { storageKey: file.storage_key });
    } catch { /* Optional */ }

    res.json({ success: true, message: 'File deleted' });
  } catch (err) { next(err); }
});

// ── LOCAL STORAGE FALLBACK ROUTES (Used when R2 is not configured) ─────────

import fs from 'fs';
import path from 'path';

// Handle direct PUT requests for uploads
router.put('/local/*', (req, res) => {
  const key = req.params[0];
  if (!key) {
    res.status(400).json({ error: 'Key is required' });
    return;
  }
  
  const fullPath = path.join(process.cwd(), 'uploads', key);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  
  const writeStream = fs.createWriteStream(fullPath);
  req.pipe(writeStream);
  
  req.on('end', () => res.status(200).send('OK'));
  req.on('error', (err) => res.status(500).json({ error: err.message }));
});

// Handle GET requests for downloads/streaming
router.get('/local/*', (req, res) => {
  const key = req.params[0];
  if (!key) {
    res.status(400).json({ error: 'Key is required' });
    return;
  }
  
  const fullPath = path.join(process.cwd(), 'uploads', key);
  if (!fs.existsSync(fullPath)) {
    res.status(404).send('Not Found');
    return;
  }
  
  if (fullPath.endsWith('.zip')) {
    const filename = req.query.filename ? String(req.query.filename) : path.basename(fullPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  } else if (fullPath.endsWith('.png')) {
    res.setHeader('Content-Type', 'image/png');
  } else if (fullPath.endsWith('.jpg') || fullPath.endsWith('.jpeg')) {
    res.setHeader('Content-Type', 'image/jpeg');
  }

  const readStream = fs.createReadStream(fullPath);
  readStream.pipe(res);
});

export default router;
