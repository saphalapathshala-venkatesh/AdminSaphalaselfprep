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
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;
  const all = searchParams.get("all") === "true";

  const where: any = { tenantId: "default" };
  if (search) where.name = { contains: search, mode: "insensitive" };

  try {
    if (all) {
      const items = await prisma.faculty.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true, title: true, isActive: true } });
      return NextResponse.json({ data: items });
    }
    const [items, total] = await Promise.all([
      prisma.faculty.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { videos: true, liveClasses: true } } },
      }),
      prisma.faculty.count({ where }),
    ]);
    return NextResponse.json({ data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    console.error("Faculty GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, title, bio, avatarUrl, isActive } = body;
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const faculty = await prisma.faculty.create({
      data: {
        tenantId: "default",
        name: name.trim(),
        title: title?.trim() || null,
        bio: bio?.trim() || null,
        avatarUrl: avatarUrl?.trim() || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    writeAuditLog({ actorId: user.id, action: "FACULTY_CREATE", entityType: "Faculty", entityId: faculty.id, after: { name: faculty.name } });
    return NextResponse.json({ data: faculty }, { status: 201 });
  } catch (err) {
    console.error("Faculty POST error:", err);
    return NextResponse.json({ error: "Failed to create faculty" }, { status: 500 });
  }
}
