export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getBunnyPlaybackSource } from "@/lib/bunny/getPlaybackSource";

/**
 * GET /api/videos/[id]/playback
 *
 * Returns a signed/resolved playback source for a video.
 * Protected: requires valid admin session.
 *
 * Response: { videoId, manifestUrl, embedUrl, posterUrl, expiresAt }
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      provider: true,
      providerVideoId: true,
      hlsUrl: true,
      playbackUrl: true,
      thumbnailUrl: true,
      accessType: true,
      allowPreview: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const playableStatuses = ["PUBLISHED", "READY"];
  if (!playableStatuses.includes(video.status)) {
    return NextResponse.json(
      { error: "Video is not yet available for playback" },
      { status: 403 }
    );
  }

  const source = getBunnyPlaybackSource(video);
  if (!source) {
    return NextResponse.json(
      { error: "Playback source is not configured for this video" },
      { status: 422 }
    );
  }

  return NextResponse.json({
    videoId: video.id,
    manifestUrl: source.manifestUrl,
    embedUrl: source.embedUrl,
    posterUrl: source.posterUrl,
    expiresAt: source.expiresAt,
  });
}
