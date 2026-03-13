import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { AnnotationType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const contentType = sp.get("contentType");
  const contentId = sp.get("contentId");

  if (!contentType || !contentId) {
    return NextResponse.json({ error: "contentType and contentId are required" }, { status: 400 });
  }

  const annotations = await prisma.learnerAnnotation.findMany({
    where: { userId: user.id, contentType, contentId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ annotations });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { contentType, contentId, annotationType, selectedText, rangeData, color } = body;

  if (!contentType || !contentId || !selectedText || !rangeData) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validTypes: AnnotationType[] = ["HIGHLIGHT", "UNDERLINE"];
  const type: AnnotationType = validTypes.includes(annotationType) ? annotationType : "HIGHLIGHT";

  const annotation = await prisma.learnerAnnotation.create({
    data: {
      userId: user.id,
      contentType,
      contentId,
      annotationType: type,
      selectedText: String(selectedText).slice(0, 2000),
      rangeData,
      color: color || "#fef9c3",
    },
  });

  return NextResponse.json({ annotation }, { status: 201 });
}
