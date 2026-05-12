import { Hono } from "hono";
import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { verificationRoute } from "./verification.route";

export const adminRoute = new Hono();

adminRoute.use("/*", authenticate, requirePermission("admin:access"));
adminRoute.route("/verifications", verificationRoute);
