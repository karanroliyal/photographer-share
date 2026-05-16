import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { env } from '../config/env';

// ── Custom App Error ─────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode = 500, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Common error factories ───────────────────────────────────────────────────

export const Errors = {
  BadRequest: (msg = 'Bad request', code?: string) => new AppError(msg, 400, code),
  Unauthorized: (msg = 'Unauthorized') => new AppError(msg, 401, 'UNAUTHORIZED'),
  Forbidden: (msg = 'Access denied') => new AppError(msg, 403, 'FORBIDDEN'),
  NotFound: (resource = 'Resource') => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  Conflict: (msg: string) => new AppError(msg, 409, 'CONFLICT'),
  TooManyRequests: (msg = 'Too many requests') => new AppError(msg, 429, 'RATE_LIMITED'),
  PaymentRequired: (msg = 'Upgrade your plan') => new AppError(msg, 402, 'PAYMENT_REQUIRED'),
  StorageExceeded: () => new AppError('Storage quota exceeded', 402, 'STORAGE_EXCEEDED'),
  PlanLimitExceeded: (resource: string) =>
    new AppError(`Plan limit reached for ${resource}. Please upgrade.`, 402, 'PLAN_LIMIT'),
  Internal: (msg = 'Internal server error') => new AppError(msg, 500, 'INTERNAL_ERROR', false),
};

// ── Global error handler middleware ─────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined = 'INTERNAL_ERROR';
  let errors: Record<string, string[]> | undefined;

  // ── Known AppError ───────────────────────────────────────────────
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  }

  // ── Zod validation error ─────────────────────────────────────────
  else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = err.flatten().fieldErrors as Record<string, string[]>;
  }

  // ── Prisma errors ────────────────────────────────────────────────
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'A record with this value already exists';
      code = 'DUPLICATE_ENTRY';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
      code = 'NOT_FOUND';
    } else {
      statusCode = 400;
      message = 'Database error';
      code = `PRISMA_${err.code}`;
    }
  }

  // ── JWT errors ───────────────────────────────────────────────────
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // ── Log all 5xx errors ───────────────────────────────────────────
  if (statusCode >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      userId: (req as any).user?.id,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
}
