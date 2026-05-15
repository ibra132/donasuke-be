import { Hono } from "hono";
import { requirePermission } from "../../middleware/rbac.middleware";
import {
  rejectCampaignSchema,
  getCampaignsQuerySchema,
} from "../../validators/campaign.validator";
import {
  getPendingCampaigns,
  getCampaignById,
  approveCampaign,
  rejectCampaign,
  closeCampaign,
  recalculateCollectedAmount,
  getCampaignDocumentsAsAdmin,
  getCampaignDocumentUrlAsAdmin,
} from "../../services/campaign.service";
import { successResponse, errorResponse } from "../../utils/response";

export const adminCampaignRoute = new Hono();

// -------------------------------------------------------
// GET /api/admin/campaigns
// -------------------------------------------------------
adminCampaignRoute.get("/", async (c) => {
  const query = getCampaignsQuerySchema.safeParse(c.req.query());
  const page = query.success ? query.data.page : 1;
  const limit = query.success ? query.data.limit : 12;
  const result = await getPendingCampaigns(page, limit);

  return successResponse(c, result, "OK");
});

// -------------------------------------------------------
// GET /api/admin/campaigns/:id
// -------------------------------------------------------
adminCampaignRoute.get("/:id", async (c) => {
  const campaign = await getCampaignById(c.req.param("id"));

  return successResponse(c, { campaign }, "OK");
});

// -------------------------------------------------------
// GET /api/admin/campaigns/:id/documents
// -------------------------------------------------------
adminCampaignRoute.get("/:id/documents", async (c) => {
  const docs = await getCampaignDocumentsAsAdmin(c.req.param("id"));

  return successResponse(c, { documents: docs }, "OK");
});

// -------------------------------------------------------
// GET /api/admin/campaigns/documents/:documentId/url
// -------------------------------------------------------
adminCampaignRoute.get("/documents/:documentId/url", async (c) => {
  const docUrl = await getCampaignDocumentUrlAsAdmin(c.req.param("documentId"));

  return successResponse(c, { url: docUrl }, "OK");
});

// -------------------------------------------------------
// POST /api/admin/campaigns/:id/approve
// -------------------------------------------------------
adminCampaignRoute.post(
  "/:id/approve",
  requirePermission("campaign:approve"),
  async (c) => {
    const campaign = await approveCampaign(c.req.param("id"));

    return successResponse(
      c,
      { campaign },
      "Campaign berhasil di-approve dan sekarang aktif"
    );
  }
);

// -------------------------------------------------------
// POST /api/admin/campaigns/:id/reject
// -------------------------------------------------------
adminCampaignRoute.post(
  "/:id/reject",
  requirePermission("campaign:reject"),
  async (c) => {
    const body = await c.req.json();
    const result = rejectCampaignSchema.safeParse(body);

    if (!result.success) {
      return errorResponse(
        c,
        "Validasi gagal",
        400,
        result.error.issues.map((i) => ({
          field: String(i.path[0] ?? ""),
          message: i.message,
        }))
      );
    }

    const campaign = await rejectCampaign(
      c.req.param("id"),
      result.data.rejectReason
    );

    return successResponse(c, { campaign }, "Campaign berhasil di-reject");
  }
);

// -------------------------------------------------------
// POST /api/admin/campaigns/:id/close
// -------------------------------------------------------
adminCampaignRoute.post("/:id/close", async (c) => {
  const campaign = await closeCampaign(c.req.param("id"));

  return successResponse(c, { campaign }, "Campaign berhasil ditutup");
});

// -------------------------------------------------------
// POST /api/admin/campaigns/:id/recalculate-amount
// -------------------------------------------------------
adminCampaignRoute.post(
  "/:id/recalculate-amount",
  requirePermission("campaign:approve"),
  async (c) => {
    const result = await recalculateCollectedAmount(c.req.param("id"));

    return successResponse(c, result, "collectedAmount berhasil direcalculate");
  }
);
