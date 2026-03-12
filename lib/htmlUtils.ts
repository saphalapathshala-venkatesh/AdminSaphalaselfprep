/**
 * HTML utility helpers used across API routes and content-hash logic.
 * Runs in both Node.js (API routes) and browser (client components).
 */

/**
 * Strips all HTML tags from a string and collapses whitespace.
 * Safe to call with plain text (no-op when no tags present).
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true when the HTML string contains visible text content.
 * Use this instead of `.trim()` when the value may be rich HTML.
 */
export function hasVisibleText(html: string): boolean {
  return stripHtml(html).length > 0;
}
