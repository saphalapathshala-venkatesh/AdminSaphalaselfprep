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
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  const skip = (page - 1) * pageSize;
  const all = searchParams.get("all") === "true";

  const where: any = { tenantId: "default" };
  if (search) where.name = { contains: search, mode: "insensitive" };

  try {
    if (all) {
      const items = await prisma.course.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } });
      return NextResponse.json({ data: items });
    }
    const [items, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { videos: true, liveClasses: true } } },
      }),
      prisma.course.count({ where }),
    ]);
    return NextResponse.json({ data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    console.error("Courses GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, categoryId, isActive } = body;
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const course = await prisma.course.create({
      data: {
        tenantId: "default",
        name: name.trim(),
        description: description?.trim() || null,
        categoryId: categoryId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    writeAuditLog({ actorId: user.id, action: "COURSE_CREATE", entityType: "Course", entityId: course.id, after: { name: course.name } });
    return NextResponse.json({ data: course }, { status: 201 });
  } catch (err) {
    console.error("Courses POST error:", err);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
