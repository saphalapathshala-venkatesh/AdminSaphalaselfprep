export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  const skip     = (page - 1) * pageSize;

  const [activities, total] = await Promise.all([
    prisma.userActivity.findMany({
      where: { userId: params.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.userActivity.count({ where: { userId: params.id } }),
  ]);

  return NextResponse.json({
    data: activities,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
