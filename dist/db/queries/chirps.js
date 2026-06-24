import { asc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";
export async function getAllChirps() {
    return db.select().from(chirps).orderBy(asc(chirps.createdAt));
}
export async function getChirpById(chirpId) {
    const [chirp] = await db.select().from(chirps).where(eq(chirps.id, chirpId)).limit(1);
    return chirp;
}
