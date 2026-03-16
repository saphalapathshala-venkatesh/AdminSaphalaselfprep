/**
 * Startup schema check — runs once at app boot.
 *
 * Verifies that all critical columns used by auth and attempt queries
 * actually exist in the live database. Logs a clear, actionable error
 * if any are missing so the issue surfaces before the first real request.
 *
 * Does NOT crash the server — it logs and continues so other routes remain
 * accessible for debugging.
 */

import prisma from "./prisma";

type ColumnSpec = { table: string; column: string; critical: boolean };

const REQUIRED_COLUMNS: ColumnSpec[] = [
  // User — columns used by every login/session query
  { table: "User", column: "id",                 critical: true  },
  { table: "User", column: "email",               critical: true  },
  { table: "User", column: "mobile",              critical: true  },
  { table: "User", column: "passwordHash",        critical: true  },
  { table: "User", column: "role",                critical: true  },
  { table: "User", column: "isActive",            critical: true  },
  { table: "User", column: "isBlocked",           critical: true  },
  { table: "User", column: "deletedAt",           critical: true  },
  { table: "User", column: "mustChangePassword",  critical: true  },
  { table: "User", column: "legalAcceptedAt",     critical: false },
  { table: "User", column: "state",               critical: false },
  { table: "User", column: "gender",              critical: false },
  // Session — columns used by auth middleware
  { table: "Session", column: "token",            critical: true  },
  { table: "Session", column: "type",             critical: true  },
  { table: "Session", column: "expiresAt",        critical: true  },
  { table: "Session", column: "revokedAt",        critical: true  },
  // Attempt — columns used by student test flow
  { table: "Attempt", column: "status",           critical: true  },
  { table: "Attempt", column: "totalTimeUsedMs",  critical: true  },
  { table: "Attempt", column: "attemptNumber",    critical: true  },
  // AttemptAnswer — columns used by scoring
  { table: "AttemptAnswer", column: "selectedOptionIds", critical: true  },
  { table: "AttemptAnswer", column: "isCorrect",         critical: true  },
  { table: "AttemptAnswer", column: "timeSpentMs",       critical: true  },
];

type ColumnRow = { column_name: string };

async function getTableColumns(tableName: string): Promise<Record<string, true>> {
  try {
    const rows = await prisma.$queryRaw<ColumnRow[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    `;
    const map: Record<string, true> = {};
    for (const r of rows) map[r.column_name] = true;
    return map;
  } catch {
    return {};
  }
}

let checked = false;

export async function runStartupSchemaCheck(): Promise<void> {
  if (checked) return;
  checked = true;

  try {
    // Group columns by table for efficient batch queries
    const tableNamesSet: Record<string, true> = {};
    for (const c of REQUIRED_COLUMNS) tableNamesSet[c.table] = true;
    const tableNames = Object.keys(tableNamesSet);
    const columnsByTable: Record<string, Record<string, true>> = {};

    await Promise.all(
      tableNames.map(async (t) => {
        columnsByTable[t] = await getTableColumns(t);
      })
    );

    let hasCriticalMissing = false;
    const missing: string[] = [];

    for (const spec of REQUIRED_COLUMNS) {
      const cols = columnsByTable[spec.table] ?? {};
      // Prisma uses camelCase in schema but PostgreSQL stores snake_case
      // Convert camelCase to snake_case for the lookup
      const snakeCol = spec.column.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      const found = spec.column in cols || snakeCol in cols;
      if (!found) {
        const label = `"${spec.table}"."${spec.column}"`;
        missing.push(label);
        if (spec.critical) hasCriticalMissing = true;
      }
    }

    if (missing.length === 0) {
      console.log("[startupCheck] ✓ All critical DB columns verified.");
      return;
    }

    const prefix = hasCriticalMissing
      ? "[startupCheck] CRITICAL — Missing DB columns detected!"
      : "[startupCheck] WARNING — Some optional DB columns are missing.";

    console.error(`${prefix}\n  Missing: ${missing.join(", ")}`);
    console.error(
      "[startupCheck] Fix: ensure your DATABASE_URL points to the correct Neon DB and run `npx prisma db push`."
    );
  } catch (err) {
    console.error("[startupCheck] Failed to run schema check:", err);
  }
}
