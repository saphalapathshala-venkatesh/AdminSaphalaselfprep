export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId") || undefined;

  const exams = await prisma.exam.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ exams });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = (body.name ?? "").trim();
  const categoryId = (body.categoryId ?? "").trim();
  let slug = (body.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const existing = await prisma.exam.findUnique({ where: { categoryId_slug: { categoryId, slug } } });
  if (existing) return NextResponse.json({ error: "An exam with this slug already exists in this category" }, { status: 409 });

  const exam = await prisma.exam.create({
    data: { name, slug, categoryId },
    include: { category: { select: { id: true, name: true } } },
  });

  writeAuditLog({ actorId: user.id, action: "EXAM_CREATED", entityType: "Exam", entityId: exam.id, after: { name, slug, categoryId } }).catch(() => {});

  return NextResponse.json({ ok: true, exam }, { status: 201 });
}
