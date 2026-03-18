export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { generatePdfUploadUrl, MAX_PDF_BYTES } from "@/lib/objectStorage";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { size } = body;

    if (size && size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
    }

    const { uploadUrl, publicUrl } = await generatePdfUploadUrl();
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err: any) {
    console.error("PDF request-url error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
