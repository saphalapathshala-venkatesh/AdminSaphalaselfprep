"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const PURPLE = "#7c3aed";

interface Annotation {
  id: string;
  annotationType: "HIGHLIGHT" | "UNDERLINE";
  selectedText: string;
  rangeData: { startOffset: number; endOffset: number; startPath: string; endPath: string };
  color: string;
  createdAt: string;
}

interface EBookViewerProps {
  contentId: string;
  htmlContent: string;
  title?: string;
  onClose?: () => void;
  subjectColor?: string;
}

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];

function getNodePath(node: Node, root: Element): string {
  const path: number[] = [];
  let current: Node | null = node;
  while (current && current !== root) {
    const parent: Node | null = current.parentNode;
    if (!parent) break;
    const idx = Array.from(parent.childNodes).indexOf(current as ChildNode);
    path.unshift(idx);
    current = parent;
  }
  return path.join(",");
}

function resolveNodePath(path: string, root: Element): Node | null {
  if (!path) return root;
  const indices = path.split(",").map(Number);
  let node: Node = root;
  for (const idx of indices) {
    const children = node.childNodes;
    if (idx >= children.length) return null;
    node = children[idx];
  }
  return node;
}

function applyAnnotationToDOM(root: Element, annotation: Annotation) {
  try {
    const range = document.createRange();
    const startNode = resolveNodePath(annotation.rangeData.startPath, root);
    const endNode = resolveNodePath(annotation.rangeData.endPath, root);
    if (!startNode || !endNode) return;
    range.setStart(startNode, annotation.rangeData.startOffset);
    range.setEnd(endNode, annotation.rangeData.endOffset);
    const span = document.createElement("span");
    span.dataset.annotationId = annotation.id;
    if (annotation.annotationType === "HIGHLIGHT") {
      span.style.backgroundColor = annotation.color;
      span.style.borderRadius = "2px";
    } else {
      span.style.textDecoration = "underline";
      span.style.textDecorationColor = annotation.color;
      span.style.textDecorationStyle = "wavy";
    }
    span.style.cursor = "pointer";
    span.title = "Click to remove annotation";
    range.surroundContents(span);
  } catch {
    /* range may span multiple elements; skip gracefully */
  }
}

export default function EBookViewer({ contentId, htmlContent, title, onClose, subjectColor }: EBookViewerProps) {
  const color = subjectColor || PURPLE;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotating, setAnnotating] = useState(false);
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null);
  const [selectionData, setSelectionData] = useState<{ text: string; rangeData: Annotation["rangeData"] } | null>(null);
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);
  const [activeType, setActiveType] = useState<"HIGHLIGHT" | "UNDERLINE">("HIGHLIGHT");
  const [loadingAnnotations, setLoadingAnnotations] = useState(true);
  const [infringementWarning, setInfringementWarning] = useState("");

  const loadAnnotations = useCallback(async () => {
    setLoadingAnnotations(true);
    try {
      const res = await fetch(`/api/annotations?contentType=ebook&contentId=${contentId}`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations || []);
      }
    } catch { /* ignore */ }
    finally { setLoadingAnnotations(false); }
  }, [contentId]);

  useEffect(() => { loadAnnotations(); }, [loadAnnotations]);

  useEffect(() => {
    if (loadingAnnotations) return;
    const root = contentRef.current;
    if (!root) return;
    root.innerHTML = htmlContent;
    for (const ann of annotations) {
      applyAnnotationToDOM(root, ann);
    }
    const handleAnnotationClick = (e: MouseEvent) => {
      const span = (e.target as Element).closest("[data-annotation-id]");
      if (span) {
        const annId = (span as HTMLElement).dataset.annotationId;
        if (annId && confirm("Remove this annotation?")) {
          removeAnnotation(annId);
        }
      }
    };
    root.addEventListener("click", handleAnnotationClick);
    return () => root.removeEventListener("click", handleAnnotationClick);
  }, [htmlContent, annotations, loadingAnnotations]);

  function handleCopy(e: ClipboardEvent) {
    e.preventDefault();
    setInfringementWarning("⚠️ Copying is not allowed on this E-Book.");
    setTimeout(() => setInfringementWarning(""), 4000);
    fetch("/api/infringement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "ebook", contentId, eventType: "COPY_ATTEMPT", userAgent: navigator.userAgent }),
    }).catch(() => {});
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    fetch("/api/infringement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "ebook", contentId, eventType: "RIGHT_CLICK_ATTEMPT", userAgent: navigator.userAgent }),
    }).catch(() => {});
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!annotating) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) return;
    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text || text.length < 2) return;
    const root = contentRef.current;
    const rangeData = {
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startPath: getNodePath(range.startContainer, root),
      endPath: getNodePath(range.endContainer, root),
    };
    setSelectionData({ text, rangeData });
    setToolbar({ x: e.clientX, y: e.clientY });
  }

  async function saveAnnotation() {
    if (!selectionData) return;
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "ebook",
          contentId,
          annotationType: activeType,
          selectedText: selectionData.text,
          rangeData: selectionData.rangeData,
          color: activeColor,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnnotations(prev => [...prev, data.annotation]);
        setToolbar(null);
        setSelectionData(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch { /* ignore */ }
  }

  async function removeAnnotation(annId: string) {
    try {
      await fetch(`/api/annotations/${annId}`, { method: "DELETE" });
      setAnnotations(prev => prev.filter(a => a.id !== annId));
    } catch { /* ignore */ }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "min(820px, 95vw)",
        height: "min(88vh, 900px)", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${color}dd, ${color})`, padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <div style={{ fontSize: "1.25rem" }}>📖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>{title || "E-Book"}</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.7)" }}>Protected Content · {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}</div>
          </div>
          {/* Annotation toggle */}
          <button
            onClick={() => { setAnnotating(a => !a); setToolbar(null); }}
            title={annotating ? "Exit annotation mode" : "Enter annotation mode (select text to annotate)"}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.5)",
              background: annotating ? "#fff" : "transparent",
              color: annotating ? color : "#fff",
              cursor: "pointer", fontWeight: 700, fontSize: "0.78rem",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
            <span>✏️</span>
            {annotating ? "Done" : "Annotate"}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1, padding: "4px 8px", borderRadius: 6 }}>✕</button>
        </div>

        {/* Annotation toolbar info */}
        {annotating && (
          <div style={{ background: "#f0fdf4", padding: "8px 20px", fontSize: "0.78rem", color: "#166534", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", flexShrink: 0 }}>
            <span>✅ Select text in the reader to annotate it.</span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>Type:</span>
              {(["HIGHLIGHT", "UNDERLINE"] as const).map(t => (
                <button key={t} onClick={() => setActiveType(t)}
                  style={{ padding: "2px 10px", borderRadius: 5, border: `1.5px solid ${t === activeType ? "#16a34a" : "#d1d5db"}`, background: t === activeType ? "#dcfce7" : "#fff", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>Color:</span>
              {HIGHLIGHT_COLORS.map(c => (
                <div key={c} onClick={() => setActiveColor(c)}
                  style={{ width: 16, height: 16, borderRadius: "50%", background: c, cursor: "pointer", border: c === activeColor ? "2px solid #16a34a" : "1px solid #d1d5db" }} />
              ))}
            </div>
          </div>
        )}

        {/* Infringement warning banner */}
        {infringementWarning && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 20px", fontSize: "0.82rem", fontWeight: 600, textAlign: "center", flexShrink: 0 }}>
            {infringementWarning}
          </div>
        )}

        {/* E-Book content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 40px", position: "relative", userSelect: annotating ? "text" : "none" }}
          onContextMenu={handleContextMenu}
          onMouseUp={handleMouseUp}>
          <div
            ref={contentRef}
            onCopy={handleCopy as unknown as React.ClipboardEventHandler}
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "1.05rem", lineHeight: 1.75, color: "#1a1a2e", maxWidth: 720 }}
          />
          {/* Watermark */}
          <div style={{
            position: "fixed", inset: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0.025, transform: "rotate(-30deg)",
            fontSize: "3rem", fontWeight: 900, color: "#000",
            letterSpacing: "0.2em", whiteSpace: "nowrap", userSelect: "none",
            zIndex: 1,
          }}>
            SAPHALA PATHSHALA · PROTECTED
          </div>
        </div>

        {/* Floating annotation save popup */}
        {toolbar && selectionData && (
          <div style={{
            position: "fixed", left: Math.min(toolbar.x, window.innerWidth - 260), top: toolbar.y + 12,
            background: "#fff", borderRadius: 10, padding: "12px 14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)", zIndex: 10000,
            border: "1px solid #e5e7eb", minWidth: 230,
          }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              "{selectionData.text.slice(0, 40)}{selectionData.text.length > 40 ? "…" : ""}"
            </div>
            <div style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: "8px" }}>{activeType} · color: <span style={{ display: "inline-block", width: 10, height: 10, background: activeColor, borderRadius: "50%", verticalAlign: "middle" }} /></div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={saveAnnotation} style={{ flex: 1, padding: "6px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Save</button>
              <button onClick={() => { setToolbar(null); setSelectionData(null); }} style={{ padding: "6px 10px", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
