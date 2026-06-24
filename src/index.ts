import express from "express";
import { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { checkPasswordHash, hashPassword } from "./auth.js";
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
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

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
  constructor(message: string) {
    super(message);
    this.name = "badRequestError";
  }
}

// 401
class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// 403
class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// 404
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function handlerReadiness(req: Request, res: Response) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

function handlerMetrics(req: Request, res: Response) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
      </body>
    </html>`
    );
}

async function handlerReset(req: Request, res: Response) {
  if (config.api.platform !== "dev") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // delete all users but don't touch the schema
  await migrationClient`DELETE FROM users`;

  config.api.fileserverHits = 0;
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("Hits: 0");
}

// validation was ported into handlerCreateChirp; old endpoint removed

async function handlerCreateUser(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

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
  } catch (err) {
    throw err as Error;
  }
}

async function handlerLogin(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

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

    res.status(200).json({
      id: user.id,
      email: user.email,
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    });
  } catch {
    res.status(401).json({ error: "incorrect email or password" });
  }
}

async function handlerCreateChirp(req: Request, res: Response) {
  const { userId, body } = req.body as { userId?: string; body?: string };

  if (typeof userId !== "string" || typeof body !== "string") {
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
  } catch (err) {
    throw err as Error;
  }
}

async function handlerGetChirps(req: Request, res: Response) {
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

async function handlerGetChirpById(req: Request, res: Response) {
  const { chirpId } = req.params as { chirpId: string };
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

function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
  config.api.fileserverHits += 1;
  next();
}

function middlewareLogResponses(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  });

  next();
}

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err);

  let statusCode = 500;
  if (err instanceof badRequestError) {
    statusCode = 400;
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
  } else if (err instanceof ForbiddenError) {
    statusCode = 403;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
  }

  res.status(statusCode).json({ error: err.message });
}