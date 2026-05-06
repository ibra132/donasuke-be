import { Hono } from "hono";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { verificationRoute } from "./verification.route";

export const adminRoute = new Hono();

adminRoute.use("/*", authenticate, authorize("user:verify"));
adminRoute.route("/verifications", verificationRoute);
