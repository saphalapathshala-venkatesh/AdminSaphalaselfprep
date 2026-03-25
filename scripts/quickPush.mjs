#!/usr/bin/env node
/**
 * quickPush.mjs — Safe single-command push to origin/main
 *
 * Run via:  npm run deploy:quick
 *       or: node scripts/quickPush.mjs
 *       or: node scripts/quickPush.mjs "optional summary message"
 *
 * What it does:
 *   1. Confirms you are on main (aborts if not)
 *   2. Checks for staged/unstaged changes — aborts if tree is clean
 *   3. Shows exactly which files will be committed
 *   4. Runs TypeScript check (npx tsc --noEmit --skipLibCheck)
 *   5. Runs Prisma schema validation (prisma validate)
 *   6. git add .
 *   7. git commit -m "<timestamp> | <summary>"
 *   8. git pull --rebase origin main  (aborts on conflict, never force-pushes)
 *   9. git push origin main
 *
 * Safety guarantees:
 *   - NEVER force-pushes
 *   - NEVER overwrites history
 *   - Stops immediately on any error
 *   - Stops immediately on rebase conflict — leaves you in clean state
 *   - TypeScript errors block the push (with --skip-ts to bypass in emergencies)
 */

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  white:  "\x1b[37m",
  gray:   "\x1b[90m",
};

const ok    = (msg) => console.log(`${C.green}✓${C.reset} ${msg}`);
const warn  = (msg) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`);
const info  = (msg) => console.log(`${C.cyan}→${C.reset} ${msg}`);
const fail  = (msg) => { console.error(`\n${C.red}✗ ERROR:${C.reset} ${msg}\n`); process.exit(1); };
const sep   = ()    => console.log(`${C.gray}${"─".repeat(56)}${C.reset}`);
const title = (msg) => { sep(); console.log(`${C.bold}${C.white} ${msg}${C.reset}`); sep(); };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, { allowFail = false, silent = false } = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : "inherit" });
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function capture(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function spawnVisible(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", encoding: "utf8" });
  return result.status ?? 1;
}

// ─── Args ─────────────────────────────────────────────────────────────────────
const rawArgs   = process.argv.slice(2);
const skipTs    = rawArgs.includes("--skip-ts");
const skipPrisma = rawArgs.includes("--skip-prisma");
const summaryArg = rawArgs.filter(a => !a.startsWith("--")).join(" ").trim();

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.cyan}🚀  quickPush — safe deploy to origin/main${C.reset}\n`);

// 1. Confirm branch is main ───────────────────────────────────────────────────
title("STEP 1 — Branch check");
const branch = capture("git branch --show-current");
if (branch !== "main") {
  fail(
    `You are on branch "${branch}", not "main".\n` +
    `  Switch with:  git checkout main\n` +
    `  Then re-run:  npm run deploy:quick`
  );
}
ok(`On branch: ${C.bold}main${C.reset}`);

// 2. Remote check ─────────────────────────────────────────────────────────────
title("STEP 2 — Remote check");
const remoteUrl = capture("git remote get-url origin 2>/dev/null");
if (!remoteUrl) {
  fail("No remote named 'origin' is configured. Set one with:\n  git remote add origin <url>");
}
ok(`origin → ${remoteUrl}`);

// 3. Check for changes ────────────────────────────────────────────────────────
title("STEP 3 — Changed files");
const statusRaw = capture("git status --porcelain");
if (!statusRaw) {
  console.log(`${C.yellow}  Nothing to commit — working tree is clean.${C.reset}\n`);
  process.exit(0);
}

const lines = statusRaw.split("\n").filter(Boolean);
console.log(`  ${C.bold}${lines.length} file(s) to be committed:${C.reset}`);
lines.forEach(line => {
  const status = line.slice(0, 2).trim();
  const file   = line.slice(3);
  const colour = status === "??" ? C.gray : status.includes("D") ? C.red : status.includes("A") ? C.green : C.yellow;
  console.log(`    ${colour}${status.padEnd(2)}${C.reset}  ${file}`);
});
console.log();

// 4. TypeScript check ─────────────────────────────────────────────────────────
title("STEP 4 — TypeScript check");
if (skipTs) {
  warn("TypeScript check skipped (--skip-ts flag). This is risky — only use in emergencies.");
} else {
  info("Running: npx tsc --noEmit --skipLibCheck …");
  const tsStatus = spawnVisible("npx", ["tsc", "--noEmit", "--skipLibCheck"]);
  if (tsStatus !== 0) {
    fail(
      "TypeScript errors detected. Push ABORTED.\n" +
      "  Fix the errors above, then re-run.\n" +
      "  Emergency bypass (not recommended): npm run deploy:quick -- --skip-ts"
    );
  }
  ok("TypeScript: no errors");
}

// 5. Prisma schema validation ─────────────────────────────────────────────────
title("STEP 5 — Prisma schema validation");
if (skipPrisma) {
  warn("Prisma check skipped (--skip-prisma flag).");
} else {
  const schemaPath = resolve("prisma/schema.prisma");
  if (!existsSync(schemaPath)) {
    warn("prisma/schema.prisma not found — skipping validation.");
  } else {
    info("Running: npx prisma validate …");
    const prismaStatus = spawnVisible("npx", ["prisma", "validate"]);
    if (prismaStatus !== 0) {
      fail(
        "Prisma schema validation failed. Push ABORTED.\n" +
        "  Fix the schema errors above, then re-run.\n" +
        "  Emergency bypass: npm run deploy:quick -- --skip-prisma"
      );
    }
    ok("Prisma schema: valid");
  }
}

// 6. Commit ───────────────────────────────────────────────────────────────────
title("STEP 6 — Committing");
const now = new Date();
const ts  = now.toISOString().replace("T", " ").slice(0, 16); // "YYYY-MM-DD HH:MM"
const summary = summaryArg || `update ${lines.length} file(s)`;
const commitMsg = `[${ts}] ${summary}`;

info("Running: git add . …");
run("git add .");

info(`Running: git commit -m "${commitMsg}" …`);
const commitOut = capture(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
if (!commitOut) {
  // git commit exits 1 if nothing to commit after add (edge case: only untracked gitignored files)
  warn("Nothing committed (all changes may be gitignored). Exiting.");
  process.exit(0);
}
console.log(`\n${C.gray}${commitOut}${C.reset}\n`);
ok(`Committed: "${commitMsg}"`);

// 7. Pull --rebase ────────────────────────────────────────────────────────────
title("STEP 7 — Pull --rebase origin main");
info("Running: git pull --rebase origin main …");
const pullStatus = spawnVisible("git", ["pull", "--rebase", "origin", "main"]);
if (pullStatus !== 0) {
  // Rebase failed — abort it so the user is left in a clean state
  console.log();
  warn("Rebase failed. Aborting rebase to restore clean state…");
  run("git rebase --abort", { allowFail: true, silent: true });
  fail(
    "git pull --rebase encountered a conflict or error.\n" +
    "  Your commit has been preserved but NOT pushed.\n" +
    "  Resolve conflicts manually, then re-run: npm run deploy:quick\n" +
    "  Or reset with: git reset HEAD~1 to undo your commit."
  );
}
ok("Rebase successful — no conflicts");

// 8. Push ─────────────────────────────────────────────────────────────────────
title("STEP 8 — Pushing to origin/main");
info("Running: git push origin main …");
const pushStatus = spawnVisible("git", ["push", "origin", "main"]);
if (pushStatus !== 0) {
  fail(
    "git push failed.\n" +
    "  Your commit exists locally but was NOT pushed.\n" +
    "  Check your network / GitHub access and retry: npm run deploy:quick"
  );
}

// ─── Done ─────────────────────────────────────────────────────────────────────
sep();
console.log(`\n${C.bold}${C.green}✅  DONE — pushed to origin/main${C.reset}`);
console.log(`   Commit: ${C.bold}${commitMsg}${C.reset}`);
console.log(`   Files:  ${lines.length} changed`);
console.log(`   Remote: ${remoteUrl}\n`);
