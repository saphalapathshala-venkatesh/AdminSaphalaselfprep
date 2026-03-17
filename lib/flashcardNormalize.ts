/**
 * Shared flashcard card normalization utilities.
 *
 * The FlashcardCard.content field stores all card-type-specific data as JSON.
 * Two special keys — `instruction` and `layout` — are also surfaced as
 * top-level API fields for convenience:
 *
 *   instruction  (string | null) — optional prompt shown above the interactive
 *                element for REORDER, FILL_IN_BLANK, MATCHING, CATEGORIZATION.
 *
 *   layout       (object | null) — optional rich layout descriptor for the card
 *                editor, supporting positioned blocks, row/column arrangement,
 *                resize handles, etc. Shared pattern — reusable by ebooks and
 *                HTML content pages in future.
 *
 * Layout shape (all fields optional):
 * {
 *   blocks?: Array<{
 *     id: string,
 *     type: "text" | "image" | "table" | "callout" | string,
 *     row?: number, col?: number,
 *     x?: number, y?: number,
 *     width?: number | string, height?: number | string,
 *     span?: number,
 *     alignment?: "left" | "center" | "right",
 *     styleVariant?: string,
 *     content?: unknown,
 *   }>,
 *   rows?: number,
 *   cols?: number,
 * }
 *
 * Backward compatibility guarantee:
 *   - Cards without instruction/layout continue to work unchanged.
 *   - `instruction` and `layout` are always nullable in the response.
 *   - `content` always retains all existing card-type fields.
 */

/** Card types that support the optional instruction line. */
export const INSTRUCTION_CARD_TYPES = new Set([
  "REORDER",
  "FILL_IN_BLANK",
  "MATCHING",
  "CATEGORIZATION",
]);

/** Raw DB shape for a FlashcardCard row. */
export interface RawFlashcardCard {
  id: string;
  deckId: string;
  cardType: string;
  front: string;
  back: string;
  content: Record<string, unknown> | null;
  imageUrl: string | null;
  order: number;
  subtopicId?: string | null;
  subtopic?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Normalized card shape returned to both admin and student clients. */
export interface NormalizedFlashcardCard {
  id: string;
  deckId: string;
  cardType: string;
  front: string;
  back: string;
  /** Instruction line — only relevant for REORDER, FILL_IN_BLANK, MATCHING, CATEGORIZATION. */
  instruction: string | null;
  /** Rich layout descriptor for positioned/resized content blocks. Null when absent. */
  layout: Record<string, unknown> | null;
  /** Full card-type-specific content (question, pairs, items, etc.). */
  content: Record<string, unknown> | null;
  imageUrl: string | null;
  order: number;
  subtopicId?: string | null;
  subtopic?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extracts `instruction` and `layout` from the content JSON and returns a
 * normalized card object with these as explicit top-level fields.
 *
 * The `content` field in the response has instruction and layout REMOVED from
 * it to avoid duplication — they are always accessed via the top-level fields.
 */
export function normalizeCard(card: RawFlashcardCard): NormalizedFlashcardCard {
  const raw = card.content ?? {};

  const instruction = INSTRUCTION_CARD_TYPES.has(card.cardType)
    ? (typeof raw.instruction === "string" ? raw.instruction : null)
    : null;

  const layout =
    raw.layout != null && typeof raw.layout === "object"
      ? (raw.layout as Record<string, unknown>)
      : null;

  // Return content without the meta fields to avoid duplication
  const { instruction: _i, layout: _l, ...contentWithoutMeta } = raw;
  const cleanContent = Object.keys(contentWithoutMeta).length > 0 ? contentWithoutMeta : null;

  return {
    id: card.id,
    deckId: card.deckId,
    cardType: card.cardType,
    front: card.front,
    back: card.back,
    instruction,
    layout,
    content: cleanContent,
    imageUrl: card.imageUrl,
    order: card.order,
    subtopicId: card.subtopicId ?? null,
    subtopic: card.subtopic,
    createdAt: card.createdAt?.toISOString(),
    updatedAt: card.updatedAt?.toISOString(),
  };
}

/**
 * Merges top-level `instruction` and `layout` params into a content JSON object.
 * Used in POST/PUT handlers so admin can send them as separate fields or embed
 * them inside `content` — either way the result is consistent.
 *
 * If `instruction` or `layout` are `undefined` (not provided in request body),
 * any existing values from `baseContent` are preserved.
 */
export function mergeContentFields(
  baseContent: Record<string, unknown> | null | undefined,
  instruction: string | null | undefined,
  layout: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(baseContent ?? {}) };

  if (instruction !== undefined) {
    if (instruction) {
      base.instruction = instruction;
    } else {
      delete base.instruction;
    }
  }

  if (layout !== undefined) {
    if (layout && typeof layout === "object") {
      base.layout = layout;
    } else {
      delete base.layout;
    }
  }

  return base;
}
