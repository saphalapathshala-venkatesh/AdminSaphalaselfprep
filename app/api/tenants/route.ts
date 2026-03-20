export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    return NextResponse.json({ data: tenants });
  } catch (err) {
    console.error("Tenants GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "SUPER_ADMIN only" }, { status: 403 });

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const slug = (body.slug || "").trim().toLowerCase().replace(/\s+/g, "-");

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "A tenant with this slug already exists" }, { status: 409 });

    const tenant = await prisma.tenant.create({
      data: { name, slug, isActive: true },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    return NextResponse.json({ data: tenant }, { status: 201 });
  } catch (err) {
    console.error("Tenants POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
