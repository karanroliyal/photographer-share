import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';
import { SelectionState } from '@prisma/client';
import { generateDownloadUrl, getPublicUrl } from '../../utils/storage';
import { env } from '../../config/env';

const router = Router();

// ── GET /api/v1/gallery/:token  (public, no auth) ─────────────────────────

router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gallery = await prisma.clientGallery.findUnique({
      where: { token: req.params.token },
      include: {
        project: {
          select: {
            id: true, name: true, description: true, cover_image_url: true,
            link_expires_at: true,
          },
        },
        photographer: {
          select: { id: true, full_name: true, avatar_url: true, preferences: true },
        },
      },
    });

    if (!gallery || !gallery.is_active) throw Errors.NotFound('Gallery');

    // Increment view count and Notify
    await prisma.clientGallery.update({
      where: { id: gallery.id },
      data: { view_count: { increment: 1 }, last_viewed_at: new Date() },
    });

    const prefs = (gallery.photographer.preferences as any) || {};
    if (prefs['Gallery views'] !== false) {
      await prisma.notification.create({
        data: {
          user_id: gallery.photographer.id,
          type: 'GALLERY_SHARED',
          title: 'Gallery Viewed',
          body: `Your gallery for project "${gallery.project.name}" was just viewed by ${gallery.client_name || 'a client'}.`,
          metadata: { gallery_id: gallery.id, view_count: gallery.view_count + 1 }
        }
      });
    }

    res.json({
      success: true,
      data: {
        gallery_id: gallery.id,
        project: gallery.project,
        photographer: gallery.photographer,
        client_name: gallery.client_name,
        settings: {
          max_selections: gallery.max_selections,
          min_selections: gallery.min_selections,
          allow_download: gallery.allow_download,
          show_watermark: gallery.show_watermark,
          allow_comments: gallery.allow_comments,
        },
        is_submitted: gallery.is_submitted,
        submitted_at: gallery.submitted_at,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/gallery/:token/media  (public, paginated) ─────────────────

router.get('/:token/media', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gallery = await prisma.clientGallery.findUnique({
      where: { token: req.params.token },
      select: { id: true, project_id: true, is_active: true, expires_at: true, show_watermark: true },
    });
    if (!gallery || !gallery.is_active) throw Errors.NotFound('Gallery');
    if (gallery.expires_at && gallery.expires_at < new Date()) throw Errors.Forbidden('Gallery expired');

    const { page = '1', limit = '50', type, albumId } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const albums = await prisma.album.findMany({
      where: { project_id: gallery.project_id },
      select: { id: true },
    });
    const albumIds = albumId
      ? [albumId]
      : albums.map((a) => a.id);

    const where = {
      album_id: { in: albumIds },
      is_deleted: false,
      ...(type && { media_type: type.toUpperCase() as any }),
    };

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip,
        take: Number(limit),
        select: {
          id: true, media_type: true, original_filename: true,
          thumb_small_key: true, thumb_medium_key: true, thumb_large_key: true,
          webp_key: true, preview_key: true,
          storage_key: true,
          width: true, height: true, duration_seconds: true,
          is_processed: true,
          album_id: true, created_at: true,
        },
      }),
      prisma.mediaFile.count({ where }),
    ]);

    // Resolve URLs — use CDN public URL for processed thumbnails (no signing needed),
    // fall back to signed URL for originals and unprocessed files
    const hasPublicCdn = !!env.R2_PUBLIC_URL;

    const resolveUrl = async (key: string | null, expiry = 3600): Promise<string | null> => {
      if (!key) return null;
      if (hasPublicCdn) return getPublicUrl(key);
      try { return await generateDownloadUrl(key, expiry); } catch { return null; }
    };

    const resolvedFiles = await Promise.all(
      files.map(async (file) => {
        // Pick best thumbnail key
        const thumbKey = file.thumb_medium_key || file.thumb_small_key || file.webp_key || file.storage_key;
        const largeKey = file.thumb_large_key || file.webp_key || file.storage_key;

        const [thumb_url, large_url] = await Promise.all([
          resolveUrl(thumbKey),
          resolveUrl(largeKey, 7200),
        ]);

        return {
          id: file.id,
          media_type: file.media_type,
          original_filename: file.original_filename,
          width: file.width,
          height: file.height,
          duration_seconds: file.duration_seconds,
          is_processed: file.is_processed,
          album_id: file.album_id,
          created_at: file.created_at,
          thumb_url,   // Use as <img src={file.thumb_url} />
          large_url,   // Use in lightbox
        };
      })
    );

    res.json({
      success: true,
      data: resolvedFiles,
      pagination: {
        page: Number(page), limit: Number(limit), total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) { next(err); }
});


// ── GET /api/v1/gallery/:token/selections  (public) ───────────────────────

router.get('/:token/selections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gallery = await prisma.clientGallery.findUnique({
      where: { token: req.params.token },
      select: { id: true, is_active: true },
    });
    if (!gallery || !gallery.is_active) throw Errors.NotFound('Gallery');

    const selections = await prisma.gallerySelection.findMany({
      where: { gallery_id: gallery.id },
      select: { id: true, media_file_id: true, state: true, comment: true, updated_at: true },
    });

    res.json({ success: true, data: selections });
  } catch (err) { next(err); }
});

// ── POST /api/v1/gallery/:token/selections  (autosave, public) ────────────

router.post('/:token/selections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gallery = await prisma.clientGallery.findUnique({
      where: { token: req.params.token },
      select: { id: true, is_active: true, is_submitted: true, max_selections: true, expires_at: true },
    });
    if (!gallery || !gallery.is_active) throw Errors.NotFound('Gallery');
    if (gallery.is_submitted) throw Errors.BadRequest('Gallery already submitted');
    if (gallery.expires_at && gallery.expires_at < new Date()) throw Errors.Forbidden('Gallery expired');

    const body = z.object({
      selections: z.array(z.object({
        media_file_id: z.string().min(1),
        state: z.nativeEnum(SelectionState),
        comment: z.string().optional(),
      })),
    }).parse(req.body);

    // Check max selections
    if (gallery.max_selections) {
      const selectedCount = body.selections.filter(
        (s) => s.state === SelectionState.SELECTED || s.state === SelectionState.FAVORITE
      ).length;
      if (selectedCount > gallery.max_selections) {
        throw Errors.BadRequest(`Maximum ${gallery.max_selections} selections allowed`);
      }
    }

    // Upsert all selections
    await Promise.all(
      body.selections.map((sel) =>
        prisma.gallerySelection.upsert({
          where: { gallery_id_media_file_id: { gallery_id: gallery.id, media_file_id: sel.media_file_id } },
          create: { gallery_id: gallery.id, ...sel },
          update: { state: sel.state, comment: sel.comment },
        })
      )
    );

    res.json({ success: true, message: 'Selections saved' });
  } catch (err) { next(err); }
});

// ── POST /api/v1/gallery/:token/submit  (finalize selection) ──────────────

router.post('/:token/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gallery = await prisma.clientGallery.findUnique({
      where: { token: req.params.token },
      select: { 
        id: true, 
        is_active: true, 
        is_submitted: true, 
        min_selections: true,
        photographer_id: true,
        client_name: true,
        project: { select: { name: true } },
        photographer: { select: { preferences: true } }
      },
    });
    if (!gallery || !gallery.is_active) throw Errors.NotFound('Gallery');
    if (gallery.is_submitted) throw Errors.BadRequest('Already submitted');

    // Check constraints
    const count = await prisma.gallerySelection.count({
      where: {
        gallery_id: gallery.id,
        state: { in: [SelectionState.SELECTED, SelectionState.FAVORITE] },
      },
    });

    if (gallery.min_selections && count < gallery.min_selections) {
      throw Errors.BadRequest(`Please select at least ${gallery.min_selections} photos`);
    }

    await prisma.clientGallery.update({
      where: { id: gallery.id },
      data: { is_submitted: true, submitted_at: new Date() },
    });

    // Send Notification if preference enabled
    const prefs = (gallery.photographer.preferences as any) || {};
    if (prefs['Selection submissions'] !== false) {
      await prisma.notification.create({
        data: {
          user_id: gallery.photographer_id,
          type: 'SELECTIONS_SUBMITTED',
          title: 'New Selection Submitted',
          body: `${gallery.client_name || 'A client'} has submitted ${count} selections for project "${gallery.project.name}".`,
          metadata: { gallery_id: gallery.id }
        }
      });
    }

    res.json({ success: true, message: 'Selections submitted successfully' });
  } catch (err) { next(err); }
});

// ── GET /api/v1/gallery  (photographer — list all galleries) ──────────────

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      photographer_id: req.user!.id,
      ...(projectId && { project_id: projectId }),
    };

    const [galleries, total] = await Promise.all([
      prisma.clientGallery.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        include: {
          _count: { select: { selections: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.clientGallery.count({ where }),
    ]);

    res.json({
      success: true,
      data: galleries,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/gallery  (photographer — create gallery) ─────────────────

router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      project_id: z.string().min(1),
      client_name: z.string().optional(),
      client_email: z.string().email().optional(),
      max_selections: z.number().int().positive().optional(),
      min_selections: z.number().int().positive().optional(),
      allow_download: z.boolean().default(false),
      show_watermark: z.boolean().default(true),
      expires_at: z.string().datetime().optional(),
    }).parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: data.project_id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!project) throw Errors.NotFound('Project');

    const gallery = await prisma.clientGallery.create({
      data: {
        photographer_id: req.user!.id,
        token: uuidv4(),
        ...data,
      },
    });

    res.status(201).json({ success: true, data: gallery });
  } catch (err) { next(err); }
});

export default router;
