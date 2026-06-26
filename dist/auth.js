import argon2 from "argon2";
import jwt from "jsonwebtoken";
export async function hashPassword(password) {
    return argon2.hash(password);
}
export async function checkPasswordHash(password, hash) {
    return argon2.verify(hash, password);
}
export function makeJWT(userID, expiresIn, secret) {
    return jwt.sign({}, secret, { subject: userID, expiresIn });
}
export function validateJWT(tokenString, secret) {
    try {
        const decoded = jwt.verify(tokenString, secret);
        if (typeof decoded !== "object" || decoded === null || typeof decoded.sub !== "string") {
            throw new Error("invalid token");
        }
        return decoded.sub;
    }
    catch {
        throw new Error("invalid token");
    }
}
