import { Hono } from "hono";
import { authenticate } from "../../middleware/auth.middleware";
import {
  requirePermission,
  requireRole,
} from "../../middleware/rbac.middleware";
import { verificationRoute } from "./verification.route";
import { adminCampaignRoute } from "./campaign.route";
import { adminWithdrawalRoute } from "./withdrawal.route";
import {
  getDashboardStats,
  getReports,
  actionReport,
} from "../../services/admin.service";
import { successResponse, errorResponse } from "../../utils/response";

export const adminRoute = new Hono();

adminRoute.use(
  "/*",
  authenticate,
  requirePermission("admin:access"),
  requireRole("ADMIN")
);

// -------------------------------------------------------
// GET /api/admin/dashboard
// -------------------------------------------------------
adminRoute.get("/dashboard", async (c) => {
  const stats = await getDashboardStats();

  return successResponse(c, stats, "OK");
});

// -------------------------------------------------------
// GET /api/admin/reports?page=1&limit=20
// -------------------------------------------------------
adminRoute.get("/reports", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  const result = await getReports(page, limit);

  return successResponse(c, result, "OK");
});

// -------------------------------------------------------
// POST /api/admin/reports/:id/action
// -------------------------------------------------------
adminRoute.post(
  "/reports/:id/action",
  requirePermission("report:resolve"),
  async (c) => {
    const body = await c.req.json();
    const action = body?.action;

    if (action !== "DISMISS" && action !== "CLOSE_CAMPAIGN") {
      return errorResponse(c, "action harus DISMISS atau CLOSE_CAMPAIGN", 400);
    }

    const result = await actionReport(c.req.param("id"), action);
    const msg =
      action === "CLOSE_CAMPAIGN"
        ? "Campaign berhasil ditutup"
        : "Laporan berhasil di-dismiss";

    return successResponse(c, result, msg);
  }
);

adminRoute.route("/verifications", verificationRoute);
adminRoute.route("/campaigns", adminCampaignRoute);
adminRoute.route("/withdrawals", adminWithdrawalRoute);
