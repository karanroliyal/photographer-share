import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

// ── GET /api/v1/albums?projectId= ────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = z.object({ projectId: z.string().min(1) }).parse(req.query);

    const project = await prisma.project.findFirst({
      where: { id: projectId, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!project) throw Errors.NotFound('Project');

    const albums = await prisma.album.findMany({
      where: { project_id: projectId },
      orderBy: { display_order: 'asc' },
      include: { _count: { select: { media_files: true } } },
    });
    res.json({ success: true, data: albums });
  } catch (err) { next(err); }
});

// ── GET /api/v1/albums/:id/media ──────────────────────────────────────────

router.get('/:id/media', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.album.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id },
    });
    if (!existing) throw Errors.NotFound('Album');

    const media = await prisma.mediaFile.findMany({
      where: { album_id: req.params.id, is_deleted: false },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: media });
  } catch (err) { next(err); }
});

// ── POST /api/v1/albums ───────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      project_id: z.string().min(1),
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      display_order: z.number().int().default(0),
    }).parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: data.project_id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!project) throw Errors.NotFound('Project');

    const album = await prisma.album.create({
      data: { ...data, photographer_id: req.user!.id },
    });
    res.status(201).json({ success: true, data: album });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/albums/:id ────────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      display_order: z.number().int().optional(),
    }).parse(req.body);

    const existing = await prisma.album.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id },
    });
    if (!existing) throw Errors.NotFound('Album');

    const album = await prisma.album.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: album });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/albums/:id ─────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.album.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id },
    });
    if (!existing) throw Errors.NotFound('Album');

    const mediaFiles = await prisma.mediaFile.findMany({
      where: { album_id: req.params.id, is_deleted: false },
    });

    let totalSize = 0n, imagesUsed = 0n, videosUsed = 0n;
    let totalImages = 0, totalVideos = 0;
    
    for (const f of mediaFiles) {
      totalSize += BigInt(f.file_size);
      if (f.media_type === 'IMAGE') { imagesUsed += BigInt(f.file_size); totalImages++; }
      if (f.media_type === 'VIDEO') { videosUsed += BigInt(f.file_size); totalVideos++; }
    }

    await prisma.$transaction(async (tx) => {
      if (totalSize > 0n) {
        await tx.storageUsage.update({
          where: { user_id: req.user!.id },
          data: {
            storage_used: { decrement: totalSize },
            total_files: { decrement: mediaFiles.length },
            images_used: { decrement: imagesUsed },
            videos_used: { decrement: videosUsed },
            total_images: { decrement: totalImages },
            total_videos: { decrement: totalVideos },
          },
        });
      }
      await tx.album.delete({ where: { id: req.params.id } });
    });

    try {
      const { cleanupQueue } = await import('../../queues');
      for (const f of mediaFiles) {
        await cleanupQueue.add('delete-r2-file', { storageKey: f.storage_key });
      }
    } catch { /* Ignore */ }

    res.json({ success: true, message: 'Album deleted and storage cleared' });
  } catch (err) { next(err); }
});

export default router;
