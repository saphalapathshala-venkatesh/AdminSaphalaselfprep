export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const VALID_STREAMS = ["TESTHUB", "SELFPREP_HTML", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON"];

// Cashfree standard rate: 1.6% + 18% GST on the fee = 1.6% * 1.18 = 1.888%
const GATEWAY_FEE_RATE = 0.016;
const GST_ON_FEE_RATE  = 0.18;

function computeNetPaise(grossPaise: number): number {
  const fee = Math.round(grossPaise * GATEWAY_FEE_RATE);
  const gst = Math.round(fee * GST_ON_FEE_RATE);
  return grossPaise - fee - gst;
}

const EMPTY_DASHBOARD = {
  kpis: {
    totalUsers: 0,
    grossRevenuePaise: 0,
    netRevenuePaise: 0,
    refundedPaise: 0,
    refundCount: 0,
    pendingRefunds: 0,
    adjustedNetRevenuePaise: 0,
    paidUsers: 0,
    freeUsers: 0,
  },
  charts: {
    attemptsByDay: [],
    activeUsersByDay: [],
    xpByDay: [],
    revenueByDay: [],
  },
  tables: {
    topXpEarners: [],
    mostAttemptedTests: [],
    recentlyPublishedContent: [],
  },
};

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startStr = searchParams.get("start") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const endStr = searchParams.get("end") || new Date().toISOString().slice(0, 10);
  const learnerFilter = searchParams.get("learnerFilter") || searchParams.get("learner") || "all";
  const stream = searchParams.get("stream") || "all";

  const start = new Date(startStr + "T00:00:00.000Z");
  const end   = new Date(endStr   + "T23:59:59.999Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.warn("[dashboard] Invalid date params:", { startStr, endStr });
    return NextResponse.json({ data: EMPTY_DASHBOARD }, { status: 200 });
  }

  const safeStream = VALID_STREAMS.includes(stream) ? stream : null;

  // Revenue is sourced from PaymentOrder (status=PAID, date=paidAt).
  // This is the ground truth — Purchase ledger may be empty for orders settled
  // before the Purchase creation step was deployed.
  const orderWhereBase: Prisma.PaymentOrderWhereInput = {
    status: "PAID",
    paidAt: { gte: start, lte: end },
    ...(safeStream ? { package: { entitlementCodes: { has: safeStream } } } : {}),
  };

  // Refunds are sourced from RefundRequest (linked to PaymentOrder, not Purchase).
  const refundWhereBase: Prisma.RefundRequestWhereInput = {
    status: { in: ["APPROVED", "PROCESSED"] },
    paymentOrder: { paidAt: { gte: start, lte: end } },
    ...(safeStream ? { paymentOrder: { paidAt: { gte: start, lte: end }, package: { entitlementCodes: { has: safeStream } } } } : {}),
  };

  try {
    const paidUserIds = await getPaidUserIds();
    const userFilter  = buildUserFilter(learnerFilter, paidUserIds);

    const totalStudents = await prisma.user.count({ where: { role: "STUDENT", ...userFilter } }).catch((e) => {
      console.warn("[dashboard] user.count(total) failed:", e?.message);
      return 0;
    });
    const paidInFilter = await prisma.user.count({
      where: { role: "STUDENT", ...userFilter, entitlements: { some: { status: "ACTIVE" } } },
    }).catch((e) => {
      console.warn("[dashboard] user.count(paid) failed:", e?.message);
      return 0;
    });
    const freeInFilter = totalStudents - paidInFilter;

    const [
      revAgg,
      refundAgg,
      pendingRefunds,
      attemptsByDay,
      activeUsersByDay,
      xpByDay,
      revenueByDay,
      topXpEarners,
      mostAttemptedTests,
      recentPages,
      recentPdfs,
    ] = await Promise.all([
      // ── Gross revenue: sum of finalAmountPaise from PAID orders in range ──
      prisma.paymentOrder.aggregate({
        where: orderWhereBase,
        _sum: { finalAmountPaise: true },
      }).catch((e) => {
        console.warn("[dashboard] paymentOrder.aggregate failed:", e?.message);
        return { _sum: { finalAmountPaise: null } };
      }),

      // ── Refunds approved / processed in range ─────────────────────────────
      prisma.refundRequest.aggregate({
        where: refundWhereBase,
        _sum:   { approvedPaise: true },
        _count: { id: true },
      }).catch((e) => {
        console.warn("[dashboard] refundRequest.aggregate failed:", e?.message);
        return { _sum: { approvedPaise: null }, _count: { id: 0 } };
      }),

      // ── Pending refund requests (all time, not date-filtered) ─────────────
      prisma.refundRequest.count({
        where: { status: { in: ["REQUESTED", "UNDER_REVIEW"] } },
      }).catch((e) => {
        console.warn("[dashboard] refundRequest.count(pending) failed:", e?.message);
        return 0;
      }),

      prisma.$queryRaw<{ date: string; count: bigint }[]>(
        Prisma.sql`SELECT DATE("startedAt") as date, COUNT(*)::bigint as count FROM "Attempt" WHERE "startedAt" >= ${start} AND "startedAt" <= ${end} GROUP BY DATE("startedAt") ORDER BY date`
      ).catch(() => []),

      prisma.$queryRaw<{ date: string; count: bigint }[]>(
        Prisma.sql`SELECT d.date, COUNT(DISTINCT d."userId")::bigint as count FROM (
          SELECT DATE("startedAt") as date, "userId" FROM "Attempt" WHERE "startedAt" >= ${start} AND "startedAt" <= ${end}
          UNION
          SELECT DATE("createdAt") as date, "userId" FROM "Session" WHERE "type" = 'STUDENT' AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        ) d GROUP BY d.date ORDER BY d.date`
      ).catch(() => []),

      prisma.$queryRaw<{ date: string; points: bigint }[]>(
        Prisma.sql`SELECT DATE("createdAt") as date, COALESCE(SUM("delta"), 0)::bigint as points FROM "XpLedgerEntry" WHERE "delta" > 0 AND "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY DATE("createdAt") ORDER BY date`
      ).catch(() => []),

      // ── Revenue by day from PaymentOrder (PAID, paidAt date) ─────────────
      safeStream
        ? prisma.$queryRaw<{ date: string; gross: bigint }[]>(
            Prisma.sql`
              SELECT DATE(po."paidAt") as date,
                COALESCE(SUM(po."finalAmountPaise"), 0)::bigint as gross
              FROM "PaymentOrder" po
              JOIN "ProductPackage" pp ON pp.id = po."packageId"
              WHERE po.status = 'PAID'
                AND po."paidAt" >= ${start} AND po."paidAt" <= ${end}
                AND ${safeStream} = ANY(pp."entitlementCodes")
              GROUP BY DATE(po."paidAt")
              ORDER BY date
            `
          ).catch(() => [])
        : prisma.$queryRaw<{ date: string; gross: bigint }[]>(
            Prisma.sql`
              SELECT DATE("paidAt") as date,
                COALESCE(SUM("finalAmountPaise"), 0)::bigint as gross
              FROM "PaymentOrder"
              WHERE status = 'PAID'
                AND "paidAt" >= ${start} AND "paidAt" <= ${end}
              GROUP BY DATE("paidAt")
              ORDER BY date
            `
          ).catch(() => []),

      prisma.$queryRaw<{ userId: string; totalXp: bigint }[]>(
        Prisma.sql`SELECT "userId", COALESCE(SUM("delta"), 0)::bigint as "totalXp" FROM "XpLedgerEntry" WHERE "delta" > 0 AND "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY "userId" ORDER BY "totalXp" DESC LIMIT 10`
      ).catch(() => []),

      prisma.$queryRaw<{ testId: string; attempts: bigint }[]>(
        Prisma.sql`SELECT "testId", COUNT(*)::bigint as attempts FROM "Attempt" WHERE "startedAt" >= ${start} AND "startedAt" <= ${end} GROUP BY "testId" ORDER BY attempts DESC LIMIT 10`
      ).catch(() => []),

      prisma.contentPage.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: { id: true, title: true, publishedAt: true },
      }).catch((e) => {
        console.warn("[dashboard] contentPage.findMany failed:", e?.message);
        return [];
      }),

      prisma.pdfAsset.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: { id: true, title: true, publishedAt: true },
      }).catch((e) => {
        console.warn("[dashboard] pdfAsset.findMany failed:", e?.message);
        return [];
      }),
    ]);

    const xpUserIds = (topXpEarners as any[]).map((r: any) => r.userId);
    const xpUsers = xpUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: xpUserIds } }, select: { id: true, name: true, email: true } }).catch(() => [])
      : [];
    const xpUserMap = Object.fromEntries(xpUsers.map(u => [u.id, u]));

    const testIds = (mostAttemptedTests as any[]).map((r: any) => r.testId);
    const tests = testIds.length > 0
      ? await prisma.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } }).catch(() => [])
      : [];
    const testMap = Object.fromEntries(tests.map(t => [t.id, t]));

    const recentContent = [
      ...recentPages.map((p: any) => ({ type: "HTML" as const, id: p.id, title: p.title, publishedAt: p.publishedAt })),
      ...recentPdfs.map((p: any) => ({ type: "PDF" as const, id: p.id, title: p.title, publishedAt: p.publishedAt })),
    ].sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()).slice(0, 10);

    const grossRevenuePaise         = Number((revAgg as any)._sum?.finalAmountPaise || 0);
    const netRevenuePaise           = computeNetPaise(grossRevenuePaise);
    const refundedPaise             = Number((refundAgg as any)._sum?.approvedPaise || 0);
    const refundCount               = Number((refundAgg as any)._count?.id || 0);
    const adjustedNetRevenuePaise   = netRevenuePaise - refundedPaise;

    return NextResponse.json({
      data: {
        kpis: {
          totalUsers: totalStudents,
          grossRevenuePaise,
          netRevenuePaise,
          refundedPaise,
          refundCount,
          pendingRefunds: Number(pendingRefunds || 0),
          adjustedNetRevenuePaise,
          paidUsers: paidInFilter,
          freeUsers: freeInFilter,
        },
        charts: {
          attemptsByDay:    (attemptsByDay as any[]).map((r: any) => ({ date: String(r.date).slice(0, 10), count: Number(r.count) })),
          activeUsersByDay: (activeUsersByDay as any[]).map((r: any) => ({ date: String(r.date).slice(0, 10), count: Number(r.count) })),
          xpByDay:          (xpByDay as any[]).map((r: any) => ({ date: String(r.date).slice(0, 10), points: Number(r.points) })),
          revenueByDay:     (revenueByDay as any[]).map((r: any) => {
            const gross = Number(r.gross);
            return { date: String(r.date).slice(0, 10), grossPaise: gross, netPaise: computeNetPaise(gross) };
          }),
        },
        tables: {
          topXpEarners:           (topXpEarners as any[]).map((r: any) => ({ userId: r.userId, name: xpUserMap[r.userId]?.name || null, email: xpUserMap[r.userId]?.email || null, totalXp: Number(r.totalXp) })),
          mostAttemptedTests:     (mostAttemptedTests as any[]).map((r: any) => ({ testId: r.testId, title: testMap[r.testId]?.title || "Unknown", attempts: Number(r.attempts) })),
          recentlyPublishedContent: recentContent,
        },
      },
    });
  } catch (err: any) {
    console.error("[dashboard] Unhandled error — returning empty dashboard:", err?.message || err);
    return NextResponse.json({ data: EMPTY_DASHBOARD }, { status: 200 });
  }
}

async function getPaidUserIds(): Promise<string[]> {
  try {
    const ents = await prisma.userEntitlement.findMany({
      where:    { status: "ACTIVE" },
      select:   { userId: true },
      distinct: ["userId"],
    });
    return ents.map(e => e.userId);
  } catch (e: any) {
    console.warn("[dashboard] getPaidUserIds failed:", e?.message);
    return [];
  }
}

function buildUserFilter(learnerFilter: string, paidUserIds: string[]): any {
  if (learnerFilter === "paid") return { id: { in: paidUserIds } };
  if (learnerFilter === "free") return { id: { notIn: paidUserIds } };
  return {};
}
