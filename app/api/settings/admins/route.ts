export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden: SUPER_ADMIN only" }, { status: 403 });

  const body = await req.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";
  const role: string = body.role ?? "ADMIN";

  if (!email || !name || !password)
    return NextResponse.json({ error: "Email, name, and password are required" }, { status: 400 });
  if (!["ADMIN", "SUPER_ADMIN"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const newAdmin = await prisma.user.create({
    data: { email, name, passwordHash, role: role as "ADMIN" | "SUPER_ADMIN", isActive: true },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  writeAuditLog({ actorId: user.id, action: "ADMIN_CREATED", entityType: "User", entityId: newAdmin.id, after: { email, role } }).catch(() => {});
  return NextResponse.json({ ok: true, admin: newAdmin }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden: SUPER_ADMIN only" }, { status: 403 });

  const body = await req.json();
  const { id, isActive } = body;
  if (!id || typeof isActive !== "boolean")
    return NextResponse.json({ error: "id and isActive are required" }, { status: 400 });
  if (id === user.id)
    return NextResponse.json({ error: "You cannot modify your own account status" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN"))
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  writeAuditLog({ actorId: user.id, action: isActive ? "ADMIN_ENABLED" : "ADMIN_DISABLED", entityType: "User", entityId: id }).catch(() => {});
  return NextResponse.json({ ok: true, admin: updated });
}
