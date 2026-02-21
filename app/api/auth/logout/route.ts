import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("admin_session")?.value;
    if (!token) {
      return NextResponse.json({ ok: true });
    }

    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (session && !session.revokedAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await writeAuditLog({
        userId: session.userId,
        action: "ADMIN_LOGOUT",
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
