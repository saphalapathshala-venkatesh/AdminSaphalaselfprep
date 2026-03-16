export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/public/categories
 *
 * Returns published categories with their exams — no authentication required.
 * Used by the student-facing app for navigation and content discovery.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        exams: {
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
        },
      },
    });
    return NextResponse.json({ data: categories });
  } catch (err) {
    console.error("[public/categories] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
