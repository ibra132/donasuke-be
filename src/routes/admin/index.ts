import { Hono } from "hono";
import { authenticate } from "../../middleware/auth.middleware";
import {
  requirePermission,
  requireRole,
} from "../../middleware/rbac.middleware";
import { verificationRoute } from "./verification.route";
import { adminCampaignRoute } from "./campaign.route";

export const adminRoute = new Hono();

adminRoute.use(
  "/*",
  authenticate,
  requirePermission("admin:access"),
  requireRole("ADMIN")
);
adminRoute.route("/verifications", verificationRoute);
adminRoute.route("/campaigns", adminCampaignRoute);
