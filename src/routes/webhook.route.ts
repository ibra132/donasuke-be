import { Hono } from "hono";
import { handleMidtransWebhook } from "../services/donation.service";
import { successResponse } from "../utils/response";

export const webhookRoute = new Hono();

// -------------------------------------------------------
// POST /api/webhooks/midtrans
// No auth — verified via signature di service
// -------------------------------------------------------
webhookRoute.post("/midtrans", async (c) => {
  const payload = await c.req.json();
  await handleMidtransWebhook(payload);

  return successResponse(c, null, "OK");
});
