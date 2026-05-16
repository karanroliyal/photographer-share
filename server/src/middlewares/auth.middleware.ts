import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { Errors, AppError } from './errorHandler';
import { Role } from '@prisma/client';

export interface AuthPayload {
  sub: string;       // user id
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

// ── Verify JWT ───────────────────────────────────────────────────────────────

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw Errors.Unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, is_active: true, is_suspended: true },
    });

    if (!user || !user.is_active) throw Errors.Unauthorized('Account not found or inactive');
    if (user.is_suspended) throw Errors.Forbidden('Account suspended');

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// ── Optional auth (for public gallery endpoints) ─────────────────────────────

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
    }
    next();
  } catch {
    // Token invalid — just continue without user
    next();
  }
}

// ── Role guards ──────────────────────────────────────────────────────────────

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Errors.Unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(Errors.Forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

export const requireAdmin = requireRole(Role.ADMIN);
export const requirePhotographer = requireRole(Role.PHOTOGRAPHER, Role.ADMIN);

// ── Subscription feature guard ───────────────────────────────────────────────
// Usage: router.post('/videos', authenticate, requireFeature('allow_video_uploads'), ...)

export function requireFeature(feature: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(Errors.Unauthorized());

      const subscription = await prisma.subscription.findUnique({
        where: { user_id: req.user.id },
        include: { plan: true },
      });

      if (!subscription || subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
        return next(Errors.PaymentRequired('No active subscription'));
      }

      const plan = subscription.plan as Record<string, unknown>;
      if (!plan[feature]) {
        return next(Errors.PlanLimitExceeded(feature));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
