export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { CURRENT_LEGAL_VERSION } from "@/lib/legalVersion";
import { validateNewPassword } from "@/lib/safetyChecks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, mobile, password, legalAccepted, boardId, categoryId } = body;

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
    const trimmedBoard  = (boardId    || "").trim() || null;
    const trimmedGrade  = (categoryId || "").trim() || null;

    if (!trimmedName)  return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const pwError = validateNewPassword(trimmedPw);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
    if (!trimmedEmail && !trimmedMobile)
      return NextResponse.json({ error: "Email or mobile is required" }, { status: 400 });

    // Board + Grade are required for new registrations
    if (!trimmedBoard) return NextResponse.json({ error: "Board is required" }, { status: 400 });
    if (!trimmedGrade) return NextResponse.json({ error: "Grade is required" }, { status: 400 });

    // Validate board exists and is active
    const board = await prisma.board.findUnique({ where: { id: trimmedBoard } });
    if (!board || !board.isActive)
      return NextResponse.json({ error: "Selected board is not available" }, { status: 400 });

    // Validate grade (Category) belongs to the selected board
    const grade = await prisma.category.findUnique({ where: { id: trimmedGrade } });
    if (!grade)
      return NextResponse.json({ error: "Selected grade is not available" }, { status: 400 });
    if (grade.boardId !== trimmedBoard)
      return NextResponse.json({ error: "Selected grade does not belong to the selected board" }, { status: 400 });

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
        boardId: trimmedBoard,
        categoryId: trimmedGrade,
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
