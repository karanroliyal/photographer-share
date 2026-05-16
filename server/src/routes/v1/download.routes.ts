import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middlewares/auth.middleware';
import { Errors } from '../../middlewares/errorHandler';
import { SelectionState, JobStatus } from '@prisma/client';
import { generateDownloadUrl } from '../../utils/storage';

const router = Router();
router.use(authenticate);

// ── POST /api/v1/downloads/zip  (queue a ZIP job) ─────────────────────────

router.post('/zip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      gallery_id: z.string().min(1),
      selection_state: z.nativeEnum(SelectionState).optional(),
      media_file_ids: z.array(z.string()).optional(),
    }).parse(req.body);

    const gallery = await prisma.clientGallery.findFirst({
      where: { id: body.gallery_id, photographer_id: req.user!.id },
    });
    if (!gallery) throw Errors.NotFound('Gallery');

    // Check plan allows ZIP
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: req.user!.id },
      include: { plan: { select: { allow_zip_download: true } } },
    });
    if (!subscription?.plan.allow_zip_download) throw Errors.PlanLimitExceeded('ZIP download');

    // Determine files to ZIP
    let mediaFileIds: string[] = body.media_file_ids ?? [];
    if (!mediaFileIds.length) {
      const selections = await prisma.gallerySelection.findMany({
        where: {
          gallery_id: body.gallery_id,
          ...(body.selection_state
            ? { state: body.selection_state }
            : { state: { in: [SelectionState.SELECTED, SelectionState.FAVORITE] } }),
        },
        select: { media_file_id: true },
      });
      mediaFileIds = selections.map((s) => s.media_file_id);
    }

    if (!mediaFileIds.length) throw Errors.BadRequest('No files selected for download');

    const zipJob = await prisma.zipJob.create({
      data: {
        user_id: req.user!.id,
        gallery_id: body.gallery_id,
        media_file_ids: mediaFileIds,
        selection_state: body.selection_state,
        status: JobStatus.PENDING,
      },
    });

    // Add to BullMQ queue
    try {
      const { zipQueue } = await import('../../queues');
      const bullJob = await zipQueue.add('generate-zip', {
        zipJobId: zipJob.id,
        galleryId: body.gallery_id,
        photographerId: req.user!.id,
        mediaFileIds,
      });

      await prisma.zipJob.update({
        where: { id: zipJob.id },
        data: { bullmq_job_id: String(bullJob.id) },
      });
    } catch (err) {
      // If BullMQ fails or Redis is not connected, process immediately in the background
      const { processZipJob } = await import('../../workers/zip.worker');
      processZipJob(zipJob.id).catch(console.error);
    }

    res.status(202).json({
      success: true,
      message: 'ZIP generation started',
      data: { zip_job_id: zipJob.id },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/downloads/zip/:jobId  (check status) ─────────────────────

router.get('/zip/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.zipJob.findFirst({
      where: { id: req.params.jobId, user_id: req.user!.id },
    });
    if (!job) throw Errors.NotFound('ZIP job');

    res.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        progress_percent: job.progress_percent,
        error_message: job.error_message,
        zip_size: job.zip_size ? Number(job.zip_size) : null,
        started_at: job.started_at,
        completed_at: job.completed_at,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/downloads/zip/:jobId/url  (get download URL) ──────────────

router.get('/zip/:jobId/url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.zipJob.findFirst({
      where: { id: req.params.jobId, user_id: req.user!.id },
      include: { gallery: true },
    });
    if (!job) throw Errors.NotFound('ZIP job');
    if (job.status !== JobStatus.COMPLETED) throw Errors.BadRequest('ZIP not ready yet');
    if (!job.zip_storage_key) throw Errors.Internal('ZIP key missing');

    // Check expiry
    if (job.download_expires_at && job.download_expires_at < new Date()) {
      throw Errors.Forbidden('Download link has expired. Please generate a new ZIP.');
    }

    const filename = job.gallery.client_name 
      ? `${job.gallery.client_name.replace(/[^a-zA-Z0-9]/g, '_')}_Photos.zip`
      : 'Client_Photos.zip';

    const downloadUrl = await generateDownloadUrl(job.zip_storage_key, 1800, filename); // 30min
    res.json({ success: true, data: { download_url: downloadUrl, expires_in: 1800 } });
  } catch (err) { next(err); }
});

export default router;
