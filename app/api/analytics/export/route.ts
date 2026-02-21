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
    let headers: string[] = [];
    let rows: string[][] = [];

    if (type === "attempts") {
      headers = ["Date", "Attempts", "Unique Users"];
      const data = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT DATE("startedAt") as date, COUNT(*)::bigint as count, COUNT(DISTINCT "userId")::bigint as "uniqueUsers" FROM "Attempt" WHERE "startedAt" >= ${start} AND "startedAt" <= ${end} GROUP BY DATE("startedAt") ORDER BY date`
      );
      rows = data.map(r => [String(r.date).slice(0, 10), String(Number(r.count)), String(Number(r.uniqueUsers))]);
    } else if (type === "xp") {
      headers = ["Date", "XP Points", "Events"];
      const data = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("points"), 0)::bigint as points, COUNT(*)::bigint as events FROM "XpEvent" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY DATE("createdAt") ORDER BY date`
      );
      rows = data.map(r => [String(r.date).slice(0, 10), String(Number(r.points)), String(Number(r.events))]);
    } else if (type === "revenue") {
      headers = ["Date", "Gross (Paise)", "Net (Paise)", "Transactions"];
      const data = safeStream
        ? await prisma.$queryRaw<any[]>(
            Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("grossPaise"), 0)::bigint as "grossPaise", COALESCE(SUM("netPaise"), 0)::bigint as "netPaise", COUNT(*)::bigint as transactions FROM "Purchase" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} AND "stream" = ${safeStream}::"RevenueStream" GROUP BY DATE("createdAt") ORDER BY date`
          )
        : await prisma.$queryRaw<any[]>(
            Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("grossPaise"), 0)::bigint as "grossPaise", COALESCE(SUM("netPaise"), 0)::bigint as "netPaise", COUNT(*)::bigint as transactions FROM "Purchase" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY DATE("createdAt") ORDER BY date`
          );
      rows = data.map(r => [String(r.date).slice(0, 10), String(Number(r.grossPaise)), String(Number(r.netPaise)), String(Number(r.transactions))]);
    } else if (type === "category-performance") {
      headers = ["Category", "Attempts", "Avg Score (%)"];
      const data = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT ts."categoryId", c."name" as "categoryName", COUNT(a.*)::bigint as attempts, AVG(a."scorePct") as "avgScore"
         FROM "Attempt" a
         JOIN "Test" t ON a."testId" = t."id"
         JOIN "TestSeries" ts ON t."seriesId" = ts."id"
         LEFT JOIN "Category" c ON ts."categoryId" = c."id"
         WHERE a."startedAt" >= ${start} AND a."startedAt" <= ${end}
         GROUP BY ts."categoryId", c."name"
         ORDER BY attempts DESC`
      );
      rows = data.map(r => [r.categoryName || "Uncategorized", String(Number(r.attempts)), r.avgScore ? Number(r.avgScore).toFixed(1) : "0.0"]);
    }

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${type}-report-${startStr}-${endStr}.csv"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
