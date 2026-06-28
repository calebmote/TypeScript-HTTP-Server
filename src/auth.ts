import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { Request } from "express";
import { randomBytes } from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function makeJWT(userID: string, expiresIn: number, secret: string): string {
  return jwt.sign({}, secret, { subject: userID, expiresIn });
}

export function validateJWT(tokenString: string, secret: string): string {
  try {
    const decoded = jwt.verify(tokenString, secret);
    if (typeof decoded !== "object" || decoded === null || typeof decoded.sub !== "string") {
      throw new Error("invalid token");
    }

    return decoded.sub;
  } catch {
    throw new Error("invalid token");
  }
}

export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    throw new Error("missing Authorization header");
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    throw new Error("invalid Authorization header");
  }

  return match[1].trim();
}

export function getAPIKey(req: Request): string {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    throw new Error("missing Authorization header");
  }

  const match = authHeader.match(/^ApiKey\s+(.+)$/);
  if (!match) {
    throw new Error("invalid Authorization header");
  }

  return match[1].trim();
}

export function makeRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

