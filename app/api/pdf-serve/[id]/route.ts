export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const asset = await prisma.pdfAsset.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, fileData: true, mimeType: true, isPublished: true, isDownloadable: true },
    });

    if (!asset || !asset.fileData) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    const disposition = asset.isDownloadable
      ? `attachment; filename="${encodeURIComponent(asset.title)}.pdf"`
      : `inline; filename="${encodeURIComponent(asset.title)}.pdf"`;

    return new NextResponse(new Uint8Array(asset.fileData), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": String(asset.fileData.length),
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("PDF serve error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
