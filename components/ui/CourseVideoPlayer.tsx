"use client";

import { useState, useEffect } from "react";

type PlaybackData = {
  videoId: string;
  manifestUrl: string;
  embedUrl: string;
  posterUrl: string | null;
  expiresAt: string | null;
};

type Props = {
  videoId: string;
  title?: string;
};

export default function CourseVideoPlayer({ videoId, title }: Props) {
  const [data, setData] = useState<PlaybackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    setData(null);

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
        />
      )}
    </div>
  );
}

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
