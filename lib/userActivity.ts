import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";

export interface ActivityPayload {
  userId: string;
  activityType: ActivityType;
  meta?: Record<string, unknown> | string;
  deviceKey?: string;
  ipAddress?: string;
}

export function writeUserActivity(payload: ActivityPayload): void {
  const metaStr =
    payload.meta == null
      ? undefined
      : typeof payload.meta === "string"
      ? payload.meta
      : JSON.stringify(payload.meta);

  prisma.userActivity
    .create({
      data: {
        tenantId:     "default",
        userId:       payload.userId,
        activityType: payload.activityType,
        meta:         metaStr,
        deviceKey:    payload.deviceKey,
        ipAddress:    payload.ipAddress,
      },
    })
    .catch((err) => {
      console.error("UserActivity write failed (non-fatal):", err);
    });
}
