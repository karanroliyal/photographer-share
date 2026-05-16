import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ── Transport (lazy initialized) ──────────────────────────────────────────────

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.warn('⚠️  SMTP not configured — emails will be logged only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

// ── Base HTML template ─────────────────────────────────────────────────────────

function baseTemplate(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PhotoSelect</title>
  <style>
    body { margin:0; padding:0; background:#0a0a0f; font-family:'Helvetica Neue',Arial,sans-serif; color:#f0f0ff; }
    .preheader { display:none; max-height:0; overflow:hidden; }
    .wrapper { max-width:580px; margin:0 auto; padding:40px 20px; }
    .logo-box { text-align:center; margin-bottom:32px; }
    .logo-icon { display:inline-block; width:48px; height:48px; background:linear-gradient(135deg,#6c63ff,#8b5cf6); border-radius:14px; line-height:48px; text-align:center; font-size:22px; }
    .logo-text { display:block; margin-top:10px; font-size:20px; font-weight:700; color:#f0f0ff; }
    .logo-text span { color:#a78bfa; }
    .card { background:#13131f; border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:40px; margin-bottom:24px; }
    h1 { font-size:24px; font-weight:700; margin:0 0 12px; color:#f0f0ff; }
    p { font-size:15px; line-height:1.7; color:#8b8ba7; margin:0 0 16px; }
    .btn { display:inline-block; background:linear-gradient(135deg,#6c63ff,#8b5cf6); color:#fff !important; text-decoration:none; font-weight:600; font-size:15px; padding:14px 32px; border-radius:12px; margin:8px 0 20px; }
    .btn:hover { background:linear-gradient(135deg,#7c73ff,#9b6cf6); }
    .divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:24px 0; }
    .small { font-size:13px; color:#4a4a6a; }
    .footer { text-align:center; padding-top:16px; }
    .footer p { font-size:12px; color:#4a4a6a; }
    .highlight { color:#a78bfa; font-weight:600; }
    .badge { display:inline-block; background:rgba(108,99,255,0.15); color:#a78bfa; border:1px solid rgba(108,99,255,0.25); border-radius:100px; padding:4px 14px; font-size:12px; font-weight:600; }
    .stat-row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:14px; }
    .stat-row:last-child { border-bottom:none; }
    .stat-label { color:#8b8ba7; }
    .stat-value { color:#f0f0ff; font-weight:600; }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="wrapper">
    <div class="logo-box">
      <div class="logo-icon">📷</div>
      <span class="logo-text">Photo<span>Select</span></span>
    </div>
    ${content}
    <div class="footer">
      <p>© ${new Date().getFullYear()} PhotoSelect. All rights reserved.</p>
      <p>You're receiving this because you have an account on PhotoSelect.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send helper ───────────────────────────────────────────────────────────────

async function send(opts: EmailOptions): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    // Dev mode — log to console
    logger.info(`📧  [EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
    return;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      ...opts,
    });
    logger.info(`📧  Email sent to ${opts.to}: ${opts.subject}`);
  } catch (error) {
    logger.error(`❌  Email failed to ${opts.to}:`, error);
    // Don't throw — email failures should not break the main flow
  }
}

// ── Public email methods ──────────────────────────────────────────────────────

export const EmailService = {

  // ── Verify email ────────────────────────────────────────────────────────────
  async sendVerification(email: string, token: string, name: string): Promise<void> {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    await send({
      to: email,
      subject: 'Verify your PhotoSelect email address',
      html: baseTemplate(
        `<div class="card">
          <h1>Welcome to PhotoSelect, ${name}! 🎉</h1>
          <p>Thanks for signing up. Please verify your email address to get started.</p>
          <div style="text-align:center;">
            <a href="${verifyUrl}" class="btn">Verify Email Address</a>
          </div>
          <hr class="divider" />
          <p class="small">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
          <p class="small">Or copy this URL: <span class="highlight">${verifyUrl}</span></p>
        </div>`,
        'Please verify your email to activate your PhotoSelect account'
      ),
    });
  },

  // ── Password reset ───────────────────────────────────────────────────────────
  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    await send({
      to: email,
      subject: 'Reset your PhotoSelect password',
      html: baseTemplate(
        `<div class="card">
          <h1>Password Reset Request 🔐</h1>
          <p>We received a request to reset the password for your PhotoSelect account.</p>
          <div style="text-align:center;">
            <a href="${resetUrl}" class="btn">Reset Password</a>
          </div>
          <hr class="divider" />
          <p class="small">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </div>`,
        'Reset your PhotoSelect password'
      ),
    });
  },

  // ── Gallery shared ───────────────────────────────────────────────────────────
  async sendGalleryShared(
    clientEmail: string,
    clientName: string,
    photographerName: string,
    projectName: string,
    galleryToken: string,
    appUrl: string
  ): Promise<void> {
    const galleryUrl = `${appUrl}/gallery/${galleryToken}`;
    await send({
      to: clientEmail,
      subject: `${photographerName} shared your gallery: ${projectName}`,
      html: baseTemplate(
        `<div class="card">
          <h1>Your gallery is ready! 📸</h1>
          <p>Hi ${clientName || 'there'},</p>
          <p><span class="highlight">${photographerName}</span> has shared your photo gallery <strong>${projectName}</strong> with you. Browse your photos and select your favourites!</p>
          <div style="text-align:center;">
            <a href="${galleryUrl}" class="btn">View My Gallery</a>
          </div>
          <hr class="divider" />
          <p class="small">No login required. Just click the button above to view your gallery.</p>
        </div>`,
        `${photographerName} shared your photo gallery with you`
      ),
    });
  },

  // ── Selections submitted ─────────────────────────────────────────────────────
  async sendSelectionsSubmitted(
    photographerEmail: string,
    photographerName: string,
    clientName: string,
    projectName: string,
    selectedCount: number
  ): Promise<void> {
    await send({
      to: photographerEmail,
      subject: `${clientName} submitted photo selections for ${projectName}`,
      html: baseTemplate(
        `<div class="card">
          <h1>Selection Submitted! ✅</h1>
          <p>Great news! <span class="highlight">${clientName}</span> has submitted their photo selections for <strong>${projectName}</strong>.</p>
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px 20px;margin:20px 0;">
            <div class="stat-row"><span class="stat-label">Project</span><span class="stat-value">${projectName}</span></div>
            <div class="stat-row"><span class="stat-label">Client</span><span class="stat-value">${clientName}</span></div>
            <div class="stat-row"><span class="stat-label">Photos Selected</span><span class="stat-value" style="color:#22c55e;">${selectedCount}</span></div>
          </div>
          <p>Log in to your PhotoSelect dashboard to view their selections and download.</p>
        </div>`,
        `${clientName} submitted their photo selections for ${projectName}`
      ),
    });
  },

  // ── Payment success ──────────────────────────────────────────────────────────
  async sendPaymentSuccess(
    email: string,
    name: string,
    planName: string,
    amount: number,
    currency: string,
    invoiceNumber: string
  ): Promise<void> {
    const displayAmount = currency === 'INR'
      ? `₹${(amount / 100).toLocaleString('en-IN')}`
      : `$${(amount / 100).toLocaleString()}`;

    await send({
      to: email,
      subject: `Payment confirmed — ${planName} Plan activated`,
      html: baseTemplate(
        `<div class="card">
          <h1>Payment Successful! 🎉</h1>
          <p>Hi ${name}, your payment was processed successfully.</p>
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px 20px;margin:20px 0;">
            <div class="stat-row"><span class="stat-label">Plan</span><span class="stat-value">${planName}</span></div>
            <div class="stat-row"><span class="stat-label">Amount</span><span class="stat-value" style="color:#22c55e;">${displayAmount}</span></div>
            <div class="stat-row"><span class="stat-label">Invoice</span><span class="stat-value">${invoiceNumber}</span></div>
          </div>
          <p>Your <span class="highlight">${planName}</span> plan is now active. Enjoy all the features!</p>
        </div>`,
        `Your ${planName} plan payment was confirmed`
      ),
    });
  },

  // ── Payment failed ───────────────────────────────────────────────────────────
  async sendPaymentFailed(
    email: string,
    name: string,
    planName: string,
    gracePeriodDays: number
  ): Promise<void> {
    await send({
      to: email,
      subject: 'Action required: Payment failed for your PhotoSelect subscription',
      html: baseTemplate(
        `<div class="card">
          <h1>Payment Failed ⚠️</h1>
          <p>Hi ${name}, we were unable to process your payment for the <strong>${planName}</strong> plan.</p>
          <p>You have a <strong>${gracePeriodDays}-day grace period</strong> to update your payment method before your account is restricted.</p>
          <div style="text-align:center;">
            <a href="${env.FRONTEND_URL}/billing" class="btn">Update Payment Method</a>
          </div>
          <hr class="divider" />
          <p class="small">If you continue to have issues, please contact our support team.</p>
        </div>`,
        'Action required: Update your payment method'
      ),
    });
  },

  // ── Storage warning ──────────────────────────────────────────────────────────
  async sendStorageWarning(
    email: string,
    name: string,
    percentUsed: number,
    usedGb: number,
    limitGb: number
  ): Promise<void> {
    const isCritical = percentUsed >= 95;
    await send({
      to: email,
      subject: isCritical
        ? '🔴 Critical: Storage almost full on PhotoSelect'
        : '🟡 Warning: Storage 80% full on PhotoSelect',
      html: baseTemplate(
        `<div class="card">
          <h1>${isCritical ? '🔴 Storage Almost Full!' : '🟡 Storage Warning'}</h1>
          <p>Hi ${name}, your PhotoSelect storage is at <span class="highlight">${percentUsed}%</span> capacity.</p>
          <div style="background:${isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'};border:1px solid ${isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'};border-radius:12px;padding:16px 20px;margin:20px 0;">
            <div class="stat-row"><span class="stat-label">Used</span><span class="stat-value">${usedGb.toFixed(1)} GB</span></div>
            <div class="stat-row"><span class="stat-label">Limit</span><span class="stat-value">${limitGb} GB</span></div>
            <div class="stat-row"><span class="stat-label">Usage</span><span class="stat-value" style="color:${isCritical ? '#ef4444' : '#f59e0b'};">${percentUsed}%</span></div>
          </div>
          <p>${isCritical
            ? 'Upgrade your plan now to continue uploading photos without interruption.'
            : 'Consider upgrading your plan or deleting unused files to avoid running out of space.'
          }</p>
          <div style="text-align:center;">
            <a href="${env.FRONTEND_URL}/billing" class="btn">Upgrade Plan</a>
          </div>
        </div>`,
        `Your PhotoSelect storage is ${percentUsed}% full`
      ),
    });
  },

  // ── Subscription expiry warning ──────────────────────────────────────────────
  async sendExpiryWarning(
    email: string,
    name: string,
    planName: string,
    daysUntilExpiry: number,
    expiryDate: Date
  ): Promise<void> {
    await send({
      to: email,
      subject: `Your ${planName} plan expires in ${daysUntilExpiry} days`,
      html: baseTemplate(
        `<div class="card">
          <h1>Subscription Expiring Soon ⏰</h1>
          <p>Hi ${name}, your <strong>${planName}</strong> plan will expire on <span class="highlight">${expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>.</p>
          <p>Renew now to avoid any interruption to your photo delivery service.</p>
          <div style="text-align:center;">
            <a href="${env.FRONTEND_URL}/billing" class="btn">Renew Subscription</a>
          </div>
        </div>`,
        `Your ${planName} plan expires in ${daysUntilExpiry} days`
      ),
    });
  },

};
