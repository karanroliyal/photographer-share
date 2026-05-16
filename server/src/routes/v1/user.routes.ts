import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

// ── GET /api/v1/users/profile ──────────────────────────────────────────────

router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, full_name: true, avatar_url: true,
        phone: true, country: true, timezone: true, is_email_verified: true,
        last_login_at: true, created_at: true, preferences: true,
      },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/users/profile ────────────────────────────────────────────

router.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      full_name: z.string().min(2).max(100).optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
      timezone: z.string().optional(),
      preferences: z.any().optional(),
    }).parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, email: true, full_name: true, phone: true, country: true, timezone: true, preferences: true },
    });

    if (req.body.preferences) {
      await prisma.notification.create({
        data: {
          user_id: req.user!.id,
          type: 'GALLERY_SHARED', // Using an existing type for now
          title: 'Preferences Updated',
          body: 'Your notification preferences have been successfully updated.',
        }
      });
    }

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── GET /api/v1/users/storage ──────────────────────────────────────────────

router.get('/storage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await prisma.storageUsage.findUnique({ where: { user_id: req.user!.id } });
    if (!usage) throw Errors.NotFound('Storage info');

    const used = Number(usage.storage_used);
    const limit = Number(usage.storage_limit);

    res.json({
      success: true,
      data: {
        storage_used_bytes: used,
        storage_limit_bytes: limit,
        storage_used_gb: +(used / 1073741824).toFixed(2),
        storage_limit_gb: +(limit / 1073741824).toFixed(2),
        percent_used: limit > 0 ? Math.round((used / limit) * 100) : 0,
        total_files: usage.total_files,
        last_calculated_at: usage.last_calculated_at,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/users/sessions ─────────────────────────────────────────────

router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: { user_id: req.user!.id, is_revoked: false, expires_at: { gt: new Date() } },
      select: { id: true, device_info: true, ip_address: true, created_at: true, expires_at: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: sessions });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/users/sessions/:id ──────────────────────────────────────

router.delete('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { id: req.params.id, user_id: req.user!.id },
      data: { is_revoked: true },
    });
    res.json({ success: true, message: 'Session revoked' });
  } catch (err) { next(err); }
});

export default router;
