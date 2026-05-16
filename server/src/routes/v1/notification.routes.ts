import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// ── GET /api/v1/notifications ─────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', unread } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      user_id: req.user!.id,
      ...(unread === 'true' && { is_read: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { user_id: req.user!.id, is_read: false } }),
    ]);

    res.json({
      success: true,
      data: notifications,
      unread_count: unreadCount,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/notifications/:id/read ─────────────────────────────────

router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, user_id: req.user!.id },
      data: { is_read: true, read_at: new Date() },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/notifications/read-all ─────────────────────────────────

router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { user_id: req.user!.id, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

export default router;
