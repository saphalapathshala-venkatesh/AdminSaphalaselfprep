"use client";

/**
 * RichContent — renders question content HTML with equation support.
 *
 * Handles:
 *  - HTML stored in Question.stem / explanation / option.text
 *  - $$LaTeX$$ equation spans inserted by RichEditor (rendered via KaTeX)
 *  - Plain text (backward compatible — plain text is valid HTML)
 *  - Inline images and data-URI screenshots
 */

import { useEffect, useRef } from "react";

interface RichContentProps {
  html: string;
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function RichContent({ html, inline = false, className, style }: RichContentProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const spans = el.querySelectorAll<HTMLElement>("span.math-eq[data-latex]");
    if (spans.length === 0) return;

    import("katex").then((katex) => {
      spans.forEach((span) => {
        const latex = span.getAttribute("data-latex") ?? "";
        try {
          const rendered = katex.default.renderToString(latex, {
            throwOnError: false,
            displayMode: false,
            output: "html",
          });
          span.innerHTML = rendered;
          span.style.fontFamily = "inherit";
          span.style.fontSize = "inherit";
          span.style.background = "transparent";
          span.style.border = "none";
          span.style.padding = "0";
        } catch {
          span.textContent = `$$${latex}$$`;
        }
      });
    });
  }, [html]);

  const Tag = inline ? "span" : "div";

  return (
    <Tag
      ref={containerRef as any}
      className={className}
      style={{
        lineHeight: 1.6,
        wordBreak: "break-word",
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}
