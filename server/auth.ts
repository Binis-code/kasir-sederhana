import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db.js";
import { users } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const key = new TextEncoder().encode(JWT_SECRET);

export type SessionUser = {
  id: number;
  username: string;
  name: string;
  role: "owner" | "admin" | "kasir";
};

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 10);
}

export async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    if (typeof payload.id !== "number" || typeof payload.role !== "string") return null;
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: { cookies?: Record<string, string>; headers?: Record<string, unknown> }): Promise<SessionUser | null> {
  let token: string | undefined = req.cookies?.kios_session;
  if (!token) {
    const header = (req.headers as Record<string, string | undefined> | undefined)?.cookie ?? null;
    token = parseCookie(header).kios_session;
  }
  if (!token) return null;
  return verifyToken(token);
}

export function parseCookie(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

export async function getUserByUsername(username: string) {
  const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return u ?? null;
}

export async function updateLastLogin(userId: number) {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}