export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  try {
    const testWhere: any = {};
    if (categoryId) testWhere.categoryId = categoryId;

    const allSections = await prisma.testSection.findMany({
      where: { test: testWhere },
      select: {
        title: true,
        parentSectionId: true,
        parentSection: { select: { title: true } },
      },
      orderBy: { title: "asc" },
    });

    const topLevelSet = new Set<string>();
    const subsectionMap: Record<string, Set<string>> = {};

    for (const s of allSections) {
      if (!s.parentSectionId) {
        topLevelSet.add(s.title.trim());
      } else {
        const parentName = s.parentSection?.title?.trim() || "";
        if (!subsectionMap[parentName]) subsectionMap[parentName] = new Set();
        subsectionMap[parentName].add(s.title.trim());
      }
    }

    const sections = Array.from(topLevelSet).sort();
    const subsections: Record<string, string[]> = {};
    for (const [parent, names] of Object.entries(subsectionMap)) {
      subsections[parent] = Array.from(names).sort();
    }

    return NextResponse.json({ sections, subsections });
  } catch (err) {
    console.error("Section templates GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
