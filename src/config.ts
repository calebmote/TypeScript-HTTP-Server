import { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import type { MigrationConfig } from "drizzle-orm/migrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
process.loadEnvFile(envPath);

const envDBUrl = process.env.DB_URL;

const envPlatform = process.env.PLATFORM ?? "";

// include platform in API config
export type APIConfig = {
  fileserverHits: number;
  platform: string;
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

const migrationConfig: MigrationConfig = {
  migrationsFolder: path.resolve(__dirname, "..", "src", "db", "migrations"),
};

export const config: AppConfig = {
  api: { fileserverHits: 0, platform: envPlatform },
  db: { url: envDBUrl, migrationConfig },
};

