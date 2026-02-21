import prisma from "./prisma";

export async function writeAuditLog({
  userId,
  action,
  entity,
  entityId,
  meta,
}: {
  userId: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, meta: meta as any ?? undefined },
  });
}
