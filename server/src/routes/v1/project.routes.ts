import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  link_expires_at: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

const paginationSchema = z.object({
  page: z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
  search: z.string().optional(),
  is_archived: z.string().optional().transform((v) => v === 'true'),
});

// ── GET /api/v1/projects ───────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, is_archived } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where = {
      photographer_id: req.user!.id,
      is_deleted: false,
      is_archived: is_archived ?? false,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { tags: { has: search } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { albums: true, client_galleries: true } },
        },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      success: true,
      data: projects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/projects ──────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = projectSchema.parse(req.body);

    // Check plan project limit
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: req.user!.id },
      include: { plan: true },
    });
    if (subscription?.plan.max_projects) {
      const count = await prisma.project.count({
        where: { photographer_id: req.user!.id, is_deleted: false },
      });
      if (count >= subscription.plan.max_projects) {
        throw Errors.PlanLimitExceeded('projects');
      }
    }

    const project = await prisma.project.create({
      data: { ...data, photographer_id: req.user!.id },
    });
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── GET /api/v1/projects/:id ──────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id, is_deleted: false },
      include: {
        albums: { orderBy: { display_order: 'asc' }, include: { _count: { select: { media_files: true } } } },
        _count: { select: { client_galleries: true, share_links: true } },
      },
    });
    if (!project) throw Errors.NotFound('Project');
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/projects/:id ──────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = projectSchema.partial().parse(req.body);
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!existing) throw Errors.NotFound('Project');

    const project = await prisma.project.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/projects/:id ───────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id },
    });
    if (!existing) throw Errors.NotFound('Project');

    const albums = await prisma.album.findMany({
      where: { project_id: req.params.id },
      select: { id: true },
    });
    const albumIds = albums.map(a => a.id);

    const mediaFiles = await prisma.mediaFile.findMany({
      where: { album_id: { in: albumIds }, is_deleted: false },
    });

    let totalSize = 0n, imagesUsed = 0n, videosUsed = 0n;
    let totalImages = 0, totalVideos = 0;
    
    for (const f of mediaFiles) {
      totalSize += BigInt(f.file_size);
      if (f.media_type === 'IMAGE') { imagesUsed += BigInt(f.file_size); totalImages++; }
      if (f.media_type === 'VIDEO') { videosUsed += BigInt(f.file_size); totalVideos++; }
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete media files
      if (mediaFiles.length > 0) {
        await tx.mediaFile.updateMany({
          where: { album_id: { in: albumIds }, is_deleted: false },
          data: { is_deleted: true, deleted_at: new Date() },
        });
      }

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
      
      // Soft delete project
      await tx.project.update({
        where: { id: req.params.id },
        data: { is_deleted: true, deleted_at: new Date() },
      });
    });

    try {
      const { cleanupQueue } = await import('../../queues');
      for (const f of mediaFiles) {
        await cleanupQueue.add('delete-r2-file', { storageKey: f.storage_key });
      }
    } catch { /* Ignore */ }

    res.json({ success: true, message: 'Project deleted and storage cleared' });
  } catch (err) { next(err); }
});

// ── POST /api/v1/projects/:id/archive ────────────────────────────────────

router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!existing) throw Errors.NotFound('Project');

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { is_archived: true, archived_at: new Date() },
    });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── POST /api/v1/projects/:id/restore ────────────────────────────────────

router.post('/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { is_archived: false, archived_at: null },
    });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── POST /api/v1/projects/:id/duplicate ──────────────────────────────────

router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await prisma.project.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!source) throw Errors.NotFound('Project');

    const duplicate = await prisma.project.create({
      data: {
        photographer_id: req.user!.id,
        name: `${source.name} (Copy)`,
        description: source.description,
        tags: source.tags,
      },
    });
    res.status(201).json({ success: true, data: duplicate });
  } catch (err) { next(err); }
});

export default router;
