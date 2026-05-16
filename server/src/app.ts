import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import path from 'path';

import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';

// Route imports
import authRoutes from './routes/v1/auth.routes';
import userRoutes from './routes/v1/user.routes';
import projectRoutes from './routes/v1/project.routes';
import albumRoutes from './routes/v1/album.routes';
import mediaRoutes from './routes/v1/media.routes';
import galleryRoutes from './routes/v1/gallery.routes';
import shareLinkRoutes from './routes/v1/shareLink.routes';
import downloadRoutes from './routes/v1/download.routes';
import billingRoutes from './routes/v1/billing.routes';
import adminRoutes from './routes/v1/admin.routes';
import notificationRoutes from './routes/v1/notification.routes';

export function createApp(): Application {
  const app = express();

  // ── Trust proxy (for rate limiting behind nginx/load balancer) ──
  app.set('trust proxy', 1);

  // ── Security headers ─────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.NODE_ENV === 'production',
    })
  );

  // ── CORS ──────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: [env.FRONTEND_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
    })
  );

  // ── Compression ───────────────────────────────────────────────────
  app.use(compression());

  // ── Body parsing ─────────────────────────────────────────────────
  // Stripe webhook needs raw body — mount BEFORE json middleware
  app.use('/api/v1/billing/stripe/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ── HTTP request logger ───────────────────────────────────────────
  if (env.NODE_ENV !== ('test' as any)) {
    app.use(
      morgan('combined', {
        stream: { write: (message) => logger.http(message.trim()) },
        skip: (req) => req.url === '/health',
      })
    );
  }

  // ── Global rate limiter ───────────────────────────────────────────
  app.use(
    '/api/',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many requests, please try again later.',
      },
    })
  );

  // ── Health check ──────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      app: env.APP_NAME,
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // ── API v1 Routes ─────────────────────────────────────────────────
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/albums', albumRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/gallery', galleryRoutes);
  app.use('/api/v1/links', shareLinkRoutes);
  app.use('/api/v1/downloads', downloadRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/notifications', notificationRoutes);

  // ── 404 ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Global error handler (must be last) ──────────────────────────
  app.use(errorHandler);

  return app;
}
