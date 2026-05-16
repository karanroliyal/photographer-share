import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';
import { ShareLinkType } from '@prisma/client';

const router = Router();
router.use(authenticate);

const createLinkSchema = z.object({
  project_id: z.string().min(1),
  link_type: z.nativeEnum(ShareLinkType).default(ShareLinkType.PUBLIC),
  password: z.string().optional(),
  is_downloadable: z.boolean().default(false),
  show_watermark: z.boolean().default(true),
  expires_at: z.string().datetime().optional(),
  max_views: z.number().int().positive().optional(),
  allowed_emails: z.array(z.string().email()).default([]),
});

// ── GET /api/v1/links?projectId= ─────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = z.object({ projectId: z.string().min(1) }).parse(req.query);
    const links = await prisma.shareLink.findMany({
      where: { project_id: projectId, photographer_id: req.user!.id, is_active: true },
      orderBy: { created_at: 'desc' },
      select: {
        id: true, token: true, link_type: true, is_downloadable: true,
        show_watermark: true, expires_at: true, max_views: true, view_count: true,
        allowed_emails: true, is_active: true, created_at: true,
      },
    });
    res.json({ success: true, data: links });
  } catch (err) { next(err); }
});

// ── POST /api/v1/links ────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createLinkSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: data.project_id, photographer_id: req.user!.id, is_deleted: false },
    });
    if (!project) throw Errors.NotFound('Project');

    if (data.link_type === ShareLinkType.PASSWORD_PROTECTED && !data.password) {
      throw Errors.BadRequest('Password is required for password-protected links');
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const { password, ...rest } = data;

    const link = await prisma.shareLink.create({
      data: {
        ...rest,
        photographer_id: req.user!.id,
        token: uuidv4(),
        password_hash: passwordHash,
      },
    });

    res.status(201).json({ success: true, data: link });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/links/:id ──────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.shareLink.findFirst({
      where: { id: req.params.id, photographer_id: req.user!.id },
    });
    if (!existing) throw Errors.NotFound('Share link');

    await prisma.shareLink.update({
      where: { id: req.params.id },
      data: { is_active: false, revoked_at: new Date() },
    });
    res.json({ success: true, message: 'Link revoked' });
  } catch (err) { next(err); }
});

// ── GET /api/v1/links/view/:token (public access) ─────────────────────────

router.get('/view/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.query as { password?: string };

    const link = await prisma.shareLink.findUnique({
      where: { token: req.params.token },
      include: { project: { select: { name: true, description: true } } },
    });

    if (!link || !link.is_active) throw Errors.NotFound('Share link');
    if (link.expires_at && link.expires_at < new Date()) throw Errors.Forbidden('Link expired');
    if (link.max_views && link.view_count >= link.max_views) throw Errors.Forbidden('Link view limit reached');

    if (link.link_type === ShareLinkType.PASSWORD_PROTECTED) {
      if (!password || !link.password_hash) throw Errors.Unauthorized('Password required');
      const valid = await bcrypt.compare(password, link.password_hash);
      if (!valid) throw Errors.Unauthorized('Incorrect password');
    }

    // Increment view count
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { view_count: { increment: 1 } },
    });

    res.json({
      success: true,
      data: {
        project: link.project,
        is_downloadable: link.is_downloadable,
        show_watermark: link.show_watermark,
      },
    });
  } catch (err) { next(err); }
});

export default router;
