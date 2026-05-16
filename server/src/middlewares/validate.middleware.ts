import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

// ── Strict rate limiter for auth endpoints ───────────────────────────────────
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMITED',
  },
  keyGenerator: (req: Request) =>
    req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'unknown',
});

// ── Upload rate limiter ───────────────────────────────────────────────────────
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 upload requests/min
  message: {
    success: false,
    message: 'Upload rate limit exceeded. Please slow down.',
    code: 'UPLOAD_RATE_LIMITED',
  },
});

// ── Validate request body ────────────────────────────────────────────────────
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// ── Validate query params ────────────────────────────────────────────────────
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(422).json({
        success: false,
        message: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}
