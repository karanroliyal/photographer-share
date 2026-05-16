import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { EmailService } from '../services/email.service';
import { SubscriptionStatus } from '@prisma/client';

// ── Simple interval-based scheduler ──────────────────────────────────────────
// Uses setInterval instead of a heavy cron library to keep deps lean.
// All jobs are idempotent and safe to run multiple times.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let schedulerStarted = false;

// ── Job: Recalculate storage usage ────────────────────────────────────────────
// Runs every 30 minutes to ensure storage numbers are accurate.

async function recalculateStorageUsage(): Promise<void> {
  try {
    logger.debug('🔄 Running storage recalculation job...');

    // Find all users who have files
    const users = await prisma.storageUsage.findMany({
      select: { user_id: true },
    });

    let updated = 0;
    for (const { user_id } of users) {
      const agg = await prisma.mediaFile.aggregate({
        where: { photographer_id: user_id, is_deleted: false },
        _sum: { file_size: true },
        _count: { id: true },
      });

      const newUsed = agg._sum.file_size ?? BigInt(0);
      const count = agg._count.id;

      await prisma.storageUsage.update({
        where: { user_id },
        data: {
          storage_used: newUsed,
          total_files: count,
          last_calculated_at: new Date(),
        },
      });
      updated++;
    }

    logger.debug(`✅ Storage recalculated for ${updated} users`);
  } catch (error) {
    logger.error('Storage recalculation job failed:', error);
  }
}

// ── Job: Storage warning emails ────────────────────────────────────────────────
// Runs every 6 hours. Sends warning at 80% and 95% thresholds (once each).

async function checkStorageWarnings(): Promise<void> {
  try {
    logger.debug('🔄 Running storage warning check...');

    const usages = await prisma.storageUsage.findMany({
      where: {
        storage_limit: { gt: BigInt(0) }, // skip unlimited
      },
      include: {
        user: { select: { email: true, full_name: true } },
      },
    });

    for (const usage of usages) {
      const used = Number(usage.storage_used);
      const limit = Number(usage.storage_limit);
      if (limit === 0) continue;

      const percent = Math.round((used / limit) * 100);

      // Send warning at 80% or 95%
      if (percent >= 95 || percent >= 80) {
        // Check if we've already sent this warning recently (within 24h)
        // by checking a simple notification dedup
        const recentWarning = await prisma.notification.findFirst({
          where: {
            user_id: usage.user_id,
            type: 'STORAGE_WARNING',
            created_at: { gt: new Date(Date.now() - DAY) },
          },
        });
        if (recentWarning) continue;

        const userWithPrefs = await prisma.user.findUnique({
          where: { id: usage.user_id },
          select: { preferences: true }
        });
        const prefs = (userWithPrefs?.preferences as any) || {};
        if (prefs['Storage warnings'] === false) continue;

        await prisma.notification.create({
          data: {
            user_id: usage.user_id,
            type: 'STORAGE_WARNING',
            title: percent >= 95 ? '🔴 Storage critically full!' : '🟡 Storage 80% full',
            body: `You've used ${percent}% of your storage (${(used / 1073741824).toFixed(1)}GB / ${(limit / 1073741824).toFixed(0)}GB). Upgrade to avoid interruption.`,
          },
        });

        EmailService.sendStorageWarning(
          usage.user.email,
          usage.user.full_name,
          percent,
          used / 1073741824,
          limit / 1073741824
        ).catch(() => {});
      }
    }

    logger.debug('✅ Storage warning check complete');
  } catch (error) {
    logger.error('Storage warning job failed:', error);
  }
}

// ── Job: Subscription expiry warnings ─────────────────────────────────────────
// Runs every 12 hours. Sends email at 7 days and 1 day before expiry.

async function checkSubscriptionExpiry(): Promise<void> {
  try {
    logger.debug('🔄 Running subscription expiry check...');

    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * DAY);
    const in1day = new Date(now.getTime() + 1 * DAY);

    // Find subscriptions expiring in the next 7 days
    const expiring = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        canceled_at: null,
        current_period_end: { lte: in7days, gte: now },
      },
      include: {
        user: { select: { email: true, full_name: true } },
        plan: { select: { name: true } },
      },
    });

    for (const sub of expiring) {
      const daysLeft = Math.ceil(
        (sub.current_period_end.getTime() - now.getTime()) / DAY
      );

      // Only warn at 7-day and 1-day marks
      if (daysLeft !== 7 && daysLeft !== 1) continue;

      // Dedup: check if we sent a warning today for this user
      const recentWarning = await prisma.notification.findFirst({
        where: {
          user_id: sub.user_id,
          type: 'SUBSCRIPTION_EXPIRING',
          created_at: { gt: new Date(now.getTime() - DAY) },
        },
      });
      if (recentWarning) continue;

      await prisma.notification.create({
        data: {
          user_id: sub.user_id,
          type: 'SUBSCRIPTION_EXPIRING',
          title: `Your ${sub.plan.name} plan expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
          body: 'Renew now to avoid any interruption to your service.',
        },
      });

      EmailService.sendExpiryWarning(
        sub.user.email,
        sub.user.full_name,
        sub.plan.name,
        daysLeft,
        sub.current_period_end
      ).catch(() => {});
    }

    logger.debug('✅ Subscription expiry check complete');
  } catch (error) {
    logger.error('Subscription expiry job failed:', error);
  }
}

// ── Job: Mark expired subscriptions ──────────────────────────────────────────
// Runs every hour to move past-due subscriptions to EXPIRED status
// after their grace period.

async function expireSubscriptions(): Promise<void> {
  try {
    const now = new Date();

    // Find active/past-due subscriptions that have exceeded their grace period
    const expired = await prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        canceled_at: null,
        current_period_end: { lt: now },
      },
      include: {
        plan: { select: { grace_period_days: true } },
      },
    });

    for (const sub of expired) {
      const graceEnd = new Date(
        sub.current_period_end.getTime() + sub.plan.grace_period_days * DAY
      );

      if (now > graceEnd) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });

        await prisma.notification.create({
          data: {
            user_id: sub.user_id,
            type: 'SUBSCRIPTION_EXPIRED',
            title: 'Subscription expired',
            body: 'Your subscription has expired. Renew to restore full access.',
          },
        });

        logger.info(`⏰ Subscription ${sub.id} marked as expired (user ${sub.user_id})`);
      }
    }
  } catch (error) {
    logger.error('Expire subscriptions job failed:', error);
  }
}

// ── Job: Clean up old ZIP files ───────────────────────────────────────────────
// Runs daily. Marks old completed ZIP jobs as stale so storage can be reclaimed.

async function cleanupOldZipJobs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 7 * DAY); // 7 days old

    const result = await prisma.zipJob.updateMany({
      where: {
        status: 'COMPLETED',
        completed_at: { lt: cutoff },
        download_expires_at: { lt: new Date() },
      },
      data: {
        zip_storage_key: null,
      },
    });

    if (result.count > 0) {
      logger.info(`🗑️  Cleaned up ${result.count} old ZIP jobs`);
    }
  } catch (error) {
    logger.error('ZIP cleanup job failed:', error);
  }
}

// ── Job: Clean up soft-deleted media files ────────────────────────────────────
// Runs daily. Hard-deletes files that were soft-deleted more than 30 days ago.

async function cleanupDeletedMedia(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 30 * DAY);

    // Find soft-deleted files older than 30 days
    const deleted = await prisma.mediaFile.findMany({
      where: { is_deleted: true, deleted_at: { lt: cutoff } },
      select: { id: true, storage_key: true, photographer_id: true, file_size: true },
    });

    if (deleted.length === 0) return;

    await prisma.mediaFile.deleteMany({
      where: { id: { in: deleted.map(f => f.id) } },
    });

    logger.info(`🗑️  Hard-deleted ${deleted.length} media files after 30-day retention`);
  } catch (error) {
    logger.error('Delete media cleanup job failed:', error);
  }
}

// ── Start all scheduled jobs ──────────────────────────────────────────────────

export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info('⏰ Starting scheduled jobs...');

  // Immediate run on startup
  recalculateStorageUsage();
  checkSubscriptionExpiry();
  expireSubscriptions();

  // Recurring intervals
  setInterval(recalculateStorageUsage, 30 * MINUTE);
  setInterval(checkStorageWarnings, 6 * HOUR);
  setInterval(checkSubscriptionExpiry, 12 * HOUR);
  setInterval(expireSubscriptions, HOUR);
  setInterval(cleanupOldZipJobs, DAY);
  setInterval(cleanupDeletedMedia, DAY);

  logger.info('✅ Scheduled jobs registered: storage, subscription-expiry, cleanup');
}
