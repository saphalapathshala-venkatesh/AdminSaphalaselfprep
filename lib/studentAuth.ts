import { NextRequest } from "next/server";
import prisma from "./prisma";
import type { User } from "@prisma/client";

/**
 * Validates the student-facing `session` cookie.
 * Accepts both STUDENT sessions (from student-signup) and ADMIN sessions
 * (from user-login, which uses the same `session` cookie). This allows admin
 * preview of student-facing APIs without a separate login.
 *
 * Admin-console sessions use the `admin_session` cookie (see lib/auth.ts) and
 * are completely separate from this flow.
 */
export async function getStudentUserFromRequest(req: NextRequest): Promise<User | null> {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.type !== "STUDENT" && session.type !== "ADMIN") return null;
  if (!session.user.isActive) return null;
  if (session.user.isBlocked) return null;

  return session.user;
}
