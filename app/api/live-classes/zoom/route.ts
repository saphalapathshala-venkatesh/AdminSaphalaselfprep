/**
 * POST /api/live-classes/zoom
 * Body: { liveClassId, action: "create" | "delete" | "update" }
 *
 * Creates, updates, or deletes a Zoom meeting for the given LiveClass.
 * On create: writes meetingId, joinUrl, startUrl, password to the LiveClass record.
 * On delete: removes the Zoom meeting and clears those fields.
 * On update: patches the Zoom meeting title/time if the session details changed.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting } from "@/lib/zoom";

function toISOUtc(sessionDate: Date | null, startTime: string | null): string | null {
  if (!sessionDate || !startTime) return null;
  const dateStr = sessionDate.toISOString().split("T")[0];
  return new Date(`${dateStr}T${startTime}:00+05:30`).toISOString();
}

function parseDurationMinutes(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 60;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 60;
}

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { liveClassId, action } = body as { liveClassId?: string; action?: string };

  if (!liveClassId || !["create", "delete", "update"].includes(action || "")) {
    return NextResponse.json({ error: "liveClassId and action (create|delete|update) are required" }, { status: 400 });
  }

  const lc = await prisma.liveClass.findUnique({ where: { id: liveClassId } });
  if (!lc) return NextResponse.json({ error: "Live class not found" }, { status: 404 });

  if (lc.platform !== "ZOOM") {
    return NextResponse.json({ error: "This live class is not set to the Zoom platform" }, { status: 400 });
  }

  try {
    if (action === "create") {
      if (lc.zoomMeetingId) {
        return NextResponse.json({ error: "A Zoom meeting already exists. Use action=update or delete first." }, { status: 409 });
      }

      const startIso = toISOUtc(lc.sessionDate, lc.startTime);
      if (!startIso) {
        return NextResponse.json({ error: "Session date and start time are required to create a Zoom meeting" }, { status: 400 });
      }

      const duration = parseDurationMinutes(lc.startTime, lc.endTime);
      const meeting = await createZoomMeeting({
        topic: lc.title,
        startTime: startIso,
        durationMinutes: duration,
        agenda: lc.description || undefined,
      });

      const updated = await prisma.liveClass.update({
        where: { id: liveClassId },
        data: {
          zoomMeetingId: meeting.meetingId,
          zoomPassword:  meeting.password,
          zoomStartUrl:  meeting.startUrl,
          joinUrl:       meeting.joinUrl,
          sessionCode:   meeting.password,
        },
      });

      writeAuditLog({
        actorId: admin.id, action: "ZOOM_MEETING_CREATE",
        entityType: "LiveClass", entityId: liveClassId,
        after: { zoomMeetingId: meeting.meetingId, joinUrl: meeting.joinUrl },
      });

      return NextResponse.json({ data: { zoomMeetingId: updated.zoomMeetingId, joinUrl: updated.joinUrl, password: updated.zoomPassword, startUrl: updated.zoomStartUrl } });
    }

    if (action === "delete") {
      if (!lc.zoomMeetingId) {
        return NextResponse.json({ error: "No Zoom meeting is linked to this live class" }, { status: 404 });
      }

      await deleteZoomMeeting(lc.zoomMeetingId);
      await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { zoomMeetingId: null, zoomPassword: null, zoomStartUrl: null, joinUrl: null, sessionCode: null },
      });

      writeAuditLog({
        actorId: admin.id, action: "ZOOM_MEETING_DELETE",
        entityType: "LiveClass", entityId: liveClassId,
        before: { zoomMeetingId: lc.zoomMeetingId },
      });

      return NextResponse.json({ data: { deleted: true } });
    }

    if (action === "update") {
      if (!lc.zoomMeetingId) {
        return NextResponse.json({ error: "No Zoom meeting is linked. Use action=create first." }, { status: 404 });
      }

      const startIso = toISOUtc(lc.sessionDate, lc.startTime);
      const duration = parseDurationMinutes(lc.startTime, lc.endTime);

      await updateZoomMeeting(lc.zoomMeetingId, {
        topic: lc.title,
        startTime: startIso || undefined,
        durationMinutes: duration,
        agenda: lc.description || undefined,
      });

      writeAuditLog({
        actorId: admin.id, action: "ZOOM_MEETING_UPDATE",
        entityType: "LiveClass", entityId: liveClassId,
        after: { zoomMeetingId: lc.zoomMeetingId, title: lc.title },
      });

      return NextResponse.json({ data: { updated: true, zoomMeetingId: lc.zoomMeetingId } });
    }

  } catch (err: any) {
    console.error("Zoom API error:", err);
    return NextResponse.json({ error: err.message || "Zoom API error" }, { status: 502 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
