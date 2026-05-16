import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service';
import { authenticate } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/validate.middleware';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

// ── POST /api/v1/auth/signup ─────────────────────────────────────────────────

router.post('/signup', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = signupSchema.parse(req.body);
    const result = await AuthService.signup(body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/login ──────────────────────────────────────────────────

router.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip;

    const result = await AuthService.login(body, deviceInfo, ipAddress);

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/v1/auth/refresh',
    });

    res.json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/refresh ────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept from cookie or Authorization header
    const token =
      req.cookies?.refresh_token ||
      req.headers['x-refresh-token'] as string;

    if (!token) {
      res.status(401).json({ success: false, message: 'No refresh token provided' });
      return;
    }

    const result = await AuthService.refresh(token, req.headers['user-agent'], req.ip);

    // Rotate cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    res.json({ success: true, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout ─────────────────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refresh_token || req.headers['x-refresh-token'] as string;
    if (token) await AuthService.logout(token);

    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout-all ─────────────────────────────────────────────

router.post('/logout-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AuthService.logoutAll(req.user!.id);
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/verify-email ───────────────────────────────────────────

router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await AuthService.verifyEmail(token);
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/forgot-password ────────────────────────────────────────

router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    await AuthService.forgotPassword(email);
    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/reset-password ─────────────────────────────────────────

router.post('/reset-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = resetSchema.parse(req.body);
    await AuthService.resetPassword(token, password);
    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await import('../../config/database').then(({ prisma }) =>
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true, email: true, full_name: true, avatar_url: true,
          role: true, is_email_verified: true, phone: true, country: true,
          timezone: true, last_login_at: true, created_at: true,
          subscription: {
            include: {
              plan: {
                select: {
                  name: true, slug: true, storage_limit_gb: true,
                  allow_video_uploads: true, allow_zip_download: true,
                  allow_watermark_removal: true, allow_custom_domain: true,
                  allow_analytics: true, allow_team_members: true,
                  support_level: true,
                },
              },
            },
          },
          storage_usage: true,
        },
      })
    );

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
