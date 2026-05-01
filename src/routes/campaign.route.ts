// src/routes/campaign.route.ts
import { Hono } from "hono";

export const campaignRoute = new Hono();

campaignRoute.get("/", (c) => {
  return c.json({ message: "campaign route" });
});
