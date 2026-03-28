"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type PlaybackData = {
  videoId: string;
  manifestUrl: string;
  embedUrl: string;
  posterUrl: string | null;
  expiresAt: string | null;
};

type XpResult = { attemptCount: number; xpAwarded: number };

type Props = {
  videoId: string;
  title?: string;
  /**
   * Set true in student-facing contexts to enable XP tracking.
   * Defaults to false so admin previews never trigger XP awards.
   */
  enableXp?: boolean;
  /** Called after a successful completion API response (fires at most once per mount). */
  onXpAwarded?: (result: XpResult) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely parse a postMessage payload that might be a JSON string. */
function tryParse(data: unknown): Record<string, unknown> | null {
  if (typeof data === "object" && data !== null) return data as Record<string, unknown>;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CourseVideoPlayer({ videoId, title, enableXp = false, onXpAwarded }: Props) {
  const [data, setData] = useState<PlaybackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // XP toast state
  const [xpBanner, setXpBanner] = useState<XpResult | null>(null);

  // Ref guard: fires at most once per component mount/videoId change
  const completionFired = useRef(false);

  // -------------------------------------------------------------------------
  // Fetch playback source
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    setData(null);
    setXpBanner(null);
    completionFired.current = false; // reset when video changes

    fetch(`/api/videos/${videoId}/playback`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("You do not have access to this video.");
          } else if (res.status === 404) {
            setError("Video not found.");
          } else if (res.status === 422) {
            setError("Playback is not configured for this video yet.");
          } else {
            setError(json.error ?? "Failed to load video.");
          }
          return;
        }
        setData(json);
      })
      .catch(() => setError("Could not reach server. Please try again."))
      .finally(() => setLoading(false));
  }, [videoId]);

  // -------------------------------------------------------------------------
  // Completion handler (called by both video.onEnded and postMessage listener)
  // -------------------------------------------------------------------------
  const recordCompletion = useCallback(async () => {
    if (!enableXp) return;
    if (completionFired.current) return; // deduplicate per mount
    completionFired.current = true;

    try {
      const res = await fetch("/api/video/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });

      if (!res.ok) {
        // In admin-preview context there is no student session → 401 is expected.
        // Silently ignore so the UI isn't disrupted.
        return;
      }

      const result: XpResult = await res.json();
      setXpBanner(result);
      setTimeout(() => setXpBanner(null), 5000); // hide after 5 s
      onXpAwarded?.(result);
    } catch {
      // Network error — don't block the UX, just swallow
    }
  }, [enableXp, videoId, onXpAwarded]);

  // -------------------------------------------------------------------------
  // postMessage listener for iframe players (Bunny CDN / YouTube)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!enableXp || !data) return;

    function handleMessage(e: MessageEvent) {
      if (completionFired.current) return;

      const msg = tryParse(e.data);
      if (!msg) return;

      // Bunny CDN Stream embed fires: { event: "ended" }
      const isBunnyEnded = msg.event === "ended";

      // YouTube IFrame API fires: { event: "infoDelivery", info: { playerState: 0 } }
      const info = msg.info as Record<string, unknown> | undefined;
      const isYouTubeEnded = msg.event === "infoDelivery" && info?.playerState === 0;

      if (isBunnyEnded || isYouTubeEnded) {
        recordCompletion();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [enableXp, data, recordCompletion]);

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <div style={wrapStyle}>
        <style>{`@keyframes cvp-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={skeletonStyle}>
          <div style={{ ...spinnerStyle, animation: "cvp-spin 0.8s linear infinite" }} />
          <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#94a3b8" }}>
            Loading video…
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={wrapStyle}>
        <div style={errorStyle}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
          <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: "0.25rem" }}>
            Video unavailable
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isIframeable =
    data.embedUrl.startsWith("https://iframe.mediadelivery.net") ||
    data.embedUrl.startsWith("https://www.youtube.com/embed");

  return (
    <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", background: "#000", position: "relative" }}>
      {title && (
        <div style={{ padding: "0.625rem 1rem", background: "#0f172a", color: "#fff", fontSize: "0.875rem", fontWeight: 700 }}>
          ▶ {title}
        </div>
      )}

      {isIframeable ? (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={data.embedUrl}
            title={title ?? "Video"}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
      ) : (
        <video
          controls
          poster={data.posterUrl ?? undefined}
          src={data.manifestUrl}
          style={{ width: "100%", display: "block", background: "#000" }}
          onContextMenu={(e) => e.preventDefault()}
          onEnded={recordCompletion}
        />
      )}

      {/* XP completion banner — only shown when enableXp is true and API succeeds */}
      {xpBanner && (
        <div style={xpBannerStyle(xpBanner.xpAwarded > 0)}>
          {xpBanner.xpAwarded > 0 ? (
            <>
              <span style={{ fontSize: "1.25rem" }}>🎉</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                  You earned {xpBanner.xpAwarded} XP!
                </div>
                <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>
                  {xpBanner.attemptCount === 1 ? "First watch — full XP" : "Second watch — 50% XP"}
                </div>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: "1.25rem" }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Video completed</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>
                  No XP for this attempt (watch {xpBanner.attemptCount})
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  overflow: "hidden",
  background: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 240,
};

const skeletonStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
};

const errorStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  textAlign: "center",
};

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid #334155",
  borderTop: "3px solid #7c3aed",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

function xpBannerStyle(awarded: boolean): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    padding: "0.625rem 1.25rem",
    borderRadius: "999px",
    background: awarded ? "rgba(21, 128, 61, 0.92)" : "rgba(71, 85, 105, 0.92)",
    color: "#fff",
    backdropFilter: "blur(8px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
    pointerEvents: "none",
    zIndex: 10,
    minWidth: 200,
    maxWidth: "90%",
    whiteSpace: "nowrap",
  };
}
