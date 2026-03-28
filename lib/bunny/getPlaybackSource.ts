/**
 * Bunny Stream playback source helper.
 *
 * Centralises all Bunny URL construction.
 * Token-auth mode can be layered on here once a signing key is available.
 *
 * Env vars:
 *   BUNNY_LIBRARY_ID — numeric Bunny Stream library ID (required for Bunny videos)
 */

export type PlaybackSource = {
  manifestUrl: string;
  embedUrl: string;
  posterUrl: string | null;
  expiresAt: string | null;
};

type VideoRecord = {
  provider: string;
  providerVideoId: string | null;
  hlsUrl: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
};

export function getBunnyPlaybackSource(video: VideoRecord): PlaybackSource | null {
  const libraryId = process.env.BUNNY_LIBRARY_ID?.trim();

  if (video.provider === "BUNNY" && video.providerVideoId) {
    const guid = video.providerVideoId.trim();

    if (!libraryId) return null;

    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=false&responsive=true`;

    return {
      manifestUrl: embedUrl,
      embedUrl,
      posterUrl: video.thumbnailUrl ?? null,
      expiresAt: null,
    };
  }

  if (video.provider === "YOUTUBE" && video.providerVideoId) {
    const ytId = video.providerVideoId.trim();
    return {
      manifestUrl: `https://www.youtube.com/watch?v=${ytId}`,
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      posterUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      expiresAt: null,
    };
  }

  if (video.hlsUrl || video.playbackUrl) {
    return {
      manifestUrl: (video.hlsUrl ?? video.playbackUrl)!,
      embedUrl: (video.hlsUrl ?? video.playbackUrl)!,
      posterUrl: video.thumbnailUrl ?? null,
      expiresAt: null,
    };
  }

  return null;
}
