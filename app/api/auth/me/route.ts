import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("admin_session")?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date() || session.type !== "ADMIN") {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const { user } = session;
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ user: null }, { status: 403 });
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Auth check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
