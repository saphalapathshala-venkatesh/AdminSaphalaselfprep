/**
 * Shared pricing utilities — Course is the sole pricing owner.
 *
 * Storage strategy: Course.mrp and Course.sellingPrice are Decimal(10,2) in rupees.
 * Display: strip trailing .00; show decimals only when needed; always prefix with ₹.
 * Legacy: mrpPaise / sellingPricePaise on Course (deprecated) and pricePaise on
 * TestSeries/ProductPackage are NOT used as pricing source of truth for any UI or checkout.
 */

// ─── Primary: Rupee-based (Decimal) ──────────────────────────────────────────

/**
 * Formats a rupee value for display.
 * Strips .00; shows decimals only when needed; always prefixes ₹.
 * Examples: 199.00 → "₹199", 199.67 → "₹199.67", null → ""
 */
export function formatRupee(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(n)) return "";
  return n % 1 === 0 ? `₹${Math.round(n)}` : `₹${n.toFixed(2)}`;
}

/**
 * Calculates discount percentage between MRP and selling price (rupees).
 * Returns null if inputs are missing; 0 if sellingPrice >= mrp.
 */
export function calculateDiscount(
  mrp: number | string | null | undefined,
  sellingPrice: number | string | null | undefined
): number | null {
  const m = mrp !== null && mrp !== undefined ? Number(mrp) : null;
  const s = sellingPrice !== null && sellingPrice !== undefined ? Number(sellingPrice) : null;
  if (!m || m <= 0 || s === null || isNaN(m) || isNaN(s)) return null;
  if (s >= m) return 0;
  return Math.round(((m - s) / m) * 100);
}

/**
 * Validates course pricing values (rupees).
 * Returns an error string if invalid, or null if valid.
 */
export function validatePricing(
  isFree: boolean,
  mrp: number | null,
  sellingPrice: number | null
): string | null {
  if (isFree) return null;
  if (mrp !== null && mrp < 0) return "MRP cannot be negative";
  if (sellingPrice !== null && sellingPrice < 0) return "Selling price cannot be negative";
  if (mrp !== null && sellingPrice !== null && sellingPrice > mrp) {
    return "Selling price cannot exceed MRP";
  }
  return null;
}

/**
 * Parses a rupee string input to a float (or null if empty/invalid).
 */
export function parseRupees(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(String(value));
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100; // round to 2 dp
}

// ─── Derived display helper ───────────────────────────────────────────────────

export interface CoursePriceInfo {
  isFree: boolean;
  mrp: number | string | null | undefined;
  sellingPrice: number | string | null | undefined;
}

/**
 * Returns a structured display object for rendering course pricing in any UI.
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
  const sp = course.sellingPrice !== null && course.sellingPrice !== undefined ? Number(course.sellingPrice) : null;
  const mrp = course.mrp !== null && course.mrp !== undefined ? Number(course.mrp) : null;
  const disc = calculateDiscount(mrp, sp);
  const sellingLabel = sp !== null ? formatRupee(sp) : mrp !== null ? formatRupee(mrp) : "—";
  const mrpLabel = mrp !== null && sp !== null && mrp > sp ? formatRupee(mrp) : null;
  return {
    isFree: false,
    sellingLabel,
    mrpLabel,
    discountPercent: disc,
    hasDiscount: disc !== null && disc > 0,
  };
}

// ─── Legacy: Paise-based helpers (kept for ProductPackage / TestSeries compat) ─

/**
 * @deprecated Use parseRupees() instead for Course pricing.
 * Kept for ProductPackage / other paise-based models.
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
 * @deprecated Use formatRupee() instead for Course pricing.
 */
export function formatRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return (paise / 100).toFixed(2);
}

/** @deprecated */
export function formatRupeesRounded(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return Math.round(paise / 100).toString();
}

/** @deprecated Use calculateDiscount() instead. */
export function calcDiscountPercent(
  mrpPaise: number | null | undefined,
  sellingPricePaise: number | null | undefined
): number | null {
  if (!mrpPaise || mrpPaise <= 0 || sellingPricePaise === null || sellingPricePaise === undefined) return null;
  if (sellingPricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - sellingPricePaise) / mrpPaise) * 100);
}

/** @deprecated Use validatePricing() instead. */
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
