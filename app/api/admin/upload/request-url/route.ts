export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import {
  generateImageUploadUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/objectStorage";

/**
 * POST /api/admin/upload/request-url
 *
 * Step 1 of the two-step image upload flow.
 * Returns a presigned GCS PUT URL and the final public URL.
 * The client uploads the file directly to the presigned URL (Step 2) —
 * file bytes never touch this server.
 *
 * Request body (JSON):
 * { name: string, contentType: string, size: number }
 *
 * Response:
 * { uploadUrl: string, publicUrl: string }
 *
 * Error codes:
 *   401  – not authenticated as admin
 *   400  – missing fields, unsupported type, or file too large
 *   500  – sidecar unavailable
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; contentType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, contentType, size } = body;

  if (!name || !contentType) {
    return NextResponse.json(
      { error: "name and contentType are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_IMAGE_TYPES[contentType]) {
    return NextResponse.json(
      { error: "Only JPG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  if (typeof size === "number" && size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB` },
      { status: 400 }
    );
  }

  try {
    const result = await generateImageUploadUrl(name, contentType);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload/request-url]", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Storage service error: ${msg}` },
      { status: 500 }
    );
  }
}
