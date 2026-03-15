import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const rawEmail = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!rawEmail || !password) {
    console.error(
      "[seed] ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in environment."
    );
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();

  console.log(`[seed] Target admin email: ${email}`);
  console.log(`[seed] Hashing password...`);

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
        isBlocked: false,
        blockedReason: null,
        deletedAt: null,
        mustChangePassword: false,
      },
    });
    console.log(`[seed] ✓ Admin user UPDATED — password reset, all auth flags cleared.`);
    console.log(`[seed] Email: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Super Admin",
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
        isBlocked: false,
      },
    });
    console.log(`[seed] ✓ Admin user CREATED.`);
    console.log(`[seed] Email: ${email}`);
  }

  console.log(`[seed] Password was reset: YES`);
  console.log(`[seed] Done — you can now log in with the seeded admin.`);
}

main()
  .catch((e) => {
    console.error("[seed] Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
