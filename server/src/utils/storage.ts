import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

// ── R2 S3 Client ──────────────────────────────────────────────────────────────

let endpointUrl = 'http://localhost:9000'; // Safe fallback
if (env.R2_ENDPOINT) {
  try {
    const sanitizedUrl = env.R2_ENDPOINT.replace('<accountid>', '00000000000000000000000000000000');
    new URL(sanitizedUrl); // Validate
    endpointUrl = sanitizedUrl;
  } catch (e) {
    console.warn('⚠️ Invalid R2_ENDPOINT. Using fallback.');
  }
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: endpointUrl,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID || 'dummy-access-key',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || 'dummy-secret-key',
  },
});

// ── Storage key helpers ───────────────────────────────────────────────────────

export function buildStorageKey(
  photographerId: string,
  projectId: string,
  type: 'original' | 'thumbnails/small' | 'thumbnails/medium' | 'thumbnails/large' | 'videos' | 'videos/previews' | 'temp',
  filename: string
): string {
  return `photographers/${photographerId}/projects/${projectId}/${type}/${filename}`;
}

export function buildZipKey(photographerId: string, jobId: string): string {
  return `photographers/${photographerId}/temp/zips/${jobId}.zip`;
}

// ── Signed URLs ───────────────────────────────────────────────────────────────

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
  return Boolean(env.R2_ENDPOINT && !env.R2_ENDPOINT.includes('<accountid>'));
}

/**
 * Generate a presigned PUT URL for direct browser → R2 uploads.
 * Fallback to local server storage if R2 is not configured.
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600 // 1 hour
): Promise<string> {
  if (!isR2Configured()) {
    return `${env.APP_URL}/api/v1/media/local/${encodeURIComponent(key)}`;
  }
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned GET URL for secure media access.
 * Fallback to local server storage if R2 is not configured.
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn = 3600,
  filename?: string
): Promise<string> {
  if (!isR2Configured()) {
    let url = `${env.APP_URL}/api/v1/media/local/${encodeURIComponent(key)}`;
    if (filename) url += `?filename=${encodeURIComponent(filename)}`;
    return url;
  }
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Get the CDN public URL for a processed thumbnail/preview.
 * Fallback to local server storage if R2 is not configured.
 */
export function getPublicUrl(key: string): string {
  if (!isR2Configured()) {
    return `${env.APP_URL}/api/v1/media/local/${encodeURIComponent(key)}`;
  }
  return `${env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(key: string): Promise<void> {
  if (!isR2Configured()) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(process.cwd(), 'uploads', key);
      await fs.unlink(fullPath);
    } catch (e) {
      // ignore if file doesn't exist locally
    }
    return;
  }
  const command = new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });
  await r2Client.send(command);
}
