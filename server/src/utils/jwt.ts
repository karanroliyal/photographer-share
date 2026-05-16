import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../config/database';

// ── Generate access token (short-lived) ─────────────────────────────────────

export function generateAccessToken(payload: {
  sub: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

// ── Generate refresh token (long-lived) ─────────────────────────────────────

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Save refresh token to DB ─────────────────────────────────────────────────

export async function saveRefreshToken(
  userId: string,
  token: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: tokenHash,
      device_info: deviceInfo,
      ip_address: ipAddress,
      expires_at: expiresAt,
    },
  });
}

// ── Rotate refresh token ─────────────────────────────────────────────────────

export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<string> {
  const oldHash = hashToken(oldToken);

  // Revoke old token
  await prisma.refreshToken.updateMany({
    where: { token_hash: oldHash, user_id: userId },
    data: { is_revoked: true },
  });

  // Create new token
  const newToken = generateRefreshToken();
  await saveRefreshToken(userId, newToken, deviceInfo, ipAddress);
  return newToken;
}

// ── Verify refresh token ─────────────────────────────────────────────────────

export async function verifyRefreshToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!storedToken) return null;
  if (storedToken.is_revoked) return null;
  if (storedToken.expires_at < new Date()) return null;

  return storedToken.user_id;
}

// ── Revoke all tokens for user (logout all devices) ─────────────────────────

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId },
    data: { is_revoked: true },
  });
}

// ── Generate a secure random token (for email verify, password reset, gallery) ──

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
