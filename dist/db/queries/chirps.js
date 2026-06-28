import { asc, desc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";
export async function getAllChirps(authorId, sort = "asc") {
    const orderByClause = sort === "desc" ? desc(chirps.createdAt) : asc(chirps.createdAt);
    if (authorId) {
        return db
            .select()
            .from(chirps)
            .where(eq(chirps.userId, authorId))
            .orderBy(orderByClause);
    }
    return db.select().from(chirps).orderBy(orderByClause);
}
export async function getChirpById(chirpId) {
    const [chirp] = await db.select().from(chirps).where(eq(chirps.id, chirpId)).limit(1);
    return chirp;
}
