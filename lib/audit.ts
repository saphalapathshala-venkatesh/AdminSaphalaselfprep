import prisma from "./prisma";

export async function writeAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  before,
  after,
  ip,
  userAgent,
}: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      before: before as any ?? undefined,
      after: after as any ?? undefined,
      ip,
      userAgent,
    },
  });
}
