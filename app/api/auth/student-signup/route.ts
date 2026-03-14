export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { CURRENT_LEGAL_VERSION } from "@/lib/legalVersion";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, mobile, password, legalAccepted } = body;

    if (!legalAccepted) {
      return NextResponse.json(
        { error: "You must accept the Terms & Conditions and Refund Policy to create an account." },
        { status: 400 }
      );
    }

    const trimmedEmail  = (email  || "").trim().toLowerCase() || null;
    const trimmedMobile = (mobile || "").trim() || null;
    const trimmedName   = (name   || "").trim();
    const trimmedPw     = (password || "").trim();

    if (!trimmedName)  return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!trimmedPw || trimmedPw.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    if (!trimmedEmail && !trimmedMobile)
      return NextResponse.json({ error: "Email or mobile is required" }, { status: 400 });

    if (trimmedEmail) {
      const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
      if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    if (trimmedMobile) {
      const existing = await prisma.user.findUnique({ where: { mobile: trimmedMobile } });
      if (existing) return NextResponse.json({ error: "An account with this mobile already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(trimmedPw, 10);
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        mobile: trimmedMobile,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        legalAcceptedAt: now,
        legalVersion: CURRENT_LEGAL_VERSION,
      },
      select: { id: true, name: true, email: true, mobile: true, role: true },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { userId: user.id, type: "STUDENT", token, expiresAt },
    });

    const response = NextResponse.json({ ok: true, user }, { status: 201 });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Student signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
