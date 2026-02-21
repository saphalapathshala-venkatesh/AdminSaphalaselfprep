import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const ALL_KEYS = ["LOGIN_XP", "TEST_XP", "IMPROVEMENT_BONUS_XP", "FLASHCARD_XP", "RR_XP"] as const;
const DEFAULTS: Record<string, { value: number; dailyCap: number | null; multiplier: number }> = {
  LOGIN_XP: { value: 5, dailyCap: 5, multiplier: 1 },
  TEST_XP: { value: 10, dailyCap: null, multiplier: 1 },
  IMPROVEMENT_BONUS_XP: { value: 5, dailyCap: null, multiplier: 1 },
  FLASHCARD_XP: { value: 1, dailyCap: 50, multiplier: 1 },
  RR_XP: { value: 5, dailyCap: null, multiplier: 1 },
};

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let rules = await prisma.xpRule.findMany({ orderBy: { key: "asc" }, include: { updatedBy: { select: { id: true, name: true, email: true } } } });

    const existingKeys = new Set(rules.map(r => r.key));
    const missing = ALL_KEYS.filter(k => !existingKeys.has(k));
    if (missing.length > 0) {
      await prisma.xpRule.createMany({
        data: missing.map(k => ({
          key: k,
          value: DEFAULTS[k]?.value ?? 1,
          isEnabled: true,
          dailyCap: DEFAULTS[k]?.dailyCap ?? null,
          multiplier: DEFAULTS[k]?.multiplier ?? 1,
          updatedById: user.id,
        })),
      });
      rules = await prisma.xpRule.findMany({ orderBy: { key: "asc" }, include: { updatedBy: { select: { id: true, name: true, email: true } } } });
    }

    return NextResponse.json({ data: rules });
  } catch (err) {
    console.error("XpRules GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { key, value, isEnabled, dailyCap, multiplier } = body;

    if (!key || !ALL_KEYS.includes(key)) return NextResponse.json({ error: "Invalid rule key" }, { status: 400 });
    if (value !== undefined && (isNaN(Number(value)) || Number(value) < 0)) return NextResponse.json({ error: "value must be >= 0" }, { status: 400 });
    if (dailyCap !== undefined && dailyCap !== null && (isNaN(Number(dailyCap)) || Number(dailyCap) < 0)) return NextResponse.json({ error: "dailyCap must be >= 0 or null" }, { status: 400 });
    if (multiplier !== undefined && (isNaN(Number(multiplier)) || Number(multiplier) <= 0)) return NextResponse.json({ error: "multiplier must be > 0" }, { status: 400 });

    const existing = await prisma.xpRule.findUnique({ where: { key } });
    if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

    const updated = await prisma.xpRule.update({
      where: { key },
      data: {
        value: value !== undefined ? Number(value) : existing.value,
        isEnabled: isEnabled !== undefined ? isEnabled : existing.isEnabled,
        dailyCap: dailyCap !== undefined ? (dailyCap === null ? null : Number(dailyCap)) : existing.dailyCap,
        multiplier: multiplier !== undefined ? Number(multiplier) : existing.multiplier,
        updatedById: user.id,
      },
      include: { updatedBy: { select: { id: true, name: true, email: true } } },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "XP_RULE_UPDATE",
      entityType: "XpRule",
      entityId: existing.id,
      before: { key: existing.key, value: existing.value, isEnabled: existing.isEnabled, dailyCap: existing.dailyCap, multiplier: existing.multiplier },
      after: { key: updated.key, value: updated.value, isEnabled: updated.isEnabled, dailyCap: updated.dailyCap, multiplier: updated.multiplier },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("XpRules PUT error:", err);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}
