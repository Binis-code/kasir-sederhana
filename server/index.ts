import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/_app.js";
import { createContext } from "./trpc/index.js";
import { verifyPasswordHash, createToken, getUserByUsername, updateLastLogin, getSessionFromRequest } from "./auth.js";

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = Number(process.env.PORT ?? 3000);

// Rate-limit login sederhana per username+IP: maks 10 kegagalan per 5 menit.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function loginThrottled(key: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) return { blocked: false, retryAfterSec: 0 };
  return entry.count >= 10 ? { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) } : { blocked: false, retryAfterSec: 0 };
}
function recordLoginFailure(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) loginAttempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
  else entry.count += 1;
  if (loginAttempts.size > 10_000) {
    for (const [k, v] of loginAttempts) { if (v.resetAt < now) loginAttempts.delete(k); }
  }
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) return res.status(400).json({ error: "Username & password wajib" });
    const throttleKey = `${String(username).toLowerCase()}|${req.ip ?? ""}`;
    const t = loginThrottled(throttleKey);
    if (t.blocked) {
      res.setHeader("Retry-After", String(t.retryAfterSec));
      return res.status(429).json({ error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${t.retryAfterSec} detik.` });
    }
    const user = await getUserByUsername(String(username));
    if (!user) { recordLoginFailure(throttleKey); return res.status(401).json({ error: "Kredensial salah" }); }
    const valid = await verifyPasswordHash(String(password), user.passwordHash);
    if (!valid) { recordLoginFailure(throttleKey); return res.status(401).json({ error: "Kredensial salah" }); }
    loginAttempts.delete(throttleKey);
    await updateLastLogin(user.id);
    const token = await createToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as "owner" | "admin" | "kasir",
    });
    res.cookie("kios_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "Kesalahan server" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("kios_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const user = await getSessionFromRequest(req);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/store-info", (_req, res) => {
  res.json({
    name: process.env.STORE_NAME ?? "Kios Nusa",
    address: process.env.STORE_ADDRESS ?? "",
    phone: process.env.STORE_PHONE ?? "",
  });
});

app.use("/trpc", createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: (o) => {
    console.error(`tRPC ${o.type} error on ${o.path}:`, o.error.message);
  },
}));

createServer(app).listen(PORT, () => {
  console.log(`Server API berjalan di http://localhost:${PORT}`);
});