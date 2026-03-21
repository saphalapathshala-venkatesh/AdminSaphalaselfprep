export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  const offset   = (page - 1) * pageSize;
  const uid      = params.id;

  try {
    // Use a UNION query to merge events from all three sources, sorted by date
    const countResult = await prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) as total FROM (
          SELECT "createdAt" FROM "UserActivity" WHERE "userId" = ${uid}
          UNION ALL
          SELECT "startedAt" as "createdAt" FROM "Attempt" WHERE "userId" = ${uid}
          UNION ALL
          SELECT "createdAt" FROM "XpLedgerEntry" WHERE "userId" = ${uid}
        ) combined
      `
    );
    const total = Number(countResult[0]?.total ?? 0);

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT * FROM (
          SELECT
            id,
            'AUTH'           AS source,
            "activityType"   AS event_type,
            NULL             AS details,
            meta             AS meta,
            "createdAt"
          FROM "UserActivity" WHERE "userId" = ${uid}

          UNION ALL

          SELECT
            a.id,
            'TEST'           AS source,
            a.status         AS event_type,
            CONCAT(
              t.title, ' | Attempt #', a."attemptNumber"::text,
              CASE WHEN a."submittedAt" IS NOT NULL
                   THEN CONCAT(' | Score: ', ROUND(a."scorePct"::numeric, 1)::text, '%')
                   ELSE ''
              END
            )                AS details,
            NULL             AS meta,
            a."startedAt"    AS "createdAt"
          FROM "Attempt" a
          JOIN "Test" t ON t.id = a."testId"
          WHERE a."userId" = ${uid}

          UNION ALL

          SELECT
            id,
            'XP'             AS source,
            CASE WHEN delta >= 0 THEN 'XP_EARNED' ELSE 'XP_REDEEMED' END AS event_type,
            CONCAT(
              CASE WHEN delta >= 0 THEN '+' ELSE '' END,
              delta::text, ' XP — ', reason
            )                AS details,
            NULL             AS meta,
            "createdAt"
          FROM "XpLedgerEntry" WHERE "userId" = ${uid}
        ) combined
        ORDER BY "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
    );

    return NextResponse.json({
      data: rows.map(r => ({
        id:         r.id,
        source:     r.source,
        eventType:  r.event_type,
        details:    r.details,
        meta:       r.meta,
        createdAt:  r.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("User activity GET error:", err);
    // Fallback: try just UserActivity
    const [activities, total] = await Promise.all([
      prisma.userActivity.findMany({
        where: { userId: uid },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: pageSize,
      }),
      prisma.userActivity.count({ where: { userId: uid } }),
    ]);
    return NextResponse.json({
      data: activities.map(a => ({
        id:        a.id,
        source:    "AUTH",
        eventType: a.activityType,
        details:   null,
        meta:      a.meta,
        createdAt: a.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }
}
