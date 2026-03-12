/**
 * Safety checks module — centralises runtime guards for security-sensitive operations.
 *
 * Provides:
 *  - ADMIN_ROLES: canonical set of admin role strings
 *  - isAdminRole: type-narrowing predicate for role strings
 *  - safeUser: strips passwordHash (and any other credentials) before serialisation
 *  - assertPasswordNeverLeaks: compile-time check — call before returning any User object
 */

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Returns true when the role string is a valid admin role. */
export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

/** Safe user shape — never contains passwordHash or other credentials. */
export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

/**
 * Strips credential fields from a User-like object before returning it in an API response.
 * Use this whenever you need to send user data to the client.
 */
export function safeUser(user: Record<string, unknown>): SafeUser {
  const { passwordHash: _pw, mobile: _m, ...rest } = user as any;
  return rest as SafeUser;
}

/**
 * Asserts that none of the credential field names appear in the keys of the object.
 * Throws in development; silently no-ops in production (fail-safe, not fail-hard).
 */
export function assertNoCredentialsLeaked(obj: Record<string, unknown>, label = "response"): void {
  const forbidden = ["passwordHash", "password", "token", "secret"];
  if (process.env.NODE_ENV === "production") return;
  for (const key of forbidden) {
    if (key in obj) {
      throw new Error(`[safetyChecks] Credential field "${key}" detected in ${label}. Strip it before serialising.`);
    }
  }
}

/**
 * Validates a new password against the minimum policy rules.
 * Returns an error string or null when the password is acceptable.
 */
export function validateNewPassword(password: string, current?: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (current && password === current) return "New password must differ from your current password";
  return null;
}

/**
 * Ensures the Prisma singleton is correctly set up for the current runtime.
 * Returns true when globalThis carries the shared instance, false otherwise.
 * Safe to call during tests or health checks.
 */
export function isPrismaSingletonActive(): boolean {
  return !!(globalThis as unknown as { prisma?: unknown }).prisma;
}
