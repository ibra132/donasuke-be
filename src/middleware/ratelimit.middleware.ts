import type { Context, MiddlewareHandler, Next } from "hono";
import { AppError } from "../utils/error";
import type { HonoVariables } from "../types/context";

type Store = Map<string, { count: number; resetAt: number }>;

function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  getKey: (c: Context<{ Variables: HonoVariables }>) => string
): MiddlewareHandler {
  const store: Store = new Map();

  // Clean up expired entries every 5 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);

  return async (c, next: Next) => {
    const key = getKey(c as Context<{ Variables: HonoVariables }>);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      throw new AppError(429, "Terlalu banyak permintaan. Coba lagi nanti.");
    }

    entry.count++;
    return next();
  };
}

const getIp = (c: Context): string =>
  c.req.header("x-forwarded-for") ??
  c.req.header("x-real-ip") ??
  "unknown";

export const loginRateLimiter = createRateLimiter(10, 60_000, getIp);
export const registerRateLimiter = createRateLimiter(5, 60_000, getIp);

// Donation rate limiter uses userId (applied after authenticate middleware)
export const donationRateLimiter = createRateLimiter(
  20,
  60_000,
  (c) => c.get("user")?.userId ?? getIp(c)
);
