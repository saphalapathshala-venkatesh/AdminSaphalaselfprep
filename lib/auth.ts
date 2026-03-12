import { cookies } from "next/headers";
import prisma from "./prisma";
import type { User } from "@prisma/client";
import { NextRequest } from "next/server";
import { isAdminRole, AdminRole } from "./safetyChecks";

const COOKIE_NAME = "admin_session";

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.type !== "ADMIN") return null;
  if (!session.user.isActive) return null;
  if (!isAdminRole(session.user.role)) return null;

  return session.user;
}

export async function getSessionUserFromRequest(req: NextRequest): Promise<User | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.type !== "ADMIN") return null;
  if (!session.user.isActive) return null;
  if (!isAdminRole(session.user.role)) return null;

  return session.user;
}

export async function requireAdmin(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  if (!isAdminRole(user.role)) throw new Error("Forbidden");
  return user;
}

export async function requireRole(role: AdminRole): Promise<User> {
  const user = await requireAdmin();
  if (user.role !== role && user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return user;
}
