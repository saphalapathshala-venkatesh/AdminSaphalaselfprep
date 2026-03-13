export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

const VALID_CONTENT_TYPES = ["flashcard_deck", "html_material", "pdf_material"];
const TERMS_VERSION = "content_protection_terms_v1";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { contentType, contentId, accepted } = body;

    if (!contentType || !VALID_CONTENT_TYPES.includes(contentType))
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    if (!contentId)
      return NextResponse.json({ error: "contentId is required" }, { status: 400 });
    if (typeof accepted !== "boolean")
      return NextResponse.json({ error: "accepted must be boolean" }, { status: 400 });

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || null;
    const userAgent = req.headers.get("user-agent") || null;

    const consent = await prisma.contentConsent.create({
      data: {
        userId: user.id,
        contentType,
        contentId,
        accepted,
        termsVersion: TERMS_VERSION,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true, id: consent.id, accepted }, { status: 201 });
  } catch (err) {
    console.error("Consent POST error:", err);
    return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType");
  const contentId = searchParams.get("contentId");

  if (!contentType || !contentId)
    return NextResponse.json({ error: "contentType and contentId are required" }, { status: 400 });

  const consent = await prisma.contentConsent.findFirst({
    where: { userId: user.id, contentType, contentId, accepted: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ accepted: !!consent, consent: consent ?? null });
}
