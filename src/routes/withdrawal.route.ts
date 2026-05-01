// src/routes/withdrawal.route.ts
import { Hono } from "hono";

export const withdrawalRoute = new Hono();

withdrawalRoute.get("/", (c) => {
  return c.json({ message: "withdrawal route" });
});
