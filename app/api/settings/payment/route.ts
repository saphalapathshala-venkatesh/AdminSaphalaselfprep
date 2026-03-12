export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";

function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 6) + "••••••••" + key.slice(-4);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const isLive = keyId?.startsWith("rzp_live_") ?? false;
  const isTest = keyId?.startsWith("rzp_test_") ?? false;

  return NextResponse.json({
    razorpay: {
      configured: !!(keyId && keySecret),
      mode: isLive ? "live" : isTest ? "test" : keyId ? "unknown" : "not_configured",
      keyId: maskKey(keyId),
      keySecret: keySecret ? maskKey(keySecret) : null,
      webhookSecret: webhookSecret ? maskKey(webhookSecret) : null,
    },
  });
}
