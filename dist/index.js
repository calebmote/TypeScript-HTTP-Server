import express from "express";
import { config } from "./config.js";
const app = express();
const PORT = 8080;
app.use(express.json());
app.use(middlewareLogResponses);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);
app.post("/api/validate_chirp", handlerValidateChirp);
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
        <p>Chirpy has been visited ${config.fileserverHits} times!</p>
      </body>
    </html>`);
}
function handlerReset(req, res) {
    config.fileserverHits = 0;
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Hits: 0");
}
async function handlerValidateChirp(req, res) {
    const { body } = req.body;
    if (typeof body !== "string") {
        res.status(400).json({ error: "Invalid request body" });
        return;
    }
    if (body.length > 140) {
        throw new badRequestError("Chirp is too long. Max length is 140");
    }
    const sanitizedBody = body.replace(/(^|\s)(kerfuffle|sharbert|fornax)(?=$|\s)/gi, "$1****");
    res.set("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({ cleanedBody: sanitizedBody });
}
function middlewareMetricsInc(req, res, next) {
    config.fileserverHits += 1;
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
