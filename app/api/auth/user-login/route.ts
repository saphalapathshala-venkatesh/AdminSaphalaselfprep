export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseDeviceInfo } from "@/lib/deviceFingerprint";
import { writeUserActivity } from "@/lib/userActivity";

const SESSION_TTL_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
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
        if (Array.isArray(issues) && issues.length > 0) msg = issues[0].message;
      } catch {}
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { identifier, password } = parsed.data;
    const ua = req.headers.get("user-agent") || "";

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { mobile: identifier }] },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Blocked check
    if (user.isBlocked) {
      writeUserActivity({ userId: user.id, activityType: "LOGIN_BLOCKED_USER", ipAddress: ip });
      return NextResponse.json(
        { error: user.blockedReason ? `Account blocked: ${user.blockedReason}` : "Account has been blocked. Contact support." },
        { status: 403 }
      );
    }

    // Soft-deleted check
    if (user.deletedAt) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // ── Device check ──────────────────────────────────────────────────────────
    const deviceInfo = parseDeviceInfo(user.id, ua);
    const { deviceKey, deviceType, browser, os } = deviceInfo;

    // Check for existing trusted device
    const existingDevice = await prisma.userDevice.findUnique({
      where: { userId_deviceKey: { userId: user.id, deviceKey } },
    });

    if (existingDevice) {
      if (existingDevice.isBlocked) {
        return NextResponse.json({ error: "This device has been blocked. Contact support." }, { status: 403 });
      }
      // Update last seen
      await prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: { lastSeenAt: new Date(), ipAddressLast: ip, isActive: true, userAgent: ua || undefined },
      });
    } else {
      // New device — check slot limit
      const activeCount = await prisma.userDevice.count({
        where: { userId: user.id, isActive: true, isBlocked: false },
      });

      if (activeCount >= user.maxWebDevices) {
        writeUserActivity({
          userId: user.id,
          activityType: "LOGIN_BLOCKED_DEVICE_LIMIT",
          deviceKey,
          ipAddress: ip,
          meta: { activeCount, maxWebDevices: user.maxWebDevices },
        });
        return NextResponse.json(
          {
            error: `Device limit reached. You can only use ${user.maxWebDevices} device(s). Reset your devices or contact an admin.`,
            code: "DEVICE_LIMIT_REACHED",
          },
          { status: 403 }
        );
      }

      // Register new device
      await prisma.userDevice.create({
        data: {
          tenantId: "default",
          userId:   user.id,
          deviceKey,
          deviceType,
          browser,
          os,
          userAgent:     ua || null,
          ipAddressLast: ip,
          isActive:      true,
        },
      });

      writeUserActivity({ userId: user.id, activityType: "DEVICE_REGISTERED", deviceKey, ipAddress: ip });
    }

    // ── Create session ────────────────────────────────────────────────────────
    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { userId: user.id, type: "ADMIN", token, expiresAt },
    });

    writeUserActivity({ userId: user.id, activityType: "LOGIN_SUCCESS", deviceKey, ipAddress: ip });
    writeAuditLog({ actorId: user.id, action: "USER_LOGIN", entityType: "Session" }).catch(() => {});

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      mustChangePassword: user.mustChangePassword ?? false,
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   SESSION_TTL_DAYS * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("User login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
