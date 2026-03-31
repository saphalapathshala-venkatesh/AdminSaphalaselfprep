/**
 * Replit App Storage — thin wrapper for image and PDF uploads.
 *
 * Uses the Replit sidecar at 127.0.0.1:1106 to generate GCS presigned PUT URLs.
 * Files are stored in the public prefix so they are world-readable via the
 * standard GCS public URL (no auth required to view).
 *
 * Public URL pattern:
 *   https://storage.googleapis.com/<bucket>/public/images/admin/<uuid>.<ext>
 *   https://storage.googleapis.com/<bucket>/public/pdfs/admin/<uuid>.pdf
 *
 * Two-step upload flow (all file bytes bypass our server):
 *   1. API route calls generate*UploadUrl → presigned PUT URL + final public URL
 *   2. Client PUT the file bytes directly to the presigned URL
 *   3. Client saves the publicUrl into the DB field
 */

import { randomUUID } from "crypto";

const SIDECAR = "http://127.0.0.1:1106";
const PUBLIC_IMAGE_PREFIX = "public/images/admin";
const PUBLIC_PDF_PREFIX = "public/pdfs/admin";

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function getBucket(): string {
  const b = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!b) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set. Check App Storage setup.");
  return b;
}

export interface ImageUploadUrls {
  /** Client must HTTP PUT the raw file bytes to this URL. TTL: 15 min. */
  uploadUrl: string;
  /** Final public URL to store in the DB after the PUT succeeds. */
  publicUrl: string;
}

/**
 * Generates a presigned PUT URL for an admin image upload.
 * Server-side only — requires the Replit sidecar to be available.
 *
 * @param originalName  Original filename (used only for extension)
 * @param contentType   MIME type — must be in ALLOWED_IMAGE_TYPES
 */
export async function generateImageUploadUrl(
  originalName: string,
  contentType: string
): Promise<ImageUploadUrls> {
  const bucket = getBucket();
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const objectName = `${PUBLIC_IMAGE_PREFIX}/${randomUUID()}.${ext}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method: "PUT",
      expires_at: expiresAt,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sidecar presign failed (${res.status}): ${body}`);
  }

  const { signed_url } = await res.json();
  const publicUrl = `https://storage.googleapis.com/${bucket}/${objectName}`;

  return { uploadUrl: signed_url, publicUrl };
}

/**
 * Uploads a base64-encoded image directly from the server to object storage.
 * Used during DOCX import commit to convert embedded base64 images to CDN URLs.
 * Generates a presigned URL then immediately PUTs the image bytes from the server.
 *
 * @param base64       Raw base64 string (no data URI prefix)
 * @param contentType  MIME type (e.g. "image/png")
 * @returns            Final public CDN URL for the uploaded image
 */
export async function uploadBase64ImageToStorage(
  base64: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();
  const ext = ALLOWED_IMAGE_TYPES[contentType] ?? "png";
  const objectName = `${PUBLIC_IMAGE_PREFIX}/${randomUUID()}.${ext}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method: "PUT",
      expires_at: expiresAt,
    }),
  });

  if (!signRes.ok) {
    const body = await signRes.text().catch(() => "");
    throw new Error(`Sidecar presign failed (${signRes.status}): ${body}`);
  }

  const { signed_url } = await signRes.json();
  const imageBuffer = Buffer.from(base64, "base64");

  const putRes = await fetch(signed_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: imageBuffer,
  });

  if (!putRes.ok) {
    throw new Error(`Image PUT to storage failed (${putRes.status})`);
  }

  return `https://storage.googleapis.com/${bucket}/${objectName}`;
}

export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Generates a presigned PUT URL for an admin PDF upload.
 * Server-side only — requires the Replit sidecar to be available.
 */
export async function generatePdfUploadUrl(): Promise<ImageUploadUrls> {
  const bucket = getBucket();
  const objectName = `${PUBLIC_PDF_PREFIX}/${randomUUID()}.pdf`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method: "PUT",
      expires_at: expiresAt,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sidecar presign failed (${res.status}): ${body}`);
  }

  const { signed_url } = await res.json();
  const publicUrl = `https://storage.googleapis.com/${bucket}/${objectName}`;

  return { uploadUrl: signed_url, publicUrl };
}
