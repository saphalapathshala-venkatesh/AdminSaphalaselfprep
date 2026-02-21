export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const skip = (page - 1) * limit;
  const showErrors = searchParams.get("errors") === "true";

  try {
    const job = await prisma.importJob.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        status: true,
        totalRows: true,
        validRows: true,
        invalidRows: true,
        reportUrl: true,
        createdAt: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    const where: any = { importJobId: id };
    if (showErrors) {
      where.isValid = false;
    }

    const [rows, totalRows] = await Promise.all([
      prisma.importRow.findMany({
        where,
        orderBy: { rowNumber: "asc" },
        skip,
        take: limit,
      }),
      prisma.importRow.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        job,
        rows,
        pagination: {
          page,
          limit,
          total: totalRows,
          totalPages: Math.ceil(totalRows / limit),
        },
      },
    });
  } catch (err) {
    console.error("Import GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
