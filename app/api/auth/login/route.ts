export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ensureDbReady } from "@/lib/db-init";
import { isAdminRole } from "@/lib/safetyChecks";

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady();
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later.", retryAfterSec: limit.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      let msg = "Invalid input";
      try {
        const issues = JSON.parse(parsed.error.message);
        if (Array.isArray(issues) && issues.length > 0) {
          msg = issues[0].message;
        }
      } catch {}
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { identifier, password } = parsed.data;

    // Normalize: email is stored lowercase; mobile is stored trimmed.
    // Lowercasing a numeric mobile string is a safe no-op.
    const normalizedIdentifier = identifier.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedIdentifier }, { mobile: normalizedIdentifier }],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        mobile: true,
        name: true,
        passwordHash: true,
        role: true,
        isActive: true,
        isBlocked: true,
        blockedReason: true,
        mustChangePassword: true,
        deletedAt: true,
      },
    });

    if (!user || !user.passwordHash) {
      console.warn(`[login] No user or missing passwordHash for identifier: ${normalizedIdentifier}`);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!isAdminRole(user.role)) {
      console.warn(`[login] Non-admin role "${user.role}" attempted admin login: ${user.email}`);
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      console.warn(`[login] Inactive account attempted login: ${user.email}`);
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    if (user.isBlocked) {
      console.warn(`[login] Blocked account attempted login: ${user.email}`);
      return NextResponse.json(
        { error: user.blockedReason ? `Account blocked: ${user.blockedReason}` : "Account has been blocked. Contact support." },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.warn(`[login] Password mismatch for: ${user.email}`);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await prisma.session.create({
        data: {
          userId: user.id,
          type: "ADMIN",
          token,
          expiresAt,
        },
      });
    } catch (sessionErr) {
      console.error("Session create failed:", sessionErr);
      return NextResponse.json({ error: "SESSION_CREATE_FAILED" }, { status: 500 });
    }

    // Fire-and-forget: audit log is non-critical, do not block the response
    // [Auth API timing] audit log queued (not awaited)
    writeAuditLog({
      actorId: user.id,
      action: "ADMIN_LOGIN",
      entityType: "Session",
    }).catch((auditErr) => {
      console.error("AuditLog write failed (non-fatal):", auditErr);
    });

    console.debug("[Auth API] Session created, sending response");

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
