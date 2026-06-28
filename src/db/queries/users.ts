import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { NewUser, refreshTokens, users } from "../schema.js";

export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();
  return result;
}

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function getUserFromRefreshToken(token: string) {
  const [result] = await db
    .select({ user: users })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(
      and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return result?.user;
}

export async function revokeRefreshToken(token: string) {
  const now = new Date();

  const [result] = await db
    .update(refreshTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(refreshTokens.token, token))
    .returning();

  return result;
}

export async function upgradeUserToChirpyRed(userId: string) {
  const now = new Date();

  const [result] = await db
    .update(users)
    .set({
      isChirpyRed: true,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning();

  return result;
}