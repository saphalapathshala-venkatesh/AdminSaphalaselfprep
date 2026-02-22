export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-bootstrap-key");
  const expected = process.env.BOOTSTRAP_KEY;

  if (!expected || !key || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = process.env.ADMIN_SEED_EMAIL?.trim();
  const password = process.env.ADMIN_SEED_PASSWORD?.trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD" }, { status: 500 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: true, email, created: false });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        name: "Super Admin",
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, email, created: true }, { status: 201 });
  } catch (err) {
    console.error("Bootstrap error:", err);
    return NextResponse.json({ error: "Bootstrap failed" }, { status: 500 });
  }
}
