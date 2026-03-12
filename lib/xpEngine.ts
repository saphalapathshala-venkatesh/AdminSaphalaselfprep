import prisma from "@/lib/prisma";

// ─── Level thresholds ──────────────────────────────────────────────────────
export const LEVEL_THRESHOLDS = [0, 1000, 5000, 10000, 25000, 50000, 75000, 100000, 150000];

export function calculateLevel(xp: number): number {
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  // After 150,000 XP every 50,000 adds a level
  if (xp >= 150000) {
    level = 8 + Math.floor((xp - 150000) / 50000);
  }
  return level;
}

export function nextLevelThreshold(currentLevel: number): number | null {
  if (currentLevel < LEVEL_THRESHOLDS.length - 1) {
    return LEVEL_THRESHOLDS[currentLevel + 1];
  }
  return 150000 + (currentLevel - 7) * 50000;
}

// ─── Video XP ─────────────────────────────────────────────────────────────
// durationSeconds: video duration; returns 25 or 50 base XP
export function calculateVideoXp(durationSeconds: number): number {
  return durationSeconds <= 45 * 60 ? 25 : 50;
}

// ─── Badge metadata per level ─────────────────────────────────────────────
const BADGE_NAMES = [
  "Seeker", "Explorer", "Learner", "Scholar", "Achiever",
  "Master", "Champion", "Legend", "Sage",
];

function badgeForLevel(level: number): { badgeCode: string; badgeName: string; title: string; message: string } {
  const idx = Math.min(level - 1, BADGE_NAMES.length - 1);
  const name = level <= BADGE_NAMES.length ? BADGE_NAMES[idx] : `Elite ${level}`;
  const xp = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : 150000 + (level - 8) * 50000;
  return {
    badgeCode:  `LEVEL_${level}`,
    badgeName:  name,
    title:      `Level ${level} — ${name}!`,
    message:    `You reached Level ${level} by earning ${xp.toLocaleString()} XP. Keep it up!`,
  };
}

// ─── Wallet upsert helper ─────────────────────────────────────────────────
async function getOrCreateWallet(userId: string) {
  return prisma.userXpWallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

// ─── Level achievement check ──────────────────────────────────────────────
async function checkLevelAchievements(userId: string, oldLevel: number, newLevel: number) {
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    const { badgeCode, badgeName, title, message } = badgeForLevel(lvl);
    const xpThreshold = lvl < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[lvl] : 150000 + (lvl - 8) * 50000;
    await prisma.userAchievement.upsert({
      where: { userId_badgeCode: { userId, badgeCode } },
      create: {
        userId,
        achievementType: "LEVEL_UP",
        badgeCode,
        badgeName,
        levelNumber: lvl,
        xpThreshold,
        title,
        message,
      },
      update: {},
    });
  }
}

// ─── Get current XP rules as a map ────────────────────────────────────────
export async function getXpRulesMap(): Promise<Record<string, number>> {
  const rules = await prisma.xpRule.findMany();
  const map: Record<string, number> = {};
  for (const r of rules) {
    if (r.isEnabled) map[r.key] = r.value;
  }
  return map;
}

// ─── Core award function ──────────────────────────────────────────────────
// Handles repeat rules: 1st=100%, 2nd=50%, 3rd+=0%
// sourceType: VIDEO | TEST | FLASHCARD | HTML
// baseXp: the XP value for this content item
// watchPercent (0-100): for videos, proportional award
export async function awardContentXp(
  userId: string,
  sourceType: "VIDEO" | "TEST" | "FLASHCARD" | "HTML",
  sourceId: string,
  baseXp: number,
  watchPercent: number = 100,
  reason?: string,
): Promise<{ awarded: number; cycle: number }> {
  if (baseXp <= 0) return { awarded: 0, cycle: 0 };

  // Get or create source progress
  const progress = await prisma.userXpSourceProgress.upsert({
    where: { userId_sourceType_sourceId: { userId, sourceType, sourceId } },
    create: { userId, sourceType, sourceId, completionCount: 0, totalXpAwarded: 0 },
    update: {},
  });

  const cycle = progress.completionCount + 1;

  // Apply cycle multiplier
  let multiplier = 0;
  if (cycle === 1) multiplier = 1.0;
  else if (cycle === 2) multiplier = 0.5;
  // cycle 3+ = 0

  const awarded = Math.floor(baseXp * multiplier * (watchPercent / 100));

  // Update source progress (always increment count, add awarded)
  await prisma.userXpSourceProgress.update({
    where: { userId_sourceType_sourceId: { userId, sourceType, sourceId } },
    data: {
      completionCount: { increment: 1 },
      totalXpAwarded: { increment: awarded },
    },
  });

  if (awarded > 0) {
    await applyXpToWallet(userId, awarded, {
      reason: reason || `${sourceType} completion (cycle ${cycle})`,
      refType: sourceType,
      refId: sourceId,
    });
  }

  return { awarded, cycle };
}

// ─── Wallet update + ledger + level-up check ──────────────────────────────
async function applyXpToWallet(
  userId: string,
  delta: number,
  meta: { reason: string; refType?: string; refId?: string; metaJson?: any },
) {
  // Write ledger entry
  await prisma.xpLedgerEntry.create({
    data: {
      userId,
      delta,
      reason: meta.reason,
      refType: meta.refType || null,
      refId: meta.refId || null,
      meta: meta.metaJson || null,
    },
  });

  // Upsert wallet
  const wallet = await getOrCreateWallet(userId);
  const oldLevel = wallet.currentLevel;
  const newBalance = wallet.currentXpBalance + delta;
  const newLifetime = delta > 0 ? wallet.lifetimeXpEarned + delta : wallet.lifetimeXpEarned;
  const newRedeemed = delta < 0 ? wallet.lifetimeXpRedeemed + Math.abs(delta) : wallet.lifetimeXpRedeemed;
  const newLevel = calculateLevel(Math.max(0, newBalance));

  const updateData: any = {
    currentXpBalance: newBalance,
    currentLevel: newLevel,
  };
  if (delta > 0) updateData.lifetimeXpEarned = newLifetime;
  if (delta < 0) updateData.lifetimeXpRedeemed = newRedeemed;

  // Unlock redemption if lifetime >= 25000
  const rules = await getXpRulesMap();
  const unlockThreshold = rules["REDEMPTION_UNLOCK_THRESHOLD"] ?? 25000;
  if (!wallet.xpRedemptionUnlockedAt && newLifetime >= unlockThreshold) {
    updateData.xpRedemptionUnlockedAt = new Date();
  }

  await prisma.userXpWallet.update({ where: { userId }, data: updateData });

  // Check level-up achievements
  if (newLevel > oldLevel) {
    await checkLevelAchievements(userId, oldLevel, newLevel);
  }
}

// ─── Daily login XP ───────────────────────────────────────────────────────
export async function handleDailyLogin(userId: string): Promise<{ awarded: number; streakDays: number; bonusAwarded: number }> {
  const rules = await getXpRulesMap();
  const loginXp = rules["LOGIN_XP"] ?? 5;

  const wallet = await getOrCreateWallet(userId);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Already logged in today?
  if (wallet.lastLoginDate) {
    const lastStr = wallet.lastLoginDate.toISOString().slice(0, 10);
    if (lastStr === todayStr) {
      return { awarded: 0, streakDays: wallet.currentStreakDays, bonusAwarded: 0 };
    }
  }

  // Compute streak
  let newStreak = 1;
  if (wallet.lastLoginDate) {
    const lastMs = wallet.lastLoginDate.getTime();
    const diffDays = Math.floor((now.getTime() - lastMs) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) newStreak = wallet.currentStreakDays + 1;
    // else streak reset to 1
  }
  const newLongest = Math.max(newStreak, wallet.longestStreakDays);

  // Update streak fields
  await prisma.userXpWallet.update({
    where: { userId },
    data: {
      currentStreakDays: newStreak,
      longestStreakDays: newLongest,
      lastLoginDate: now,
    },
  });

  // Award login XP
  if (loginXp > 0) {
    await applyXpToWallet(userId, loginXp, {
      reason: "Daily login",
      refType: "DAILY_LOGIN",
    });
  }

  // Streak milestone bonuses
  const milestones: [number, string, string][] = [
    [7,   "STREAK_7_BONUS",   "7-day streak bonus"],
    [30,  "STREAK_30_BONUS",  "30-day streak bonus"],
    [50,  "STREAK_50_BONUS",  "50-day streak bonus"],
    [100, "STREAK_100_BONUS", "100-day streak bonus"],
  ];

  let bonusAwarded = 0;
  for (const [days, key, label] of milestones) {
    if (newStreak === days) {
      const bonus = rules[key] ?? 0;
      if (bonus > 0) {
        await applyXpToWallet(userId, bonus, {
          reason: label,
          refType: "STREAK_BONUS",
          metaJson: { streakDays: days },
        });
        bonusAwarded += bonus;
      }
    }
  }

  return { awarded: loginXp, streakDays: newStreak, bonusAwarded };
}

// ─── Redemption ───────────────────────────────────────────────────────────
// Returns error string if invalid, null if OK
export async function validateRedemption(
  userId: string,
  xpToRedeem: number,
  coursePricePaise: number,
  courseMaxPercent: number, // 1-3
): Promise<{ error: string | null; maxRedeemableXp: number; rupeeValue: number }> {
  const rules = await getXpRulesMap();
  const conversionRate = rules["REDEMPTION_CONVERSION_RATE"] ?? 100; // 100 XP = ₹1

  const wallet = await prisma.userXpWallet.findUnique({ where: { userId } });
  if (!wallet?.xpRedemptionUnlockedAt) {
    return { error: "XP redemption is not unlocked (need 25,000 lifetime XP)", maxRedeemableXp: 0, rupeeValue: 0 };
  }
  if (wallet.currentXpBalance < xpToRedeem) {
    return { error: "Insufficient XP balance", maxRedeemableXp: 0, rupeeValue: 0 };
  }

  // Max XP redeemable = courseMaxPercent% of course price in XP equivalent
  const maxRupeesRedeemable = (coursePricePaise / 100) * (courseMaxPercent / 100);
  const maxXpRedeemable = Math.floor(maxRupeesRedeemable * conversionRate);

  const minXp = Math.ceil((coursePricePaise / 100) * 0.01 * conversionRate); // 1% min

  if (xpToRedeem < minXp) {
    return { error: `Minimum redemption is ${minXp} XP`, maxRedeemableXp: maxXpRedeemable, rupeeValue: 0 };
  }
  if (xpToRedeem > maxXpRedeemable) {
    return { error: `Maximum redemption is ${maxXpRedeemable} XP (${courseMaxPercent}% of course price)`, maxRedeemableXp: maxXpRedeemable, rupeeValue: 0 };
  }

  const rupeeValue = xpToRedeem / conversionRate;
  return { error: null, maxRedeemableXp: maxXpRedeemable, rupeeValue };
}

export async function applyXpRedemption(
  userId: string,
  xpToRedeem: number,
  courseId: string,
): Promise<void> {
  await applyXpToWallet(userId, -xpToRedeem, {
    reason: `XP redeemed at checkout`,
    refType: "REDEMPTION",
    refId: courseId,
    metaJson: { xpRedeemed: xpToRedeem },
  });
}

// ─── Summary for student frontend ─────────────────────────────────────────
export async function getXpSummary(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  const lvl = wallet.currentLevel;
  const nextThreshold = nextLevelThreshold(lvl);
  const rules = await getXpRulesMap();
  const conversionRate = rules["REDEMPTION_CONVERSION_RATE"] ?? 100;
  const unlockThreshold = rules["REDEMPTION_UNLOCK_THRESHOLD"] ?? 25000;

  return {
    currentXpBalance: wallet.currentXpBalance,
    lifetimeXpEarned: wallet.lifetimeXpEarned,
    lifetimeXpRedeemed: wallet.lifetimeXpRedeemed,
    currentLevel: lvl,
    nextLevelAt: nextThreshold,
    currentStreakDays: wallet.currentStreakDays,
    longestStreakDays: wallet.longestStreakDays,
    redemptionUnlocked: !!wallet.xpRedemptionUnlockedAt,
    redemptionUnlockedAt: wallet.xpRedemptionUnlockedAt,
    redemptionUnlockThreshold: unlockThreshold,
    xpConversionRate: conversionRate,
  };
}
