import express from "express";
import { config } from "./config.js";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { checkPasswordHash, getBearerToken, hashPassword, makeJWT, validateJWT } from "./auth.js";
import { getAllChirps, getChirpById } from "./db/queries/chirps.js";
import { getUserByEmail } from "./db/queries/users.js";
import { randomUUID } from "crypto";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);
const app = express();
const PORT = 8080;
// Helper to wrap async route handlers for error catching
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.get("/admin/metrics", handlerMetrics);
app.use(express.json());
app.use(middlewareLogResponses);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));
app.post("/admin/reset", asyncHandler(handlerReset));
app.post("/api/users", asyncHandler(handlerCreateUser));
app.post("/api/login", asyncHandler(handlerLogin));
app.post("/api/chirps", asyncHandler(handlerCreateChirp));
app.get("/api/chirps", asyncHandler(handlerGetChirps));
app.get("/api/chirps/:chirpId", asyncHandler(handlerGetChirpById));
// Error handler must be registered AFTER routes
app.use(errorHandler);
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
app.get("/api/healthz", handlerReadiness);
// 400
class badRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = "badRequestError";
    }
}
// 401
class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnauthorizedError";
    }
}
// 403
class ForbiddenError extends Error {
    constructor(message) {
        super(message);
        this.name = "ForbiddenError";
    }
}
// 404
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
    }
}
function handlerReadiness(req, res) {
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("OK");
}
function handlerMetrics(req, res) {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
      </body>
    </html>`);
}
async function handlerReset(req, res) {
    if (config.api.platform !== "dev") {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    // delete all users but don't touch the schema
    await migrationClient `DELETE FROM users`;
    config.api.fileserverHits = 0;
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Hits: 0");
}
// validation was ported into handlerCreateChirp; old endpoint removed
async function handlerCreateUser(req, res) {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "Invalid email or password" });
        return;
    }
    try {
        const hashedPassword = await hashPassword(password);
        const [user] = await db
            .insert(schema.users)
            .values({ email, hashedPassword })
            .returning();
        res.status(201).json({
            id: user.id,
            email: user.email,
            createdAt: new Date(user.createdAt).toISOString(),
            updatedAt: new Date(user.updatedAt).toISOString(),
        });
    }
    catch (err) {
        throw err;
    }
}
async function handlerLogin(req, res) {
    const { email, password, expiresInSeconds } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
        res.status(401).json({ error: "incorrect email or password" });
        return;
    }
    try {
        const user = await getUserByEmail(email);
        if (!user) {
            res.status(401).json({ error: "incorrect email or password" });
            return;
        }
        const passwordMatches = await checkPasswordHash(password, user.hashedPassword);
        if (!passwordMatches) {
            res.status(401).json({ error: "incorrect email or password" });
            return;
        }
        const maxExpiration = 60 * 60;
        const requestedExpiration = typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
            ? Math.floor(expiresInSeconds)
            : maxExpiration;
        const expirationSeconds = Math.min(Math.max(requestedExpiration, 1), maxExpiration);
        const token = makeJWT(user.id, expirationSeconds, config.api.jwtSecret);
        res.status(200).json({
            id: user.id,
            email: user.email,
            createdAt: new Date(user.createdAt).toISOString(),
            updatedAt: new Date(user.updatedAt).toISOString(),
            token,
        });
    }
    catch {
        res.status(401).json({ error: "incorrect email or password" });
    }
}
async function handlerCreateChirp(req, res) {
    const { body } = req.body;
    let userId;
    try {
        const token = getBearerToken(req);
        userId = validateJWT(token, config.api.jwtSecret);
    }
    catch {
        throw new UnauthorizedError("invalid token");
    }
    if (typeof body !== "string") {
        res.status(400).json({ error: "Invalid request body" });
        return;
    }
    if (body.length > 140) {
        throw new badRequestError("Chirp is too long. Max length is 140");
    }
    const sanitizedBody = body.replace(/(^|\s)(kerfuffle|sharbert|fornax)(?=$|\s)/gi, "$1****");
    const id = randomUUID();
    try {
        const [chirp] = await db
            .insert(schema.chirps)
            .values({ id, userId, body: sanitizedBody })
            .returning();
        res.status(201).json({
            id: chirp.id,
            createdAt: new Date(chirp.createdAt).toISOString(),
            updatedAt: new Date(chirp.updatedAt).toISOString(),
            body: chirp.body,
            userId: chirp.userId,
        });
    }
    catch (err) {
        throw err;
    }
}
async function handlerGetChirps(req, res) {
    const chirps = await getAllChirps();
    const response = chirps.map((chirp) => ({
        id: chirp.id,
        createdAt: new Date(chirp.createdAt).toISOString(),
        updatedAt: new Date(chirp.updatedAt).toISOString(),
        body: chirp.body,
        userId: chirp.userId,
    }));
    res.status(200).json(response);
}
async function handlerGetChirpById(req, res) {
    const { chirpId } = req.params;
    const chirp = await getChirpById(chirpId);
    if (!chirp) {
        res.status(404).json({ error: "Chirp not found" });
        return;
    }
    res.status(200).json({
        id: chirp.id,
        createdAt: new Date(chirp.createdAt).toISOString(),
        updatedAt: new Date(chirp.updatedAt).toISOString(),
        body: chirp.body,
        userId: chirp.userId,
    });
}
function middlewareMetricsInc(req, res, next) {
    config.api.fileserverHits += 1;
    next();
}
function middlewareLogResponses(req, res, next) {
    res.on("finish", () => {
        if (res.statusCode !== 200) {
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
        }
    });
    next();
}
function errorHandler(err, req, res, next) {
    console.error(err);
    let statusCode = 500;
    if (err instanceof badRequestError) {
        statusCode = 400;
    }
    else if (err instanceof UnauthorizedError) {
        statusCode = 401;
    }
    else if (err instanceof ForbiddenError) {
        statusCode = 403;
    }
    else if (err instanceof NotFoundError) {
        statusCode = 404;
    }
    res.status(statusCode).json({ error: err.message });
}
