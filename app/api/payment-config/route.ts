/**
 * Admin API: CRUD for PaymentConfig records.
 * Only SUPER_ADMIN can manage payment configs.
 * Secret key and webhook secret are NEVER returned in full — always masked.
 *
 * GET    /api/payment-config          — list all configs (masked)
 * POST   /api/payment-config          — create new config
 * PUT    /api/payment-config          — update config fields OR set as active
 * DELETE /api/payment-config?id=...   — delete (not allowed if active)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

function mask(s: string | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return s.slice(0, 4) + "••••••••" + s.slice(-4);
}

function safeConfig(c: any) {
  return {
    id:           c.id,
    provider:     c.provider,
    displayName:  c.displayName,
    environment:  c.environment,
    appId:        c.appId,          // not sensitive — shown in full
    secretKey:    mask(c.secretKey),
    webhookSecret: mask(c.webhookSecret),
    isActive:     c.isActive,
    notes:        c.notes,
    createdAt:    c.createdAt,
    updatedAt:    c.updatedAt,
    createdBy:    c.createdBy,
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const configs = await prisma.paymentConfig.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { id: true, email: true } } },
  });

  return NextResponse.json({ data: configs.map(safeConfig) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { provider, displayName, environment, appId, secretKey, webhookSecret, notes, isActive } = body;

  if (!displayName?.trim()) return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  if (!appId?.trim())       return NextResponse.json({ error: "appId is required" }, { status: 400 });
  if (!secretKey?.trim())   return NextResponse.json({ error: "secretKey is required" }, { status: 400 });
  if (!webhookSecret?.trim()) return NextResponse.json({ error: "webhookSecret is required" }, { status: 400 });

  const config = await prisma.$transaction(async tx => {
    // If this new config should be active, deactivate all others first
    if (isActive) {
      await tx.paymentConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    return tx.paymentConfig.create({
      data: {
        provider:      (provider || "CASHFREE").toUpperCase(),
        displayName:   displayName.trim(),
        environment:   environment === "PROD" ? "PROD" : "TEST",
        appId:         appId.trim(),
        secretKey:     secretKey.trim(),
        webhookSecret: webhookSecret.trim(),
        isActive:      Boolean(isActive),
        notes:         notes?.trim() || null,
        createdById:   user.id,
      },
      include: { createdBy: { select: { id: true, email: true } } },
    });
  });

  writeAuditLog({
    actorId: user.id, action: "PAYMENT_CONFIG_CREATE",
    entityType: "PaymentConfig", entityId: config.id,
    after: { displayName: config.displayName, provider: config.provider, environment: config.environment, isActive: config.isActive },
  });

  return NextResponse.json({ data: safeConfig(config) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, displayName, environment, appId, secretKey, webhookSecret, notes, setActive } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.paymentConfig.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.$transaction(async tx => {
    if (setActive) {
      // Deactivate all others before activating this one
      await tx.paymentConfig.updateMany({ where: { isActive: true, id: { not: id } }, data: { isActive: false } });
    }
    return tx.paymentConfig.update({
      where: { id },
      data: {
        displayName:   displayName?.trim() || existing.displayName,
        environment:   environment ? (environment === "PROD" ? "PROD" : "TEST") : existing.environment,
        appId:         appId?.trim() || existing.appId,
        // Only update secrets if a new non-empty value was provided
        ...(secretKey?.trim()    ? { secretKey:    secretKey.trim()    } : {}),
        ...(webhookSecret?.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        notes:         notes !== undefined ? (notes?.trim() || null) : existing.notes,
        isActive:      setActive ? true : existing.isActive,
      },
      include: { createdBy: { select: { id: true, email: true } } },
    });
  });

  writeAuditLog({
    actorId: user.id, action: "PAYMENT_CONFIG_UPDATE",
    entityType: "PaymentConfig", entityId: id,
    before: { displayName: existing.displayName, isActive: existing.isActive },
    after: { displayName: updated.displayName, isActive: updated.isActive, setActive },
  });

  return NextResponse.json({ data: safeConfig(updated) });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.paymentConfig.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isActive) return NextResponse.json({ error: "Cannot delete the active payment config. Activate another config first." }, { status: 409 });

  const orderCount = await prisma.paymentOrder.count({ where: { paymentConfigId: id } });
  if (orderCount > 0) return NextResponse.json({ error: `Cannot delete — ${orderCount} payment order(s) are linked to this config.` }, { status: 409 });

  await prisma.paymentConfig.delete({ where: { id } });
  writeAuditLog({ actorId: user.id, action: "PAYMENT_CONFIG_DELETE", entityType: "PaymentConfig", entityId: id, before: { displayName: existing.displayName } });

  return NextResponse.json({ data: { deleted: true } });
}
