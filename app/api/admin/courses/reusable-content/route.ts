export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_TYPES = ["TEST_SERIES", "PDF", "EBOOK", "VIDEO", "FLASHCARD_DECK", "LIVE_CLASS"] as const;
type ContentType = typeof VALID_TYPES[number];

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as ContentType | null;
  const categoryId = searchParams.get("categoryId") || undefined;
  const search = (searchParams.get("search") || "").trim();

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  const limit = 60;

  try {
    let items: { id: string; title: string; meta: Record<string, unknown> }[] = [];

    if (type === "TEST_SERIES") {
      const rows = await prisma.testSeries.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: {
          id: true,
          title: true,
          categoryId: true,
          isFree: true,
          isPublished: true,
          _count: { select: { tests: true } },
        },
        orderBy: { title: "asc" },
        take: limit,
      });
      items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: { tests: r._count.tests, categoryId: r.categoryId, isFree: r.isFree, isPublished: r.isPublished },
      }));
    } else if (type === "PDF") {
      const rows = await prisma.pdfAsset.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, categoryId: true, isPublished: true, fileSize: true },
        orderBy: { title: "asc" },
        take: limit,
      });
      items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: { categoryId: r.categoryId, isPublished: r.isPublished, fileSize: r.fileSize },
      }));
    } else if (type === "EBOOK") {
      const rows = await prisma.contentPage.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: {
          id: true,
          title: true,
          categoryId: true,
          isPublished: true,
          _count: { select: { ebookPages: true } },
        },
        orderBy: { title: "asc" },
        take: limit,
      });
      items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: { categoryId: r.categoryId, isPublished: r.isPublished, pages: r._count.ebookPages },
      }));
    } else if (type === "VIDEO") {
      const rows = await prisma.video.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, categoryId: true, status: true, durationSeconds: true },
        orderBy: { title: "asc" },
        take: limit,
      });
      items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: { categoryId: r.categoryId, status: r.status, durationSeconds: r.durationSeconds },
      }));
    } else if (type === "FLASHCARD_DECK") {
      const rows = await prisma.flashcardDeck.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: {
          id: true,
          title: true,
          categoryId: true,
          isPublished: true,
          _count: { select: { cards: true } },
        },
        orderBy: { title: "asc" },
        take: limit,
      });
      items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: { categoryId: r.categoryId, isPublished: r.isPublished, cards: r._count.cards },
      }));
    } else if (type === "LIVE_CLASS") {
      const rows = await prisma.liveClass.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, categoryId: true, status: true, sessionDate: true },
        orderBy: { title: "asc" },
        take: limit,
      });
      items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: { categoryId: r.categoryId, status: r.status, sessionDate: r.sessionDate },
      }));
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[reusable-content] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
