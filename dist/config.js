import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
process.loadEnvFile(envPath);
const envDBUrl = process.env.DB_URL;
const envPlatform = process.env.PLATFORM ?? "";
const envJWTSecret = process.env.JWT_SECRET;
const envPolkaKey = process.env.POLKA_KEY;
if (!envDBUrl) {
    throw new Error("Environment variable DB_URL is required");
}
if (!envJWTSecret) {
    throw new Error("Environment variable JWT_SECRET is required");
}
if (!envPolkaKey) {
    throw new Error("Environment variable POLKA_KEY is required");
}
const migrationConfig = {
    migrationsFolder: path.resolve(__dirname, "..", "src", "db", "migrations"),
};
export const config = {
    api: {
        fileserverHits: 0,
        platform: envPlatform,
        jwtSecret: envJWTSecret,
        polkaKey: envPolkaKey,
    },
    db: { url: envDBUrl, migrationConfig },
};
