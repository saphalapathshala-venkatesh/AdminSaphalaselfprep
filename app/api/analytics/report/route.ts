export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const VALID_STREAMS = ["TESTHUB", "SELFPREP_HTML", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON"];

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "attempts";
  const startStr = searchParams.get("start") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const endStr = searchParams.get("end") || new Date().toISOString().slice(0, 10);
  const stream = searchParams.get("stream") || "all";

  const start = new Date(startStr + "T00:00:00.000Z");
  const end = new Date(endStr + "T23:59:59.999Z");
  const safeStream = VALID_STREAMS.includes(stream) ? stream : null;

  try {
    let rows: any[] = [];

    if (type === "attempts") {
      const raw = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT DATE("startedAt") as date, COUNT(*)::bigint as count, COUNT(DISTINCT "userId")::bigint as "uniqueUsers" FROM "Attempt" WHERE "startedAt" >= ${start} AND "startedAt" <= ${end} GROUP BY DATE("startedAt") ORDER BY date`
      );
      rows = raw.map(r => ({ date: String(r.date).slice(0, 10), count: Number(r.count), uniqueUsers: Number(r.uniqueUsers) }));
    } else if (type === "xp") {
      const raw = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("points"), 0)::bigint as points, COUNT(*)::bigint as events FROM "XpEvent" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY DATE("createdAt") ORDER BY date`
      );
      rows = raw.map(r => ({ date: String(r.date).slice(0, 10), points: Number(r.points), events: Number(r.events) }));
    } else if (type === "revenue") {
      const raw = safeStream
        ? await prisma.$queryRaw<any[]>(
            Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("grossPaise"), 0)::bigint as "grossPaise", COALESCE(SUM("netPaise"), 0)::bigint as "netPaise", COUNT(*)::bigint as transactions FROM "Purchase" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} AND "stream" = ${safeStream}::"RevenueStream" GROUP BY DATE("createdAt") ORDER BY date`
          )
        : await prisma.$queryRaw<any[]>(
            Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("grossPaise"), 0)::bigint as "grossPaise", COALESCE(SUM("netPaise"), 0)::bigint as "netPaise", COUNT(*)::bigint as transactions FROM "Purchase" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY DATE("createdAt") ORDER BY date`
          );
      rows = raw.map(r => ({ date: String(r.date).slice(0, 10), grossPaise: Number(r.grossPaise), netPaise: Number(r.netPaise), transactions: Number(r.transactions) }));
    } else if (type === "category-performance") {
      const raw = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT ts."categoryId", c."name" as "categoryName", COUNT(a.*)::bigint as attempts, AVG(a."scorePct") as "avgScore"
         FROM "Attempt" a
         JOIN "Test" t ON a."testId" = t."id"
         JOIN "TestSeries" ts ON t."seriesId" = ts."id"
         LEFT JOIN "Category" c ON ts."categoryId" = c."id"
         WHERE a."startedAt" >= ${start} AND a."startedAt" <= ${end}
         GROUP BY ts."categoryId", c."name"
         ORDER BY attempts DESC`
      );
      rows = raw.map(r => ({ categoryId: r.categoryId, categoryName: r.categoryName || "Uncategorized", attempts: Number(r.attempts), avgScore: r.avgScore ? Number(r.avgScore).toFixed(1) : "0.0" }));
    }

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("Report error:", err);
    return NextResponse.json({ error: "Internal server error", data: [] }, { status: 500 });
  }
}
