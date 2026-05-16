import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { EmailService } from '../../services/email.service';
import { PaymentStatus, PaymentProvider, SubscriptionStatus, IntegrationProvider } from '@prisma/client';
import crypto from 'crypto';
import { getIntegrationKeys } from '../../utils/integrations';

const router = Router();

// ── GET /api/v1/billing/plans (public — no auth required) ─────────────────────

router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: {
        id: true, name: true, slug: true, description: true, tagline: true,
        is_featured: true, is_custom: true, storage_limit_gb: true,
        max_file_size_mb: true, max_projects: true, max_albums_per_project: true,
        max_clients_per_project: true, max_selections_per_gallery: true,
        interval: true, validity_days: true, trial_days: true,
        price_inr: true, price_usd: true, currency_default: true,
        annual_discount_percent: true,
        allow_password_links: true, allow_expiring_links: true,
        allow_client_download: true, allow_zip_download: true,
        allow_watermark_removal: true, allow_custom_domain: true,
        allow_custom_branding: true, allow_white_label: true,
        allow_video_uploads: true, allow_video_streaming: true,
        allow_analytics: true, allow_webhooks: true, allow_api_access: true,
        allow_team_members: true, support_level: true, sla_response_hours: true,
        stripe_price_id: true, razorpay_plan_id: true,
      },
    });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// ── Authenticated routes ───────────────────────────────────────────────────────

router.use(authenticate);

// ── GET /api/v1/billing/subscription ─────────────────────────────────────────

router.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: req.user!.id },
      include: { plan: true },
    });
    res.json({ success: true, data: subscription });
  } catch (err) { next(err); }
});

// ── GET /api/v1/billing/invoices ──────────────────────────────────────────────

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10' } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { user_id: req.user!.id },
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          provider: true,
          provider_payment_id: true,
          amount: true,
          currency: true,
          status: true,
          created_at: true,
          invoice: { select: { invoice_number: true } },
        },
      }),
      prisma.payment.count({ where: { user_id: req.user!.id } }),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/billing/checkout/razorpay ────────────────────────────────────

router.post('/checkout/razorpay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan_id } = z.object({ plan_id: z.string().min(1) }).parse(req.body);

    const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!plan) throw Errors.NotFound('Plan');
    if (plan.is_custom) throw Errors.BadRequest('Contact sales for Enterprise plans');
    if (plan.price_inr === 0) throw Errors.BadRequest('Cannot checkout a free plan');

    const keys = await getIntegrationKeys(IntegrationProvider.RAZORPAY);
    if (!keys || !keys.publicKey || !keys.secretKey) {
      throw Errors.Internal('Razorpay is not configured. Please check Admin Integrations.');
    }

    const Razorpay = (await import('razorpay')).default;
    const rzp = new Razorpay({ key_id: keys.publicKey, key_secret: keys.secretKey });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true, full_name: true, phone: true },
    });

    try {
      const order = await rzp.orders.create({
        amount: plan.price_inr,
        currency: 'INR',
        receipt: `ps_${Date.now()}`,
        notes: {
          user_id: req.user!.id,
          plan_id: plan.id,
          plan_slug: plan.slug,
        } as any,
      });

      res.json({
        success: true,
        data: {
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: keys.publicKey,
          plan: { id: plan.id, name: plan.name },
          prefill: {
            name: user?.full_name,
            email: user?.email,
            contact: user?.phone,
          },
        },
      });
    } catch (rzpErr: any) {
      logger.error('Razorpay order creation failed:', rzpErr);
      throw Errors.Internal('Payment gateway error. Please verify Razorpay credentials.');
    }
  } catch (err) { next(err); }
});

// ── POST /api/v1/billing/verify/razorpay ─────────────────────────────────────

router.post('/verify/razorpay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
      plan_id: z.string(),
    }).parse(req.body);

    const keys = await getIntegrationKeys(IntegrationProvider.RAZORPAY);
    if (!keys || !keys.secretKey) throw Errors.Internal('Razorpay not configured');

    // Verify HMAC signature
    const expectedSig = crypto
      .createHmac('sha256', keys.secretKey)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== body.razorpay_signature) {
      throw Errors.BadRequest('Invalid payment signature');
    }

    const plan = await prisma.plan.findUnique({ where: { id: body.plan_id } });
    if (!plan) throw Errors.NotFound('Plan');

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, full_name: true },
    });
    if (!user) throw Errors.NotFound('User');

    // Check idempotency
    const existing = await prisma.payment.findFirst({
      where: { provider_payment_id: body.razorpay_payment_id },
    });
    if (existing) {
      res.json({ success: true, message: 'Payment already processed' });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + (plan.validity_days ?? 30) * 24 * 60 * 60 * 1000);
    const invoiceNumber = `INV-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      // 1. Record payment
      const payment = await tx.payment.create({
        data: {
          user_id: user.id,
          provider: PaymentProvider.RAZORPAY,
          provider_payment_id: body.razorpay_payment_id,
          provider_invoice_id: body.razorpay_order_id,
          amount: plan.price_inr,
          currency: 'INR',
          status: PaymentStatus.SUCCESS,
          metadata: body as any,
        },
      });

      // 2. Create invoice linked to payment
      await tx.invoice.create({
        data: {
          user_id: user.id,
          payment_id: payment.id,
          invoice_number: invoiceNumber,
          amount: plan.price_inr,
          currency: 'INR',
          billing_name: user.full_name,
          billing_email: user.email,
        },
      });

      // 3. Upsert subscription
      await tx.subscription.upsert({
        where: { user_id: user.id },
        create: {
          user_id: user.id,
          plan_id: plan.id,
          status: SubscriptionStatus.ACTIVE,
          interval: plan.interval,
          current_period_start: now,
          current_period_end: periodEnd,
        },
        update: {
          plan_id: plan.id,
          status: SubscriptionStatus.ACTIVE,
          interval: plan.interval,
          current_period_start: now,
          current_period_end: periodEnd,
          canceled_at: null,
        },
      });

      // 4. Update storage limit
      const storageLimitBytes = plan.storage_limit_gb > 0
        ? BigInt(Math.round(plan.storage_limit_gb * 1024 * 1024 * 1024))
        : BigInt(Number.MAX_SAFE_INTEGER);
      await tx.storageUsage.update({
        where: { user_id: user.id },
        data: { storage_limit: storageLimitBytes },
      });

      // 5. Create notification
      await tx.notification.create({
        data: {
          user_id: user.id,
          type: 'PAYMENT_SUCCESS',
          title: 'Payment successful!',
          body: `Your ${plan.name} plan is now active.`,
        },
      });
    });

    EmailService.sendPaymentSuccess(
      user.email, user.full_name, plan.name,
      plan.price_inr, 'INR', invoiceNumber
    ).catch(() => {});

    res.json({ success: true, message: `${plan.name} plan activated successfully!` });
  } catch (err) { next(err); }
});

// ── POST /api/v1/billing/checkout/stripe ─────────────────────────────────────

router.post('/checkout/stripe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan_id } = z.object({ plan_id: z.string().min(1) }).parse(req.body);

    const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!plan) throw Errors.NotFound('Plan');
    if (plan.is_custom) throw Errors.BadRequest('Contact sales for Enterprise plans');
    if (!plan.stripe_price_id) throw Errors.BadRequest('Stripe is not configured for this plan');
    if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.includes('sk_test_...')) {
      throw Errors.Internal('Stripe is not configured with real credentials in .env');
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' } as any);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true, full_name: true },
    });

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: plan.stripe_price_id!, quantity: 1 }],
        customer_email: user?.email,
        success_url: `${env.FRONTEND_URL}/billing?stripe=success&plan=${plan.slug}`,
        cancel_url: `${env.FRONTEND_URL}/billing?stripe=cancelled`,
        metadata: { user_id: req.user!.id, plan_id: plan.id },
      });

      res.json({ success: true, data: { checkout_url: session.url } });
    } catch (stripeErr: any) {
      logger.error('Stripe session creation failed:', stripeErr);
      throw Errors.Internal('Payment gateway error. Please verify Stripe credentials.');
    }
  } catch (err) { next(err); }
});

// ── POST /api/v1/billing/stripe/webhook ──────────────────────────────────────

router.post('/stripe/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    res.json({ received: true });
    return;
  }

  let event: any;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' } as any);
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).json({ error: 'Webhook signature invalid' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { user_id, plan_id } = session.metadata ?? {};
        if (!user_id || !plan_id) break;

        const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
        const user = await prisma.user.findUnique({
          where: { id: user_id },
          select: { id: true, email: true, full_name: true, preferences: true },
        });
        if (!plan || !user) break;

        // Idempotency check
        const existing = await prisma.payment.findFirst({
          where: { provider_payment_id: session.payment_intent ?? session.id },
        });
        if (existing) break;

        const now = new Date();
        const periodEnd = new Date(now.getTime() + (plan.validity_days ?? 30) * 24 * 60 * 60 * 1000);
        const invoiceNumber = `INV-STRIPE-${Date.now()}`;

        await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.create({
            data: {
              user_id: user.id,
              provider: PaymentProvider.STRIPE,
              provider_payment_id: session.payment_intent ?? session.id,
              provider_invoice_id: session.invoice,
              amount: plan.price_usd,
              currency: 'USD',
              status: PaymentStatus.SUCCESS,
              metadata: event.data.object,
            },
          });

          await tx.invoice.create({
            data: {
              user_id: user.id,
              payment_id: payment.id,
              invoice_number: invoiceNumber,
              amount: plan.price_usd,
              currency: 'USD',
              billing_name: user.full_name,
              billing_email: user.email,
            },
          });

          await tx.subscription.upsert({
            where: { user_id: user.id },
            create: {
              user_id: user.id,
              plan_id: plan.id,
              status: SubscriptionStatus.ACTIVE,
              interval: plan.interval,
              current_period_start: now,
              current_period_end: periodEnd,
              stripe_subscription_id: session.subscription,
            },
            update: {
              plan_id: plan.id,
              status: SubscriptionStatus.ACTIVE,
              current_period_start: now,
              current_period_end: periodEnd,
              stripe_subscription_id: session.subscription,
              canceled_at: null,
            },
          });

          const storageLimitBytes = plan.storage_limit_gb > 0
            ? BigInt(Math.round(plan.storage_limit_gb * 1024 * 1024 * 1024))
            : BigInt(Number.MAX_SAFE_INTEGER);
          await tx.storageUsage.update({
            where: { user_id: user.id },
            data: { storage_limit: storageLimitBytes },
          });

          const prefs = (user.preferences as any) || {};
          if (prefs['Payment confirmations'] !== false) {
            await tx.notification.create({
              data: {
                user_id: user.id,
                type: 'PAYMENT_SUCCESS',
                title: 'Payment successful!',
                body: `Your ${plan.name} plan is now active.`,
              },
            });
          }
        });

        EmailService.sendPaymentSuccess(
          user.email, user.full_name, plan.name,
          plan.price_usd, 'USD', invoiceNumber
        ).catch(() => {});

        logger.info(`✅ Stripe checkout completed for user ${user_id}, plan ${plan.slug}`);
        break;
      }

      case 'invoice.payment_failed': {
        const stripeInvoice = event.data.object;
        const sub = await prisma.subscription.findFirst({
          where: { stripe_subscription_id: stripeInvoice.subscription },
          include: { user: { select: { email: true, full_name: true } }, plan: true },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.PAST_DUE },
          });
          await prisma.notification.create({
            data: {
              user_id: sub.user_id,
              type: 'PAYMENT_FAILED',
              title: 'Payment failed',
              body: 'We could not process your subscription renewal. Please update your payment method.',
            },
          });
          EmailService.sendPaymentFailed(
            sub.user.email, sub.user.full_name, sub.plan.name,
            sub.plan.grace_period_days
          ).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripe_subscription_id: stripeSub.id },
          data: { status: SubscriptionStatus.CANCELED, canceled_at: new Date() },
        });
        break;
      }

      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    logger.error('Error processing Stripe webhook:', err);
  }

  res.json({ received: true });
});

// ── POST /api/v1/billing/razorpay/webhook ─────────────────────────────────────

router.post('/razorpay/webhook', async (req: Request, res: Response) => {
  try {
    const keys = await getIntegrationKeys(IntegrationProvider.RAZORPAY);
    const webhookSecret = keys?.secretKey;
    if (webhookSecret) {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (signature) {
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');
        if (expectedSig !== signature) {
          res.status(400).json({ error: 'Invalid signature' });
          return;
        }
      }
    }

    const event = req.body;
    logger.info(`Razorpay webhook event: ${event.event}`);

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload?.payment?.entity;
        const notes = payment?.notes ?? {};
        const { user_id, plan_id } = notes;
        if (!user_id || !plan_id) break;

        // Idempotency check
        const existing = await prisma.payment.findFirst({
          where: { provider_payment_id: payment.id },
        });
        if (existing) break;

        const plan = await prisma.plan.findUnique({ where: { id: plan_id } });
        const user = await prisma.user.findUnique({
          where: { id: user_id },
          select: { id: true, email: true, full_name: true },
        });
        if (!plan || !user) break;

        const now = new Date();
        const periodEnd = new Date(now.getTime() + (plan.validity_days ?? 30) * 24 * 60 * 60 * 1000);
        const invoiceNumber = `INV-RZP-${Date.now()}`;

        await prisma.$transaction(async (tx) => {
          const paymentRecord = await tx.payment.create({
            data: {
              user_id: user.id,
              provider: PaymentProvider.RAZORPAY,
              provider_payment_id: payment.id,
              provider_invoice_id: payment.order_id,
              amount: payment.amount,
              currency: payment.currency?.toUpperCase() ?? 'INR',
              status: PaymentStatus.SUCCESS,
              metadata: payment,
            },
          });

          await tx.invoice.create({
            data: {
              user_id: user.id,
              payment_id: paymentRecord.id,
              invoice_number: invoiceNumber,
              amount: payment.amount,
              currency: payment.currency?.toUpperCase() ?? 'INR',
              billing_name: user.full_name,
              billing_email: user.email,
            },
          });

          await tx.subscription.upsert({
            where: { user_id: user.id },
            create: {
              user_id: user.id,
              plan_id: plan.id,
              status: SubscriptionStatus.ACTIVE,
              interval: plan.interval,
              current_period_start: now,
              current_period_end: periodEnd,
            },
            update: {
              plan_id: plan.id,
              status: SubscriptionStatus.ACTIVE,
              current_period_start: now,
              current_period_end: periodEnd,
              canceled_at: null,
            },
          });

          const storageLimitBytes = plan.storage_limit_gb > 0
            ? BigInt(Math.round(plan.storage_limit_gb * 1024 * 1024 * 1024))
            : BigInt(Number.MAX_SAFE_INTEGER);
          await tx.storageUsage.update({
            where: { user_id: user.id },
            data: { storage_limit: storageLimitBytes },
          });

          await tx.notification.create({
            data: {
              user_id: user.id,
              type: 'PAYMENT_SUCCESS',
              title: 'Payment successful!',
              body: `Your ${plan.name} plan is now active.`,
            },
          });
        });

        EmailService.sendPaymentSuccess(
          user.email, user.full_name, plan.name,
          payment.amount, 'INR', invoiceNumber
        ).catch(() => {});
        break;
      }

      case 'payment.failed': {
        const payment = event.payload?.payment?.entity;
        const { user_id } = payment?.notes ?? {};
        if (!user_id) break;

        const sub = await prisma.subscription.findUnique({
          where: { user_id },
          include: { user: { select: { email: true, full_name: true } }, plan: true },
        });
        if (sub) {
          await prisma.notification.create({
            data: {
              user_id,
              type: 'PAYMENT_FAILED',
              title: 'Payment failed',
              body: `Your payment of ₹${(payment.amount / 100).toLocaleString()} could not be processed.`,
            },
          });
          EmailService.sendPaymentFailed(
            sub.user.email, sub.user.full_name, sub.plan.name,
            sub.plan.grace_period_days
          ).catch(() => {});
        }
        break;
      }

      default:
        logger.debug(`Unhandled Razorpay event: ${event.event}`);
    }
  } catch (err) {
    logger.error('Razorpay webhook error:', err);
  }
  res.json({ received: true });
});

// ── POST /api/v1/billing/cancel ───────────────────────────────────────────────

router.post('/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: req.user!.id },
    });
    if (!subscription) throw Errors.NotFound('Subscription');
    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw Errors.BadRequest('Subscription is already cancelled');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        canceled_at: new Date(),
        // Keep status ACTIVE until period_end, cron job will set to EXPIRED later
        // or just rely on current_period_end for access checks.
      },
    });

    res.json({ success: true, message: 'Subscription cancelled. Access continues until period end.' });
  } catch (err) { next(err); }
});

// ── POST /api/v1/billing/resume ───────────────────────────────────────────────

router.post('/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: req.user!.id },
    });
    if (!subscription) throw Errors.NotFound('Subscription');
    
    if (!subscription.canceled_at) {
      throw Errors.BadRequest('Subscription is not cancelled');
    }

    if (subscription.current_period_end < new Date()) {
      throw Errors.BadRequest('Subscription has already expired. Please purchase a new plan.');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        canceled_at: null,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    res.json({ success: true, message: 'Subscription resumed successfully.' });
  } catch (err) { next(err); }
});

export default router;
