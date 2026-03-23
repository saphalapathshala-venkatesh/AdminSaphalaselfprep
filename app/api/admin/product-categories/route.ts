/**
 * GET /api/admin/product-categories
 *
 * Returns all ProductCategory enum values with display labels and the
 * isFree flag.  The admin coupon UI fetches this endpoint so product
 * categories are never hardcoded on the client.
 *
 * FREE_DEMO is included in the response (isFree: true) so the UI can
 * explicitly exclude it from selection.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";

const PRODUCT_CATEGORIES = [
  { code: "COMPLETE_PREP_PACK", label: "Complete Prep Pack",  isFree: false, sortOrder: 1 },
  { code: "SELF_PREP",          label: "Self Prep",           isFree: false, sortOrder: 2 },
  { code: "TEST_SERIES",        label: "Test Series",         isFree: false, sortOrder: 3 },
  { code: "VIDEO_ONLY",         label: "Video Course",        isFree: false, sortOrder: 4 },
  { code: "FLASHCARDS_ONLY",    label: "Flashcard Deck",      isFree: false, sortOrder: 5 },
  { code: "PDF_ONLY",           label: "PDF / E-Book Pack",   isFree: false, sortOrder: 6 },
  { code: "CURRENT_AFFAIRS",    label: "Current Affairs",     isFree: false, sortOrder: 7 },
  { code: "FREE_DEMO",          label: "Free Demo",           isFree: true,  sortOrder: 8 },
];

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ data: PRODUCT_CATEGORIES });
}
