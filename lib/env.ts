const BLOCKED_PATTERNS = ["replit", "helium", "localhost", "127.0.0.1"];

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[ENV] Missing ${name}`);
  return value;
}

export function getDatabaseUrl(): string {
  const url = requireEnv("DATABASE_URL");
  if (process.env.ENFORCE_NEON_ONLY === "true" || process.env.VERCEL_ENV) {
    validateNotLocal(url, "DATABASE_URL");
  }
  return url;
}

export function getDirectUrl(): string | undefined {
  const url = process.env.DIRECT_URL?.trim();
  if (!url) return undefined;
  if (process.env.ENFORCE_NEON_ONLY === "true" || process.env.VERCEL_ENV) {
    validateNotLocal(url, "DIRECT_URL");
  }
  return url;
}

function validateNotLocal(url: string, label: string) {
  const lower = url.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (lower.includes(pattern)) {
      throw new Error(`[DB] Refusing non-Neon ${label}. Contains "${pattern}". Use Neon connection string only.`);
    }
  }
}
