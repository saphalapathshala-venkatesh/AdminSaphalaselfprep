/**
 * Bunny Stream playback source helper.
 *
 * Centralises all Bunny URL construction.
 * Token-auth mode can be layered on here once a signing key is available.
 *
 * Env vars (optional — allows graceful degradation to manually-stored URLs):
 *   BUNNY_LIBRARY_ID   — numeric Bunny Stream library ID
 *   BUNNY_CDN_HOSTNAME — pull-zone CDN hostname, e.g. vz-abc123.b-cdn.net
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
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME?.trim();

  if (video.provider === "BUNNY" && video.providerVideoId) {
    const guid = video.providerVideoId.trim();

    const manifestUrl = cdnHostname
      ? `https://${cdnHostname}/${guid}/playlist.m3u8`
      : (video.hlsUrl ?? video.playbackUrl ?? null);

    if (!manifestUrl) return null;

    const embedUrl = libraryId
      ? `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=false&responsive=true`
      : manifestUrl;

    const posterUrl = cdnHostname
      ? `https://${cdnHostname}/${guid}/thumbnail.jpg`
      : (video.thumbnailUrl ?? null);

    return {
      manifestUrl,
      embedUrl,
      posterUrl,
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
