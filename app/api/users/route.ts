export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { validateNewPassword } from "@/lib/safetyChecks";

export async function GET(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search") || "";
  const role      = searchParams.get("role") || "";
  const blocked   = searchParams.get("blocked");
  const deleted   = searchParams.get("deleted") === "true";
  const page      = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize  = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  const skip      = (page - 1) * pageSize;

  const where: any = {};

  if (deleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  if (search) {
    where.OR = [
      { name:   { contains: search, mode: "insensitive" } },
      { email:  { contains: search, mode: "insensitive" } },
      { mobile: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) where.role = role;
  if (blocked === "true")  where.isBlocked = true;
  if (blocked === "false") where.isBlocked = false;

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id:           true,
          name:         true,
          email:        true,
          mobile:       true,
          role:         true,
          isActive:     true,
          isBlocked:    true,
          blockedReason:true,
          maxWebDevices:true,
          deletedAt:    true,
          createdAt:    true,
          updatedAt:    true,
          tenantId:     true,
          tenant:       { select: { id: true, name: true } },
          boardId:      true,
          board:        { select: { id: true, name: true } },
          categoryId:   true,
          gradeCategory:{ select: { id: true, name: true } },
          _count: {
            select: {
              devices:    true,
              activities: true,
              sessions:   true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Attach active device count separately
    const userIds = users.map((u) => u.id);
    const activeDeviceCounts = await prisma.userDevice.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, isActive: true },
      _count: { id: true },
    });
    const activeMap = new Map(activeDeviceCounts.map((r) => [r.userId, r._count.id]));

    // Get last activity per user
    const lastActivities = await prisma.userActivity.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
      select: { userId: true, createdAt: true },
    });
    const lastActivityMap = new Map(lastActivities.map((r) => [r.userId, r.createdAt]));

    const enriched = users.map((u) => ({
      ...u,
      activeDeviceCount: activeMap.get(u.id) ?? 0,
      lastActiveAt:      lastActivityMap.get(u.id) ?? null,
    }));

    return NextResponse.json({
      data: enriched,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Users GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name     = (body.name     || "").trim();
    const email    = (body.email    || "").trim().toLowerCase() || null;
    const mobile   = (body.mobile   || "").trim() || null;
    const password = (body.password || "").trim();
    const role     = body.role || "STUDENT";
    const tenantId = body.tenantId || null;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const pwError = validateNewPassword(password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
    if (!email && !mobile) return NextResponse.json({ error: "Email or mobile is required" }, { status: 400 });

    const validRoles = ["STUDENT", "ADMIN", "SUPER_ADMIN"];
    if (!validRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    if (email) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      const conflict = await prisma.user.findUnique({ where: { email } });
      if (conflict) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    if (mobile) {
      const conflict = await prisma.user.findUnique({ where: { mobile } });
      if (conflict) return NextResponse.json({ error: "An account with this mobile already exists" }, { status: 409 });
    }

    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return NextResponse.json({ error: "Selected school/tenant not found" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, mobile, passwordHash, role, isActive: true, tenantId },
      select: { id: true, name: true, email: true, mobile: true, role: true, tenantId: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (err) {
    console.error("Users POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
