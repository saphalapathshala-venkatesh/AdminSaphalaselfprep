export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-bootstrap-key");
  const expected = process.env.BOOTSTRAP_KEY;

  if (!expected || !key || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Missing ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD" },
      { status: 500 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Always update — this is the reset path for a broken/migrated passwordHash.
      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          role: "SUPER_ADMIN",
          isActive: true,
          isBlocked: false,
          blockedReason: null,
          deletedAt: null,
          mustChangePassword: false,
        },
      });
      console.log(`[bootstrap] Admin user reset: ${email}`);
      return NextResponse.json({ ok: true, email, created: false, updated: true });
    }

    await prisma.user.create({
      data: {
        email,
        name: "Super Admin",
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
        isBlocked: false,
      },
    });

    console.log(`[bootstrap] Admin user created: ${email}`);
    return NextResponse.json({ ok: true, email, created: true, updated: false }, { status: 201 });
  } catch (err) {
    console.error("[bootstrap] Bootstrap error:", err);
    return NextResponse.json({ error: "Bootstrap failed" }, { status: 500 });
  }
}
