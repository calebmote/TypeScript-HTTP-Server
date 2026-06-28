import path from "path";
import { fileURLToPath } from "url";
import type { MigrationConfig } from "drizzle-orm/migrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
process.loadEnvFile(envPath);

const envDBUrl = process.env.DB_URL;

const envPlatform = process.env.PLATFORM ?? "";
const envJWTSecret = process.env.JWT_SECRET;
const envPolkaKey = process.env.POLKA_KEY;

// include platform in API config
export type APIConfig = {
  fileserverHits: number;
  platform: string;
  jwtSecret: string;
  polkaKey: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

export type AppConfig = {
  api: APIConfig;
  db: DBConfig;
};

if (!envDBUrl) {
  throw new Error("Environment variable DB_URL is required");
}

if (!envJWTSecret) {
  throw new Error("Environment variable JWT_SECRET is required");
}

if (!envPolkaKey) {
  throw new Error("Environment variable POLKA_KEY is required");
}

const migrationConfig: MigrationConfig = {
  migrationsFolder: path.resolve(__dirname, "..", "src", "db", "migrations"),
};

export const config: AppConfig = {
  api: {
    fileserverHits: 0,
    platform: envPlatform,
    jwtSecret: envJWTSecret,
    polkaKey: envPolkaKey,
  },
  db: { url: envDBUrl, migrationConfig },
};

