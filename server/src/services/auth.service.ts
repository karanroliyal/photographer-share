import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { Errors } from '../middlewares/errorHandler';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  hashToken,
  rotateRefreshToken,
  saveRefreshToken,
  verifyRefreshToken,
  revokeAllUserTokens,
} from '../utils/jwt';
import { Role, SubscriptionStatus, PlanInterval } from '@prisma/client';
import { EmailService } from './email.service';

// ── Auth Service ─────────────────────────────────────────────────────────────

export const AuthService = {

  // ── Signup ───────────────────────────────────────────────────────────────

  async signup(data: {
    email: string;
    password: string;
    full_name: string;
  }): Promise<{ user: object; message: string }> {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw Errors.Conflict('An account with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verifyToken = generateSecureToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Get free plan
    const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } });
    if (!freePlan) throw Errors.Internal('Free plan not configured');

    // Create user + subscription + storage in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          password_hash: passwordHash,
          full_name: data.full_name,
          role: Role.PHOTOGRAPHER,
          email_verify_token: hashToken(verifyToken),
          email_verify_expires: verifyExpires,
        },
        select: { id: true, email: true, full_name: true, role: true },
      });

      // Auto-assign free plan
      const now = new Date();
      await tx.subscription.create({
        data: {
          user_id: newUser.id,
          plan_id: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
          interval: PlanInterval.MONTHLY,
          current_period_start: now,
          current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Initialize storage quota from plan
      const storageLimitBytes = BigInt(Math.round(freePlan.storage_limit_gb * 1024 * 1024 * 1024));
      await tx.storageUsage.create({
        data: {
          user_id: newUser.id,
          storage_limit: storageLimitBytes,
        },
      });

      return newUser;
    });

    // Send verification email (non-blocking)
    EmailService.sendVerification(user.email, verifyToken, data.full_name).catch(() => {});

    return {
      user,
      message: 'Account created. Please check your email to verify your account.',
    };
  },

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(
    data: { email: string; password: string },
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true, email: true, password_hash: true, role: true,
        is_active: true, is_suspended: true, is_email_verified: true,
        full_name: true, avatar_url: true,
      },
    });

    if (!user) throw Errors.Unauthorized('Invalid email or password');
    if (!user.is_active) throw Errors.Forbidden('Account deactivated');
    if (user.is_suspended) throw Errors.Forbidden('Account suspended. Contact support.');

    const passwordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!passwordValid) throw Errors.Unauthorized('Invalid email or password');

    // Tokens
    const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken, deviceInfo, ipAddress);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const { password_hash: _, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  },

  // ── Refresh token ─────────────────────────────────────────────────────────

  async refresh(
    token: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = await verifyRefreshToken(token);
    if (!userId) throw Errors.Unauthorized('Invalid or expired refresh token');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, is_active: true },
    });
    if (!user || !user.is_active) throw Errors.Unauthorized('Account not active');

    // Rotate refresh token
    const newRefreshToken = await rotateRefreshToken(token, userId, deviceInfo, ipAddress);
    const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });

    return { accessToken, refreshToken: newRefreshToken };
  },

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash },
      data: { is_revoked: true },
    });
  },

  async logoutAll(userId: string): Promise<void> {
    await revokeAllUserTokens(userId);
  },

  // ── Email verification ────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        email_verify_token: tokenHash,
        email_verify_expires: { gt: new Date() },
      },
    });
    if (!user) throw Errors.BadRequest('Invalid or expired verification link');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        is_email_verified: true,
        email_verify_token: null,
        email_verify_expires: null,
      },
    });
  },

  // ── Forgot password ───────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return;

    const resetToken = generateSecureToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token: hashToken(resetToken),
        reset_token_expires: resetExpires,
      },
    });

    // Send reset email (non-blocking)
    EmailService.sendPasswordReset(user.email, resetToken).catch(() => {});
  },

  // ── Reset password ────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        reset_token: tokenHash,
        reset_token_expires: { gt: new Date() },
      },
    });
    if (!user) throw Errors.BadRequest('Invalid or expired reset link');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
      },
    });

    // Revoke all sessions after password reset
    await revokeAllUserTokens(user.id);
  },
};
