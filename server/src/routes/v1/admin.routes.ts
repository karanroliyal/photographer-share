import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, requireAdmin } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';
import { PlanInterval, SupportLevel, IntegrationProvider } from '@prisma/client';
import { encrypt, decrypt } from '../../utils/crypto';

const router = Router();
router.use(authenticate, requireAdmin);

// ── GET /api/v1/admin/dashboard ───────────────────────────────────────────

router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers,
      lastMonthUsers,
      totalProjects,
      lastMonthProjects,
      totalFiles,
      activeSubscriptions,
      revenueThisMonth,
      revenueLastMonth,
      failedJobs,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'PHOTOGRAPHER' } }),
      prisma.user.count({ where: { role: 'PHOTOGRAPHER', created_at: { lt: startOfCurrentMonth } } }),
      prisma.project.count({ where: { is_deleted: false } }),
      prisma.project.count({ where: { is_deleted: false, created_at: { lt: startOfCurrentMonth } } }),
      prisma.mediaFile.aggregate({ where: { is_deleted: false }, _sum: { file_size: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', created_at: { gte: startOfCurrentMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', created_at: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amount: true },
      }),
      prisma.zipJob.count({ where: { status: 'FAILED' } }),
    ]);

    // Calculate trends
    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const diff = ((curr - prev) / prev) * 100;
      return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    };

    res.json({
      success: true,
      data: {
        stats: {
          total_photographers: totalUsers,
          total_projects: totalProjects,
          total_files_size: Number(totalFiles._sum.file_size || 0),
          active_subscriptions: activeSubscriptions,
          revenue_this_month: revenueThisMonth._sum.amount ?? 0,
          failed_jobs: failedJobs,
        },
        trends: {
          revenue: calcTrend(Number(revenueThisMonth._sum.amount ?? 0), Number(revenueLastMonth._sum.amount ?? 0)),
          users: calcTrend(totalUsers, lastMonthUsers),
          projects: calcTrend(totalProjects, lastMonthProjects),
        },
        system: {
          database: 'connected',
          storage: 'healthy',
          uptime: process.uptime(),
          version: '1.2.0',
        }
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/users ───────────────────────────────────────────────

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search, status } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      role: 'PHOTOGRAPHER' as const,
      ...(status === 'active' && { is_active: true }),
      ...(status === 'suspended' && { is_suspended: true }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { full_name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true, email: true, full_name: true, is_active: true, is_suspended: true,
          is_email_verified: true, last_login_at: true, created_at: true,
          subscription: { include: { plan: { select: { name: true, slug: true } } } },
          storage_usage: { select: { storage_used: true, storage_limit: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/admin/users/:id/status ─────────────────────────────────

router.patch('/users/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, reason } = z.object({
      action: z.enum(['activate', 'deactivate', 'suspend', 'unsuspend']),
      reason: z.string().optional(),
    }).parse(req.body);

    const data = {
      activate: { is_active: true },
      deactivate: { is_active: false },
      suspend: { is_suspended: true, suspension_reason: reason },
      unsuspend: { is_suspended: false, suspension_reason: null },
    }[action];

    await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ success: true, message: `User ${action}d successfully` });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/plans ───────────────────────────────────────────────

router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { display_order: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// ── POST /api/v1/admin/plans ──────────────────────────────────────────────

router.post('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.plan.create({ data: req.body });
    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/admin/plans/:id ───────────────────────────────────────────

router.put('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/admin/plans/:id ───────────────────────────────────────

router.delete('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subCount = await prisma.subscription.count({ where: { plan_id: req.params.id } });
    if (subCount > 0) throw Errors.BadRequest('Cannot delete plan with active subscribers');

    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/integrations ────────────────────────────────────────

router.get('/integrations', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.integrationConfig.findMany({
      select: {
        id: true, provider: true, environment: true,
        is_active: true, last_tested_at: true, test_passed: true, rotated_at: true,
        // Never expose encrypted keys
      },
    });
    res.json({ success: true, data: configs });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/admin/integrations/:provider ──────────────────────────────

router.put('/integrations/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { public_key, secret_key, extra_config, environment = 'production' } = z.object({
      public_key: z.string().optional(),
      secret_key: z.string().optional(),
      extra_config: z.record(z.unknown()).optional(),
      environment: z.string().default('production'),
    }).parse(req.body);

    const provider = req.params.provider.toUpperCase() as IntegrationProvider;

    await prisma.integrationConfig.upsert({
      where: { provider_environment: { provider, environment } },
      create: {
        provider,
        environment,
        public_key_enc: public_key ? encrypt(public_key) : null,
        secret_key_enc: secret_key ? encrypt(secret_key) : null,
        extra_config_enc: extra_config ? encrypt(JSON.stringify(extra_config)) : null,
      },
      update: {
        public_key_enc: public_key ? encrypt(public_key) : undefined,
        secret_key_enc: secret_key ? encrypt(secret_key) : undefined,
        extra_config_enc: extra_config ? encrypt(JSON.stringify(extra_config)) : undefined,
        rotated_at: new Date(),
        rotated_by: req.user!.id,
      },
    });

    res.json({ success: true, message: 'Integration updated' });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/payments ──────────────────────────────────────────
router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', userId, startDate, endDate } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(userId && { user_id: userId }),
      ...(startDate && endDate && {
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: { select: { full_name: true, email: true } },
          invoice: { select: { invoice_number: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/admin/audit-logs ─────────────────────────────────────────

router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', userId, action } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(userId && { user_id: userId }),
      ...(action && { action: action as any }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        include: { user: { select: { email: true, full_name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
});

export default router;
