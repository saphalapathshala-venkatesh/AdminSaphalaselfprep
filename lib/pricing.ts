/**
 * Shared pricing utilities for Course pricing.
 * All monetary values are stored as integers in paise (1 INR = 100 paise).
 * Use these helpers consistently across admin forms and API routes.
 */

export interface CoursePriceInfo {
  isFree: boolean;
  mrpPaise: number | null;
  sellingPricePaise: number | null;
}

/**
 * Converts a rupee string/number input to paise integer.
 * Returns null if the input is empty/undefined/null/invalid.
 */
export function parsePaiseFromRupees(rupees: string | number | null | undefined): number | null {
  if (rupees === null || rupees === undefined) return null;
  const s = String(rupees).trim();
  if (s === "") return null;
  const n = parseFloat(s);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Formats paise as a rupee string for display (e.g. 49900 → "499.00").
 * Returns empty string if paise is null/undefined.
 */
export function formatRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return (paise / 100).toFixed(2);
}

/**
 * Formats paise as a rounded rupee string (e.g. 49900 → "499").
 */
export function formatRupeesRounded(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return Math.round(paise / 100).toString();
}

/**
 * Computes the discount percentage between MRP and selling price.
 * Returns null if either value is missing.
 * Returns 0 if selling price >= MRP.
 */
export function calcDiscountPercent(
  mrpPaise: number | null | undefined,
  sellingPricePaise: number | null | undefined
): number | null {
  if (!mrpPaise || mrpPaise <= 0 || sellingPricePaise === null || sellingPricePaise === undefined) return null;
  if (sellingPricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - sellingPricePaise) / mrpPaise) * 100);
}

/**
 * Validates a course pricing configuration.
 * Returns an error string if invalid, or null if valid.
 */
export function validateCoursePricing(
  isFree: boolean,
  mrpPaise: number | null,
  sellingPricePaise: number | null
): string | null {
  if (isFree) return null;
  if (mrpPaise !== null && mrpPaise < 0) return "MRP cannot be negative";
  if (sellingPricePaise !== null && sellingPricePaise < 0) return "Selling price cannot be negative";
  if (mrpPaise !== null && sellingPricePaise !== null && sellingPricePaise > mrpPaise) {
    return "Selling price cannot exceed MRP";
  }
  return null;
}

/**
 * Returns a structured display object for rendering course pricing in a UI.
 * Safe to call with null/undefined values — always returns a valid object.
 */
export function getCoursePriceDisplay(course: CoursePriceInfo): {
  isFree: boolean;
  sellingLabel: string;
  mrpLabel: string | null;
  discountPercent: number | null;
  hasDiscount: boolean;
} {
  if (course.isFree) {
    return { isFree: true, sellingLabel: "Free", mrpLabel: null, discountPercent: null, hasDiscount: false };
  }
  const sp = course.sellingPricePaise;
  const mrp = course.mrpPaise;
  const discount = calcDiscountPercent(mrp, sp);
  const sellingLabel = sp !== null ? `₹${formatRupeesRounded(sp)}` : mrp !== null ? `₹${formatRupeesRounded(mrp)}` : "—";
  const mrpLabel = mrp !== null && sp !== null && mrp > sp ? `₹${formatRupeesRounded(mrp)}` : null;
  return {
    isFree: false,
    sellingLabel,
    mrpLabel,
    discountPercent: discount,
    hasDiscount: discount !== null && discount > 0,
  };
}
