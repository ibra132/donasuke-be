// src/routes/donation.route.ts
import { Hono } from "hono";

export const donationRoute = new Hono();

donationRoute.get("/", (c) => {
  return c.json({ message: "donation route" });
});
