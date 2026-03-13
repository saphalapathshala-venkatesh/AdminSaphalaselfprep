import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const search     = sp.get("search") || "";
  const eventType  = sp.get("eventType") || "";
  const contentType = sp.get("contentType") || "";
  const blocked    = sp.get("blocked") || "";
  const dateFrom   = sp.get("dateFrom") || "";
  const dateTo     = sp.get("dateTo") || "";
  const page       = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit      = 30;
  const skip       = (page - 1) * limit;

  const userWhere: Record<string, unknown> = {};
  if (search) {
    userWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search, mode: "insensitive" } },
    ];
  }
  if (blocked === "true") userWhere.infringementBlocked = true;
  if (blocked === "false") userWhere.infringementBlocked = false;

  const eventWhere: Record<string, unknown> = {};
  if (eventType) eventWhere.eventType = eventType;
  if (contentType) eventWhere.contentType = contentType;
  if (dateFrom || dateTo) {
    eventWhere.createdAt = {};
    if (dateFrom) (eventWhere.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const dt = new Date(dateTo);
      dt.setHours(23, 59, 59, 999);
      (eventWhere.createdAt as Record<string, unknown>).lte = dt;
    }
  }

  if (Object.keys(userWhere).length > 0) {
    eventWhere.user = userWhere;
  }

  const [events, total] = await Promise.all([
    prisma.infringementEvent.findMany({
      where: eventWhere,
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true, infringementWarnings: true, infringementBlocked: true, isBlocked: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.infringementEvent.count({ where: eventWhere }),
  ]);

  return NextResponse.json({ events, total, page, totalPages: Math.ceil(total / limit) });
}
